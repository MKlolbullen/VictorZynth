#pragma once

#include "WavetableBank.h"
#include "../Parameters/Parameters.h"

#include <atomic>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_processors/juce_audio_processors.h>

namespace aetherwave::dsp
{
class WavetableSound final : public juce::SynthesiserSound
{
public:
    bool appliesToNote(int) override { return true; }
    bool appliesToChannel(int) override { return true; }
};

class WavetableVoice final : public juce::SynthesiserVoice
{
public:
    WavetableVoice(const WavetableBank& bank,
                   juce::AudioProcessorValueTreeState& state);

    bool canPlaySound(juce::SynthesiserSound* sound) override;
    void startNote(int midiNoteNumber,
                   float velocity,
                   juce::SynthesiserSound*,
                   int currentPitchWheelPosition) override;
    void stopNote(float velocity, bool allowTailOff) override;
    void pitchWheelMoved(int newPitchWheelValue) override;
    void controllerMoved(int controllerNumber, int newControllerValue) override;
    void renderNextBlock(juce::AudioBuffer<float>& outputBuffer,
                         int startSample,
                         int numSamples) override;

private:
    const WavetableBank& wavetableBank;
    juce::AudioProcessorValueTreeState& parameterState;
    juce::ADSR ampEnvelope;

    double phase1 = 0.0;
    double phase2 = 0.0;
    double baseFrequency = 440.0;
    float noteVelocity = 0.0f;
    float pitchWheelSemitones = 0.0f;

    std::atomic<float>* osc1Table = nullptr;
    std::atomic<float>* osc1Position = nullptr;
    std::atomic<float>* osc1Octave = nullptr;
    std::atomic<float>* osc1Semitone = nullptr;
    std::atomic<float>* osc1Fine = nullptr;
    std::atomic<float>* osc1Level = nullptr;

    std::atomic<float>* osc2Table = nullptr;
    std::atomic<float>* osc2Position = nullptr;
    std::atomic<float>* osc2Octave = nullptr;
    std::atomic<float>* osc2Semitone = nullptr;
    std::atomic<float>* osc2Fine = nullptr;
    std::atomic<float>* osc2Level = nullptr;

    std::atomic<float>* envAttack = nullptr;
    std::atomic<float>* envDecay = nullptr;
    std::atomic<float>* envSustain = nullptr;
    std::atomic<float>* envRelease = nullptr;
    std::atomic<float>* masterVolume = nullptr;

    static double tuningRatio(float octave,
                              float semitone,
                              float fineCents,
                              float bendSemitones) noexcept;
    void updateEnvelope();
};
}
