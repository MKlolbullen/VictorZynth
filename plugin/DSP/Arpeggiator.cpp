#include "Arpeggiator.h"

#include <algorithm>
#include <cmath>

namespace aetherwave::dsp
{
namespace
{
constexpr double infiniteTimer = 1.0e18;
constexpr double timerEpsilon = 1.0e-9;
}

void Arpeggiator::prepare(double newSampleRate)
{
    sampleRate = juce::jmax(8000.0, newSampleRate);
    reset();
}

void Arpeggiator::reset()
{
    clearHeldNotes();
    physicalNotes.fill(false);
    noteVelocities.fill(0.8f);
    sequence.fill(0);
    sequenceVelocities.fill(0.8f);
    sequenceLength = 0;
    sequenceIndex = 0;
    currentNote = -1;
    samplesUntilNextStep = 0.0;
    samplesUntilGateOff = infiniteTimer;
    swingLongStep = false;
    lastLatch = false;
    lastMode = -1;
    lastOctaves = -1;
    telemetryCurrentNote.store(-1, std::memory_order_relaxed);
    telemetryStep.store(0, std::memory_order_relaxed);
    telemetrySequenceLength.store(0, std::memory_order_relaxed);
}

void Arpeggiator::clearHeldNotes()
{
    heldNotes.fill(false);
    heldNoteCount.store(0, std::memory_order_relaxed);
}

void Arpeggiator::reconcileHeldNotesWithPhysical()
{
    int count = 0;
    for (int note = 0; note < 128; ++note)
    {
        const auto down = physicalNotes[static_cast<std::size_t>(note)];
        heldNotes[static_cast<std::size_t>(note)] = down;
        if (down)
            ++count;
    }
    heldNoteCount.store(count, std::memory_order_relaxed);
}

void Arpeggiator::process(const juce::MidiBuffer& input,
                          juce::MidiBuffer& output,
                          int numSamples,
                          double tempoBpm,
                          const Settings& settings)
{
    output.clear();

    if (! settings.enabled)
    {
        if (currentNote >= 0)
            stopCurrentNote(0, output);
        output.addEvents(input, 0, numSamples, 0);
        clearHeldNotes();
        physicalNotes.fill(false);
        sequenceLength = 0;
        sequenceIndex = 0;
        samplesUntilNextStep = 0.0;
        samplesUntilGateOff = infiniteTimer;
        lastLatch = settings.latch;
        telemetrySequenceLength.store(0, std::memory_order_relaxed);
        return;
    }

    const auto maxSamplePosition = juce::jmax(0, numSamples - 1);
    double cursor = 0.0;

    auto emitDueAt = [&](int samplePosition)
    {
        if (samplesUntilGateOff <= timerEpsilon)
        {
            stopCurrentNote(samplePosition, output);
            samplesUntilGateOff = infiniteTimer;
        }

        if (samplesUntilNextStep <= timerEpsilon)
        {
            if (sequenceLength <= 0)
            {
                samplesUntilNextStep = infiniteTimer;
                return;
            }

            stopCurrentNote(samplePosition, output);

            const auto index = juce::jlimit(0, sequenceLength - 1, sequenceIndex);
            const auto note = sequence[static_cast<std::size_t>(index)];
            const auto velocity = juce::jlimit(0.05f, 1.0f,
                sequenceVelocities[static_cast<std::size_t>(index)]);

            output.addEvent(juce::MidiMessage::noteOn(1, note, velocity), samplePosition);
            currentNote = note;
            telemetryCurrentNote.store(note, std::memory_order_relaxed);
            telemetryStep.store(index, std::memory_order_relaxed);

            sequenceIndex = (sequenceIndex + 1) % sequenceLength;
            const auto stepSamples = nextStepSamples(tempoBpm, settings);
            samplesUntilNextStep = stepSamples;
            samplesUntilGateOff = juce::jmax(1.0,
                stepSamples * juce::jlimit(0.05f, 1.0f, settings.gate));
        }
    };

    // Advance generated timing only up to (not beyond) an input MIDI event. If an
    // arp event lands exactly on the same sample, the incoming event is applied first,
    // then the due arp event is emitted from the updated note set.
    auto advanceTo = [&](double target)
    {
        while (cursor < target)
        {
            const auto remaining = target - cursor;
            const auto nextEvent = juce::jmin(samplesUntilNextStep, samplesUntilGateOff);

            if (nextEvent >= infiniteTimer * 0.5)
            {
                cursor = target;
                break;
            }

            if (nextEvent >= remaining - timerEpsilon)
            {
                if (samplesUntilNextStep < infiniteTimer * 0.5)
                    samplesUntilNextStep = juce::jmax(0.0, samplesUntilNextStep - remaining);
                if (samplesUntilGateOff < infiniteTimer * 0.5)
                    samplesUntilGateOff = juce::jmax(0.0, samplesUntilGateOff - remaining);
                cursor = target;
                break;
            }

            cursor += nextEvent;
            if (samplesUntilNextStep < infiniteTimer * 0.5)
                samplesUntilNextStep = juce::jmax(0.0, samplesUntilNextStep - nextEvent);
            if (samplesUntilGateOff < infiniteTimer * 0.5)
                samplesUntilGateOff = juce::jmax(0.0, samplesUntilGateOff - nextEvent);

            emitDueAt(juce::jlimit(0, maxSamplePosition,
                static_cast<int>(std::floor(cursor))));
        }
    };

    auto rebuildAt = [&](int samplePosition, bool retriggerNow)
    {
        const auto previousLength = sequenceLength;
        rebuildSequence(settings);

        if (sequenceLength <= 0)
        {
            stopCurrentNote(samplePosition, output);
            sequenceIndex = 0;
            samplesUntilNextStep = infiniteTimer;
            samplesUntilGateOff = infiniteTimer;
            return;
        }

        if (retriggerNow || previousLength <= 0)
        {
            stopCurrentNote(samplePosition, output);
            sequenceIndex = 0;
            samplesUntilNextStep = 0.0;
            samplesUntilGateOff = infiniteTimer;
            swingLongStep = false;
            emitDueAt(samplePosition);
        }
        else
        {
            sequenceIndex %= sequenceLength;
        }
    };

    bool settingsChanged = settings.mode != lastMode || settings.octaves != lastOctaves;

    // A latched note-off was intentionally ignored while latch was on. When latch is
    // switched off, reconcile against the keys that are physically still down so stale
    // latched notes cannot live forever.
    if (lastLatch && ! settings.latch)
    {
        reconcileHeldNotesWithPhysical();
        settingsChanged = true;
    }

    lastLatch = settings.latch;
    lastMode = settings.mode;
    lastOctaves = settings.octaves;

    if (settingsChanged)
        rebuildAt(0, settings.retrigger);

    for (const auto metadata : input)
    {
        const auto message = metadata.getMessage();
        const auto position = juce::jlimit(0, maxSamplePosition, metadata.samplePosition);

        advanceTo(static_cast<double>(position));

        bool noteSetChanged = false;

        if (message.isNoteOn())
        {
            const auto note = juce::jlimit(0, 127, message.getNoteNumber());

            if (settings.latch)
            {
                const auto anyPhysical = std::any_of(
                    physicalNotes.begin(), physicalNotes.end(), [](bool down) { return down; });
                if (! anyPhysical)
                    clearHeldNotes();
            }

            physicalNotes[static_cast<std::size_t>(note)] = true;
            heldNotes[static_cast<std::size_t>(note)] = true;
            noteVelocities[static_cast<std::size_t>(note)] = message.getFloatVelocity();
            noteSetChanged = true;
        }
        else if (message.isNoteOff())
        {
            const auto note = juce::jlimit(0, 127, message.getNoteNumber());
            physicalNotes[static_cast<std::size_t>(note)] = false;
            if (! settings.latch)
            {
                heldNotes[static_cast<std::size_t>(note)] = false;
                noteSetChanged = true;
            }
        }
        else
        {
            if (message.isController())
            {
                const auto controller = message.getControllerNumber();
                if (controller == 120 || controller == 123)
                {
                    clearHeldNotes();
                    physicalNotes.fill(false);
                    noteSetChanged = true;
                }
            }

            output.addEvent(message, position);
        }

        if (noteSetChanged)
            rebuildAt(position, settings.retrigger);

        // If a previously scheduled arp transition lands on this exact sample, it must
        // happen after the triggering input event rather than at sample 0 or before it.
        emitDueAt(position);
    }

    // Emit generated events strictly inside the remainder of this block. A transition
    // exactly on the block boundary carries a zero timer into the next block and is
    // emitted at sample 0 there, preserving sample-accurate continuity.
    advanceTo(static_cast<double>(numSamples));
}

void Arpeggiator::rebuildSequence(const Settings& settings)
{
    std::array<int, 128> bases {};
    int baseCount = 0;
    for (int note = 0; note < 128; ++note)
    {
        if (heldNotes[static_cast<std::size_t>(note)])
            bases[static_cast<std::size_t>(baseCount++)] = note;
    }

    heldNoteCount.store(baseCount, std::memory_order_relaxed);
    sequenceLength = 0;

    if (baseCount == 0)
    {
        telemetrySequenceLength.store(0, std::memory_order_relaxed);
        return;
    }

    std::array<int, 512> ascending {};
    std::array<float, 512> ascendingVelocities {};
    int ascendingCount = 0;
    const auto octaveCount = juce::jlimit(1, 4, settings.octaves);

    for (int octave = 0; octave < octaveCount; ++octave)
    {
        for (int i = 0; i < baseCount; ++i)
        {
            const auto baseNote = bases[static_cast<std::size_t>(i)];
            const auto note = baseNote + octave * 12;
            if (note > 127 || ascendingCount >= static_cast<int>(ascending.size()))
                continue;

            ascending[static_cast<std::size_t>(ascendingCount)] = note;
            ascendingVelocities[static_cast<std::size_t>(ascendingCount)] =
                noteVelocities[static_cast<std::size_t>(baseNote)];
            ++ascendingCount;
        }
    }

    auto appendAscending = [&](int from, int to, int step)
    {
        for (int i = from; i != to && sequenceLength < static_cast<int>(sequence.size()); i += step)
        {
            sequence[static_cast<std::size_t>(sequenceLength)] = ascending[static_cast<std::size_t>(i)];
            sequenceVelocities[static_cast<std::size_t>(sequenceLength)] =
                ascendingVelocities[static_cast<std::size_t>(i)];
            ++sequenceLength;
        }
    };

    switch (juce::jlimit(0, 3, settings.mode))
    {
        case 1: // down
            appendAscending(ascendingCount - 1, -1, -1);
            break;

        case 2: // up-down
            appendAscending(0, ascendingCount, 1);
            if (ascendingCount > 1)
                appendAscending(ascendingCount - 2, 0, -1);
            break;

        case 3: // down-up
            appendAscending(ascendingCount - 1, -1, -1);
            if (ascendingCount > 1)
                appendAscending(1, ascendingCount - 1, 1);
            break;

        case 0:
        default:
            appendAscending(0, ascendingCount, 1);
            break;
    }

    sequenceIndex = sequenceLength > 0 ? sequenceIndex % sequenceLength : 0;
    telemetrySequenceLength.store(sequenceLength, std::memory_order_relaxed);
}

double Arpeggiator::baseStepSamples(double tempoBpm, int rate) const noexcept
{
    tempoBpm = juce::jlimit(20.0, 400.0, tempoBpm);
    const auto quarterSamples = sampleRate * 60.0 / tempoBpm;
    static constexpr std::array<double, 4> beatLengths { 1.0, 0.5, 0.25, 0.125 };
    return quarterSamples * beatLengths[static_cast<std::size_t>(juce::jlimit(0, 3, rate))];
}

double Arpeggiator::nextStepSamples(double tempoBpm, const Settings& settings)
{
    const auto base = baseStepSamples(tempoBpm, settings.rate);
    const auto swing = juce::jlimit(0.0f, 0.75f, settings.swing);
    if (swing <= 0.0001f)
        return base;

    const auto multiplier = swingLongStep
        ? (1.0 + static_cast<double>(swing) * 0.5)
        : (1.0 - static_cast<double>(swing) * 0.5);
    swingLongStep = ! swingLongStep;
    return juce::jmax(1.0, base * multiplier);
}

void Arpeggiator::stopCurrentNote(int samplePosition, juce::MidiBuffer& output)
{
    if (currentNote < 0)
        return;

    output.addEvent(juce::MidiMessage::noteOff(1, currentNote), juce::jmax(0, samplePosition));
    currentNote = -1;
    telemetryCurrentNote.store(-1, std::memory_order_relaxed);
}

juce::var Arpeggiator::getTelemetry() const
{
    auto* object = new juce::DynamicObject();
    object->setProperty("heldNotes", heldNoteCount.load(std::memory_order_relaxed));
    object->setProperty("currentNote", telemetryCurrentNote.load(std::memory_order_relaxed));
    object->setProperty("step", telemetryStep.load(std::memory_order_relaxed));
    object->setProperty("sequenceLength", telemetrySequenceLength.load(std::memory_order_relaxed));
    return juce::var(object);
}
}
