#pragma once

#include <array>
#include <atomic>

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_core/juce_core.h>

namespace aetherwave::dsp
{
class Arpeggiator
{
public:
    struct Settings
    {
        bool enabled = false;
        int mode = 0; // 0 up, 1 down, 2 up-down, 3 down-up
        int rate = 2; // 0 1/4, 1 1/8, 2 1/16, 3 1/32
        int octaves = 1;
        float gate = 0.72f;
        bool latch = false;
        float swing = 0.0f;
        bool retrigger = true;
    };

    void prepare(double newSampleRate);
    void reset();

    void process(const juce::MidiBuffer& input,
                 juce::MidiBuffer& output,
                 int numSamples,
                 double tempoBpm,
                 const Settings& settings);

    juce::var getTelemetry() const;

private:
    void clearHeldNotes();
    void reconcileHeldNotesWithPhysical();
    void rebuildSequence(const Settings& settings);
    double baseStepSamples(double tempoBpm, int rate) const noexcept;
    double nextStepSamples(double tempoBpm, const Settings& settings);
    void stopCurrentNote(int samplePosition, juce::MidiBuffer& output);

    double sampleRate = 48000.0;
    std::array<bool, 128> heldNotes {};
    std::array<bool, 128> physicalNotes {};
    std::array<float, 128> noteVelocities {};
    std::array<int, 512> sequence {};
    std::array<float, 512> sequenceVelocities {};
    int sequenceLength = 0;
    int sequenceIndex = 0;
    int currentNote = -1;
    double samplesUntilNextStep = 0.0;
    double samplesUntilGateOff = 1.0e18;
    bool swingLongStep = false;
    bool lastLatch = false;
    int lastMode = -1;
    int lastOctaves = -1;

    std::atomic<int> heldNoteCount { 0 };
    std::atomic<int> telemetryCurrentNote { -1 };
    std::atomic<int> telemetryStep { 0 };
    std::atomic<int> telemetrySequenceLength { 0 };
};
}
