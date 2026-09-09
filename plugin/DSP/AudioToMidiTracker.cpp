#include "AudioToMidiTracker.h"

#include <algorithm>
#include <cmath>

namespace aetherwave::dsp
{
namespace
{
constexpr std::array<int, 7> majorIntervals { 0, 2, 4, 5, 7, 9, 11 };
constexpr std::array<int, 7> minorIntervals { 0, 2, 3, 5, 7, 8, 10 };

bool scaleContains(int pitchClass, int root, int scale)
{
    if (scale == 0)
        return true;

    const auto relative = (pitchClass - root + 12) % 12;
    const auto& intervals = scale == 1 ? majorIntervals : minorIntervals;
    return std::find(intervals.begin(), intervals.end(), relative) != intervals.end();
}
}

void AudioToMidiTracker::prepare(double newSampleRate)
{
    sampleRate = juce::jmax(8000.0, newSampleRate);
    decimationFactor = juce::jmax(1, static_cast<int>(std::lround(sampleRate / 12000.0)));
    analysisRate = sampleRate / static_cast<double>(decimationFactor);
    reset();
}

void AudioToMidiTracker::reset()
{
    ring.fill(0.0f);
    linearWindow.fill(0.0f);
    difference.fill(0.0f);
    cmnd.fill(1.0f);

    ringWriteIndex = 0;
    ringFill = 0;
    samplesSinceAnalysis = 0;
    decimationCount = 0;
    decimationAccumulator = 0.0f;
    levelEnvelope = 0.0f;
    previousAnalysisEnvelope = 0.0f;
    candidateNote = -1;
    candidateFrames = 0;
    silenceFrames = 0;
    activeNote = -1;
    framesSinceNoteOn = 0;

    for (auto& value : displayWaveform)
        value.store(0.0f, std::memory_order_relaxed);

    displayWriteIndex.store(0, std::memory_order_relaxed);
    inputDb.store(-100.0f, std::memory_order_relaxed);
    detectedFrequency.store(0.0f, std::memory_order_relaxed);
    detectedConfidence.store(0.0f, std::memory_order_relaxed);
    onsetStrength.store(0.0f, std::memory_order_relaxed);
    detectedMidiNote.store(-1, std::memory_order_relaxed);
    gateOpen.store(false, std::memory_order_relaxed);
}

void AudioToMidiTracker::pushAnalysisSample(float sample)
{
    ring[static_cast<std::size_t>(ringWriteIndex)] = sample;
    ringWriteIndex = (ringWriteIndex + 1) % analysisWindowSize;
    ringFill = juce::jmin(analysisWindowSize, ringFill + 1);

    const auto displayIndex = displayWriteIndex.fetch_add(1, std::memory_order_relaxed) % displaySize;
    displayWaveform[static_cast<std::size_t>(displayIndex)].store(sample, std::memory_order_relaxed);
}

void AudioToMidiTracker::process(const juce::AudioBuffer<float>& buffer,
                                 int inputChannels,
                                 juce::MidiBuffer& generatedMidi,
                                 const Settings& settings)
{
    const auto numSamples = buffer.getNumSamples();
    inputChannels = juce::jlimit(0, buffer.getNumChannels(), inputChannels);

    if (! settings.enabled)
    {
        if (activeNote >= 0)
            closeActiveNote(0, generatedMidi);
        gateOpen.store(false, std::memory_order_relaxed);
        detectedFrequency.store(0.0f, std::memory_order_relaxed);
        detectedConfidence.store(0.0f, std::memory_order_relaxed);
        detectedMidiNote.store(-1, std::memory_order_relaxed);
        return;
    }

    if (inputChannels <= 0)
    {
        ++silenceFrames;
        if (activeNote >= 0 && silenceFrames >= juce::jmax(2, settings.smoothingFrames))
            closeActiveNote(0, generatedMidi);
        gateOpen.store(false, std::memory_order_relaxed);
        return;
    }

    const auto releaseCoeff = static_cast<float>(std::exp(-1.0 / (sampleRate * 0.035)));

    for (int sampleIndex = 0; sampleIndex < numSamples; ++sampleIndex)
    {
        float mono = 0.0f;
        for (int channel = 0; channel < inputChannels; ++channel)
            mono += buffer.getReadPointer(channel)[sampleIndex];
        mono /= static_cast<float>(inputChannels);

        const auto magnitude = std::abs(mono);
        levelEnvelope = magnitude > levelEnvelope ? magnitude : levelEnvelope * releaseCoeff;
        inputDb.store(juce::Decibels::gainToDecibels(levelEnvelope, -100.0f), std::memory_order_relaxed);

        decimationAccumulator += mono;
        ++decimationCount;
        if (decimationCount < decimationFactor)
            continue;

        const auto decimated = decimationAccumulator / static_cast<float>(decimationFactor);
        decimationAccumulator = 0.0f;
        decimationCount = 0;
        pushAnalysisSample(decimated);

        ++samplesSinceAnalysis;
        if (ringFill == analysisWindowSize && samplesSinceAnalysis >= analysisHopSize)
        {
            samplesSinceAnalysis = 0;
            analyseFrame(settings, sampleIndex, generatedMidi);
        }
    }
}

void AudioToMidiTracker::analyseFrame(const Settings& settings,
                                      int samplePosition,
                                      juce::MidiBuffer& midi)
{
    for (int i = 0; i < analysisWindowSize; ++i)
        linearWindow[static_cast<std::size_t>(i)] = ring[static_cast<std::size_t>((ringWriteIndex + i) % analysisWindowSize)];

    const auto minFrequency = juce::jmax(35.0f, settings.minFrequency);
    const auto maxFrequency = juce::jmax(minFrequency + 1.0f, settings.maxFrequency);
    const auto minTau = juce::jlimit(2, analysisWindowSize / 2 - 2,
                                     static_cast<int>(std::floor(analysisRate / maxFrequency)));
    const auto maxTau = juce::jlimit(minTau + 1, analysisWindowSize / 2,
                                     static_cast<int>(std::ceil(analysisRate / minFrequency)));
    const auto comparisonLength = analysisWindowSize - maxTau - 1;

    difference.fill(0.0f);
    cmnd.fill(1.0f);

    // YIN's cumulative-mean normalized difference depends on all lower lags,
    // even when the final pitch search itself begins at minTau.
    for (int tau = 1; tau <= maxTau; ++tau)
    {
        double sum = 0.0;
        for (int i = 0; i < comparisonLength; ++i)
        {
            const auto delta = linearWindow[static_cast<std::size_t>(i)]
                - linearWindow[static_cast<std::size_t>(i + tau)];
            sum += static_cast<double>(delta) * static_cast<double>(delta);
        }
        difference[static_cast<std::size_t>(tau)] = static_cast<float>(sum);
    }

    double cumulative = 0.0;
    for (int tau = 1; tau <= maxTau; ++tau)
    {
        cumulative += difference[static_cast<std::size_t>(tau)];
        cmnd[static_cast<std::size_t>(tau)] = cumulative > 0.0
            ? static_cast<float>(difference[static_cast<std::size_t>(tau)] * static_cast<double>(tau) / cumulative)
            : 1.0f;
    }

    const auto yinThreshold = juce::jlimit(0.05f, 0.45f, 1.0f - settings.minConfidence);
    int bestTau = -1;
    for (int tau = minTau; tau < maxTau; ++tau)
    {
        if (cmnd[static_cast<std::size_t>(tau)] < yinThreshold)
        {
            while (tau + 1 <= maxTau
                   && cmnd[static_cast<std::size_t>(tau + 1)] < cmnd[static_cast<std::size_t>(tau)])
                ++tau;
            bestTau = tau;
            break;
        }
    }

    if (bestTau < 0)
    {
        bestTau = minTau;
        for (int tau = minTau + 1; tau <= maxTau; ++tau)
            if (cmnd[static_cast<std::size_t>(tau)] < cmnd[static_cast<std::size_t>(bestTau)])
                bestTau = tau;
    }

    const auto confidence = juce::jlimit(0.0f, 1.0f, 1.0f - cmnd[static_cast<std::size_t>(bestTau)]);
    auto refinedTau = static_cast<double>(bestTau);
    if (bestTau > minTau && bestTau < maxTau)
    {
        const auto left = static_cast<double>(cmnd[static_cast<std::size_t>(bestTau - 1)]);
        const auto centre = static_cast<double>(cmnd[static_cast<std::size_t>(bestTau)]);
        const auto right = static_cast<double>(cmnd[static_cast<std::size_t>(bestTau + 1)]);
        const auto denominator = left - 2.0 * centre + right;
        if (std::abs(denominator) > 1.0e-12)
            refinedTau += 0.5 * (left - right) / denominator;
    }

    const auto frequency = refinedTau > 0.0 ? analysisRate / refinedTau : 0.0;
    const auto level = inputDb.load(std::memory_order_relaxed);
    const auto currentEnvelope = levelEnvelope;
    const auto onset = juce::jlimit(0.0f, 1.0f, (currentEnvelope - previousAnalysisEnvelope) * 10.0f);
    previousAnalysisEnvelope = currentEnvelope;

    detectedFrequency.store(static_cast<float>(frequency), std::memory_order_relaxed);
    detectedConfidence.store(confidence, std::memory_order_relaxed);
    onsetStrength.store(onset, std::memory_order_relaxed);

    const auto valid = level >= settings.gateDb
        && frequency >= minFrequency
        && frequency <= maxFrequency
        && confidence >= settings.minConfidence;

    gateOpen.store(valid, std::memory_order_relaxed);
    ++framesSinceNoteOn;

    if (! valid)
    {
        ++silenceFrames;
        candidateFrames = 0;
        detectedMidiNote.store(-1, std::memory_order_relaxed);
        if (activeNote >= 0 && silenceFrames >= juce::jmax(2, settings.smoothingFrames))
            closeActiveNote(samplePosition, midi);
        return;
    }

    silenceFrames = 0;
    const auto midiFloat = static_cast<float>(69.0 + 12.0 * std::log2(frequency / 440.0));
    const auto note = quantizeNote(midiFloat, settings.scale, settings.root);
    detectedMidiNote.store(note, std::memory_order_relaxed);

    if (note == candidateNote)
        ++candidateFrames;
    else
    {
        candidateNote = note;
        candidateFrames = 1;
    }

    const auto requiredFrames = juce::jlimit(1, 8, settings.smoothingFrames);
    if (candidateFrames < requiredFrames)
        return;

    const auto velocity = velocityForLevel(level, settings);
    if (activeNote < 0)
    {
        openNote(note, velocity, samplePosition, midi);
        return;
    }

    if (activeNote != note)
    {
        closeActiveNote(samplePosition, midi);
        openNote(note, velocity, samplePosition, midi);
        return;
    }

    if (settings.retriggerOnOnset && onset > 0.16f && framesSinceNoteOn > requiredFrames * 2)
    {
        closeActiveNote(samplePosition, midi);
        openNote(note, velocity, samplePosition, midi);
    }
}

void AudioToMidiTracker::closeActiveNote(int samplePosition, juce::MidiBuffer& midi)
{
    if (activeNote >= 0)
        midi.addEvent(juce::MidiMessage::noteOff(1, activeNote), juce::jmax(0, samplePosition));

    activeNote = -1;
    framesSinceNoteOn = 0;
}

void AudioToMidiTracker::openNote(int note, float velocity, int samplePosition, juce::MidiBuffer& midi)
{
    activeNote = juce::jlimit(0, 127, note);
    framesSinceNoteOn = 0;
    midi.addEvent(juce::MidiMessage::noteOn(1, activeNote, juce::jlimit(0.05f, 1.0f, velocity)),
                  juce::jmax(0, samplePosition));
}

int AudioToMidiTracker::quantizeNote(float midiNote, int scale, int root) const noexcept
{
    auto rounded = juce::jlimit(0, 127, static_cast<int>(std::lround(midiNote)));
    if (scale == 0)
        return rounded;

    root = ((root % 12) + 12) % 12;
    for (int distance = 0; distance <= 6; ++distance)
    {
        const auto down = rounded - distance;
        if (down >= 0 && scaleContains(down % 12, root, scale))
            return down;

        if (distance == 0)
            continue;

        const auto up = rounded + distance;
        if (up <= 127 && scaleContains(up % 12, root, scale))
            return up;
    }
    return rounded;
}

float AudioToMidiTracker::velocityForLevel(float levelDb, const Settings& settings) const noexcept
{
    const auto dynamic = juce::jmap(juce::jlimit(settings.gateDb, -3.0f, levelDb),
                                    settings.gateDb, -3.0f, 0.25f, 1.0f);
    return juce::jlimit(0.05f, 1.0f,
                        0.78f + (dynamic - 0.78f) * juce::jlimit(0.0f, 1.0f, settings.velocitySensitivity));
}

juce::String AudioToMidiTracker::midiNoteName(int note)
{
    if (note < 0 || note > 127)
        return "--";

    static const juce::StringArray names { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };
    return names[note % 12] + juce::String(note / 12 - 1);
}

juce::var AudioToMidiTracker::getTelemetry() const
{
    auto* object = new juce::DynamicObject();
    const auto note = detectedMidiNote.load(std::memory_order_relaxed);
    object->setProperty("inputDb", inputDb.load(std::memory_order_relaxed));
    object->setProperty("frequencyHz", detectedFrequency.load(std::memory_order_relaxed));
    object->setProperty("confidence", detectedConfidence.load(std::memory_order_relaxed));
    object->setProperty("onset", onsetStrength.load(std::memory_order_relaxed));
    object->setProperty("midiNote", note);
    object->setProperty("noteName", midiNoteName(note));
    object->setProperty("gateOpen", gateOpen.load(std::memory_order_relaxed));

    juce::Array<juce::var> waveform;
    waveform.ensureStorageAllocated(displaySize);
    const auto write = displayWriteIndex.load(std::memory_order_relaxed);
    const auto start = ((write % displaySize) + displaySize) % displaySize;
    for (int i = 0; i < displaySize; ++i)
    {
        const auto index = (start + i) % displaySize;
        waveform.add(displayWaveform[static_cast<std::size_t>(index)].load(std::memory_order_relaxed));
    }
    object->setProperty("waveform", juce::var(waveform));
    return juce::var(object);
}
}
