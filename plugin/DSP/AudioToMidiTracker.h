#pragma once

#include <array>
#include <atomic>

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_core/juce_core.h>

namespace aetherwave::dsp
{
class AudioToMidiTracker
{
public:
    struct Settings
    {
        bool enabled = false;
        float gateDb = -45.0f;
        float minFrequency = 65.0f;
        float maxFrequency = 1200.0f;
        float minConfidence = 0.72f;
        int smoothingFrames = 2;
        float velocitySensitivity = 0.75f;
        int scale = 0; // 0 chromatic, 1 major, 2 minor
        int root = 0;  // C = 0 ... B = 11
        bool retriggerOnOnset = true;
    };

    void prepare(double newSampleRate);
    void reset();

    void process(const juce::AudioBuffer<float>& buffer,
                 int inputChannels,
                 juce::MidiBuffer& generatedMidi,
                 const Settings& settings);

    juce::var getTelemetry() const;

private:
    static constexpr int analysisWindowSize = 1024;
    static constexpr int analysisHopSize = 128;
    static constexpr int displaySize = 128;

    void pushAnalysisSample(float sample);
    void analyseFrame(const Settings& settings, int samplePosition, juce::MidiBuffer& midi);
    void closeActiveNote(int samplePosition, juce::MidiBuffer& midi);
    void openNote(int note, float velocity, int samplePosition, juce::MidiBuffer& midi);
    int quantizeNote(float midiNote, int scale, int root) const noexcept;
    float velocityForLevel(float levelDb, const Settings& settings) const noexcept;
    static juce::String midiNoteName(int note);

    double sampleRate = 48000.0;
    double analysisRate = 12000.0;
    int decimationFactor = 4;
    int decimationCount = 0;
    float decimationAccumulator = 0.0f;

    std::array<float, analysisWindowSize> ring {};
    std::array<float, analysisWindowSize> linearWindow {};
    std::array<float, analysisWindowSize / 2 + 2> difference {};
    std::array<float, analysisWindowSize / 2 + 2> cmnd {};
    int ringWriteIndex = 0;
    int ringFill = 0;
    int samplesSinceAnalysis = 0;

    float levelEnvelope = 0.0f;
    float previousAnalysisEnvelope = 0.0f;
    int candidateNote = -1;
    int candidateFrames = 0;
    int silenceFrames = 0;
    int activeNote = -1;
    int framesSinceNoteOn = 0;

    std::array<std::atomic<float>, displaySize> displayWaveform {};
    std::atomic<int> displayWriteIndex { 0 };
    std::atomic<float> inputDb { -100.0f };
    std::atomic<float> detectedFrequency { 0.0f };
    std::atomic<float> detectedConfidence { 0.0f };
    std::atomic<float> onsetStrength { 0.0f };
    std::atomic<int> detectedMidiNote { -1 };
    std::atomic<bool> gateOpen { false };
};
}
