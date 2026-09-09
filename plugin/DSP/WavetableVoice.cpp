#include "WavetableVoice.h"

#include <algorithm>
#include <cmath>

namespace aetherwave::dsp
{
namespace
{
constexpr double twoPi = juce::MathConstants<double>::twoPi;
}

WavetableVoice::WavetableVoice(const WavetableBank& bank,
                               juce::AudioProcessorValueTreeState& state,
                               const ModulationEngine& modulation,
                               std::atomic<double>& monoFrequencyMemory)
    : wavetableBank(bank),
      parameterState(state),
      modulationEngine(modulation),
      sharedMonoFrequency(monoFrequencyMemory)
{
    bindOscillator(osc1, true);
    bindOscillator(osc2, false);

    subWaveform = parameterState.getRawParameterValue(aetherwave::parameters::subWaveform);
    subOctave = parameterState.getRawParameterValue(aetherwave::parameters::subOctave);
    subLevel = parameterState.getRawParameterValue(aetherwave::parameters::subLevel);
    subEnabled = parameterState.getRawParameterValue(aetherwave::parameters::subEnabled);
    noiseType = parameterState.getRawParameterValue(aetherwave::parameters::noiseType);
    noiseLevel = parameterState.getRawParameterValue(aetherwave::parameters::noiseLevel);
    noiseEnabled = parameterState.getRawParameterValue(aetherwave::parameters::noiseEnabled);

    envAttack = parameterState.getRawParameterValue(aetherwave::parameters::env1Attack);
    envDecay = parameterState.getRawParameterValue(aetherwave::parameters::env1Decay);
    envSustain = parameterState.getRawParameterValue(aetherwave::parameters::env1Sustain);
    envRelease = parameterState.getRawParameterValue(aetherwave::parameters::env1Release);
    glide = parameterState.getRawParameterValue(aetherwave::parameters::glide);
    polyphony = parameterState.getRawParameterValue(aetherwave::parameters::polyphony);

    jassert(subWaveform && subOctave && subLevel && subEnabled);
    jassert(noiseType && noiseLevel && noiseEnabled);
    jassert(envAttack && envDecay && envSustain && envRelease && glide && polyphony);
}

void WavetableVoice::bindOscillator(OscParameters& osc, bool first)
{
    using namespace aetherwave::parameters;
    osc.table = parameterState.getRawParameterValue(first ? osc1Table : osc2Table);
    osc.position = parameterState.getRawParameterValue(first ? osc1Position : osc2Position);
    osc.octave = parameterState.getRawParameterValue(first ? osc1Octave : osc2Octave);
    osc.semitone = parameterState.getRawParameterValue(first ? osc1Semitone : osc2Semitone);
    osc.fine = parameterState.getRawParameterValue(first ? osc1Fine : osc2Fine);
    osc.warpMode = parameterState.getRawParameterValue(first ? osc1WarpMode : osc2WarpMode);
    osc.warpAmount = parameterState.getRawParameterValue(first ? osc1WarpAmount : osc2WarpAmount);
    osc.unison = parameterState.getRawParameterValue(first ? osc1Unison : osc2Unison);
    osc.detune = parameterState.getRawParameterValue(first ? osc1Detune : osc2Detune);
    osc.pan = parameterState.getRawParameterValue(first ? osc1Pan : osc2Pan);
    osc.level = parameterState.getRawParameterValue(first ? osc1Level : osc2Level);
    osc.enabled = parameterState.getRawParameterValue(first ? osc1Enabled : osc2Enabled);
    osc.phase = parameterState.getRawParameterValue(first ? osc1Phase : osc2Phase);

    jassert(osc.table && osc.position && osc.octave && osc.semitone && osc.fine);
    jassert(osc.warpMode && osc.warpAmount && osc.unison && osc.detune && osc.pan);
    jassert(osc.level && osc.enabled && osc.phase);
}

bool WavetableVoice::canPlaySound(juce::SynthesiserSound* sound)
{
    return dynamic_cast<WavetableSound*>(sound) != nullptr;
}

void WavetableVoice::startNote(int midiNoteNumber,
                               float velocity,
                               juce::SynthesiserSound*,
                               int currentPitchWheelPosition)
{
    targetFrequency = juce::MidiMessage::getMidiNoteInHertz(midiNoteNumber);
    const auto mode = static_cast<int>(std::lround(polyphony->load(std::memory_order_relaxed)));
    const auto previous = sharedMonoFrequency.exchange(targetFrequency, std::memory_order_relaxed);
    currentFrequency = mode == 0 || previous <= 0.0 || glide->load(std::memory_order_relaxed) <= 0.0001f
        ? targetFrequency
        : previous;

    noteVelocity = velocity;
    pinkNoiseState = 0.0f;
    subPhase = 0.0;

    const auto phaseOffset1 = static_cast<double>(osc1.phase->load(std::memory_order_relaxed));
    const auto phaseOffset2 = static_cast<double>(osc2.phase->load(std::memory_order_relaxed));
    for (std::size_t i = 0; i < phases1.size(); ++i)
    {
        const auto spread = static_cast<double>(i) / static_cast<double>(phases1.size());
        phases1[i] = std::fmod(phaseOffset1 + spread * 0.03125, 1.0);
        phases2[i] = std::fmod(phaseOffset2 + spread * 0.0375, 1.0);
    }

    ampEnvelope.setSampleRate(getSampleRate());
    updateEnvelope();
    pitchWheelMoved(currentPitchWheelPosition);
    ampEnvelope.noteOn();
}

void WavetableVoice::stopNote(float, bool allowTailOff)
{
    if (allowTailOff)
    {
        ampEnvelope.noteOff();
        return;
    }

    ampEnvelope.reset();
    clearCurrentNote();
}

void WavetableVoice::pitchWheelMoved(int value)
{
    constexpr float centre = 8192.0f;
    const auto normalised = juce::jlimit(-1.0f, 1.0f, (static_cast<float>(value) - centre) / centre);
    pitchWheelSemitones = normalised * 2.0f;
}

void WavetableVoice::controllerMoved(int, int)
{
}

double WavetableVoice::tuningRatio(float octave,
                                   float semitone,
                                   float fineCents,
                                   float bendSemitones) noexcept
{
    const auto totalSemitones = octave * 12.0f + semitone + fineCents / 100.0f + bendSemitones;
    return std::pow(2.0, static_cast<double>(totalSemitones) / 12.0);
}

double WavetableVoice::warpPhase(double phase, int mode, float amount) noexcept
{
    phase -= std::floor(phase);
    const auto a = juce::jlimit(0.0f, 1.0f, amount);

    switch (mode)
    {
        case 1: return std::fmod(phase * (1.0 + static_cast<double>(a) * 5.0), 1.0);
        case 2: return std::pow(phase, 1.0 + static_cast<double>(a) * 3.5);
        case 3:
        {
            auto warped = phase + std::sin(twoPi * phase) * static_cast<double>(a) * 0.18;
            warped -= std::floor(warped);
            return warped;
        }
        case 5:
        {
            const auto width = juce::jlimit(0.06, 0.94, 0.5 - static_cast<double>(a) * 0.42);
            return phase < width
                ? (phase / width) * 0.5
                : 0.5 + ((phase - width) / (1.0 - width)) * 0.5;
        }
        default: return phase;
    }
}

float WavetableVoice::fold(float sample, float amount) noexcept
{
    auto value = sample * (1.0f + juce::jlimit(0.0f, 1.0f, amount) * 8.0f);
    value = std::fmod(value + 3.0f, 4.0f);
    if (value < 0.0f)
        value += 4.0f;
    return value < 2.0f ? value - 1.0f : 3.0f - value;
}

std::array<float, 2> WavetableVoice::panGains(float pan) noexcept
{
    const auto p = juce::jlimit(-1.0f, 1.0f, pan);
    const auto angle = (p + 1.0f) * (juce::MathConstants<float>::pi * 0.25f);
    return { std::cos(angle), std::sin(angle) };
}

float WavetableVoice::subSample(int waveform, double phase) noexcept
{
    const auto p = phase - std::floor(phase);
    switch (waveform)
    {
        case 1: return static_cast<float>(1.0 - 4.0 * std::abs(p - 0.5));
        case 2: return p < 0.5 ? 1.0f : -1.0f;
        default: return static_cast<float>(std::sin(twoPi * p));
    }
}

void WavetableVoice::updateEnvelope()
{
    juce::ADSR::Parameters p;
    p.attack = envAttack->load(std::memory_order_relaxed);
    p.decay = envDecay->load(std::memory_order_relaxed);
    p.sustain = envSustain->load(std::memory_order_relaxed);
    p.release = envRelease->load(std::memory_order_relaxed);
    ampEnvelope.setParameters(p);
}

std::array<float, 2> WavetableVoice::renderOscillator(
    OscParameters& osc,
    std::array<double, 7>& phases,
    double baseHz,
    ModulationEngine::Destination pitchDestination,
    ModulationEngine::Destination positionDestination,
    ModulationEngine::Destination warpDestination,
    ModulationEngine::Destination phaseDestination,
    ModulationEngine::Destination levelDestination)
{
    if (osc.enabled->load(std::memory_order_relaxed) < 0.5f)
        return { 0.0f, 0.0f };

    const auto table = static_cast<int>(std::lround(osc.table->load(std::memory_order_relaxed)));
    const auto position = juce::jlimit(0.0f, 1.0f,
        osc.position->load(std::memory_order_relaxed)
        + modulationEngine.getDestination(positionDestination) * 0.5f);
    const auto warpAmount = juce::jlimit(0.0f, 1.0f,
        osc.warpAmount->load(std::memory_order_relaxed)
        + modulationEngine.getDestination(warpDestination) * 0.5f);
    const auto warpMode = static_cast<int>(std::lround(osc.warpMode->load(std::memory_order_relaxed)));
    const auto phaseMod = static_cast<double>(modulationEngine.getDestination(phaseDestination)) * 0.25;
    const auto level = juce::jlimit(0.0f, 1.5f,
        osc.level->load(std::memory_order_relaxed)
        + modulationEngine.getDestination(levelDestination) * 0.5f);
    const auto unison = juce::jlimit(1, static_cast<int>(phases.size()),
        static_cast<int>(std::lround(osc.unison->load(std::memory_order_relaxed))));
    const auto detune = juce::jlimit(0.0f, 1.0f, osc.detune->load(std::memory_order_relaxed));
    const auto pitchMod = modulationEngine.getDestination(pitchDestination) * 12.0f;
    const auto nominalRatio = tuningRatio(osc.octave->load(std::memory_order_relaxed),
                                          osc.semitone->load(std::memory_order_relaxed),
                                          osc.fine->load(std::memory_order_relaxed),
                                          pitchWheelSemitones + pitchMod);

    std::array<float, 2> output { 0.0f, 0.0f };
    const auto sampleRate = std::max(1.0, getSampleRate());
    const auto normaliser = 1.0f / std::sqrt(static_cast<float>(unison));
    const auto basePan = osc.pan->load(std::memory_order_relaxed)
        + modulationEngine.getDestination(ModulationEngine::Destination::pan) * 0.5f;

    for (int i = 0; i < unison; ++i)
    {
        const auto spread = unison == 1 ? 0.0f
            : (static_cast<float>(i) / static_cast<float>(unison - 1)) * 2.0f - 1.0f;
        const auto detuneCents = spread * detune * 38.0f;
        const auto ratio = nominalRatio * std::pow(2.0, static_cast<double>(detuneCents) / 1200.0);
        const auto frequency = baseHz * ratio;
        const auto warped = warpPhase(phases[static_cast<std::size_t>(i)] + phaseMod, warpMode, warpAmount);
        auto sample = wavetableBank.sample(table, position, warped);
        if (warpMode == 4)
            sample = fold(sample, warpAmount);

        const auto pan = juce::jlimit(-1.0f, 1.0f, basePan + spread * detune * 0.65f);
        const auto gains = panGains(pan);
        output[0] += sample * gains[0] * normaliser;
        output[1] += sample * gains[1] * normaliser;

        phases[static_cast<std::size_t>(i)] += frequency / sampleRate;
        phases[static_cast<std::size_t>(i)] -= std::floor(phases[static_cast<std::size_t>(i)]);
    }

    output[0] *= level;
    output[1] *= level;
    return output;
}

void WavetableVoice::renderNextBlock(juce::AudioBuffer<float>& outputBuffer,
                                     int startSample,
                                     int numSamples)
{
    if (! isVoiceActive())
        return;

    const auto sampleRate = getSampleRate();
    if (sampleRate <= 0.0)
        return;

    updateEnvelope();
    const auto glideSeconds = juce::jlimit(0.0f, 1.0f, glide->load(std::memory_order_relaxed));
    const auto glideCoefficient = glideSeconds > 0.0001f
        ? std::exp(-1.0 / (static_cast<double>(glideSeconds) * sampleRate))
        : 0.0;

    for (int sampleIndex = 0; sampleIndex < numSamples; ++sampleIndex)
    {
        if (glideCoefficient > 0.0)
            currentFrequency = targetFrequency + (currentFrequency - targetFrequency) * glideCoefficient;
        else
            currentFrequency = targetFrequency;

        const auto leftRight1 = renderOscillator(
            osc1, phases1, currentFrequency,
            ModulationEngine::Destination::osc1Pitch,
            ModulationEngine::Destination::osc1Position,
            ModulationEngine::Destination::osc1Warp,
            ModulationEngine::Destination::osc1Phase,
            ModulationEngine::Destination::osc1Level);
        const auto leftRight2 = renderOscillator(
            osc2, phases2, currentFrequency,
            ModulationEngine::Destination::osc2Pitch,
            ModulationEngine::Destination::osc2Position,
            ModulationEngine::Destination::osc2Warp,
            ModulationEngine::Destination::osc2Phase,
            ModulationEngine::Destination::osc2Level);

        auto left = leftRight1[0] + leftRight2[0];
        auto right = leftRight1[1] + leftRight2[1];

        if (subEnabled->load(std::memory_order_relaxed) >= 0.5f)
        {
            const auto subRatio = std::pow(2.0, static_cast<double>(subOctave->load(std::memory_order_relaxed)));
            const auto value = subSample(static_cast<int>(std::lround(subWaveform->load(std::memory_order_relaxed))), subPhase)
                * subLevel->load(std::memory_order_relaxed) * 0.7f;
            left += value * 0.7071f;
            right += value * 0.7071f;
            subPhase += (currentFrequency * subRatio) / sampleRate;
            subPhase -= std::floor(subPhase);
        }

        if (noiseEnabled->load(std::memory_order_relaxed) >= 0.5f)
        {
            const auto white = random.nextFloat() * 2.0f - 1.0f;
            pinkNoiseState = pinkNoiseState * 0.96f + white * 0.04f;
            const auto type = static_cast<int>(std::lround(noiseType->load(std::memory_order_relaxed)));
            float noise = white;
            if (type == 1)
                noise = pinkNoiseState * 3.2f;
            else if (type == 2)
                noise = pinkNoiseState * 2.4f + std::sin(static_cast<float>(subPhase * twoPi * 7.0)) * 0.08f;
            noise *= noiseLevel->load(std::memory_order_relaxed) * 0.45f;
            left += noise;
            right += noise * 0.97f;
        }

        const auto envelope = ampEnvelope.getNextSample();
        const auto gain = envelope * noteVelocity * 0.32f;
        const auto destinationSample = startSample + sampleIndex;
        outputBuffer.addSample(0, destinationSample, left * gain);
        if (outputBuffer.getNumChannels() > 1)
            outputBuffer.addSample(1, destinationSample, right * gain);
    }

    if (! ampEnvelope.isActive())
        clearCurrentNote();
}
}
