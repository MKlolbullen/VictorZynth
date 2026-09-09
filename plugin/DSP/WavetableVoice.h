#pragma once

#include "ModulationEngine.h"
#include "WavetableBank.h"
#include "../Parameters/Parameters.h"

#include <array>
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
                   juce::AudioProcessorValueTreeState& state,
                   const ModulationEngine& modulation,
                   std::atomic<double>& monoFrequencyMemory);

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
    struct OscParameters
    {
        std::atomic<float>* table = nullptr;
        std::atomic<float>* position = nullptr;
        std::atomic<float>* octave = nullptr;
        std::atomic<float>* semitone = nullptr;
        std::atomic<float>* fine = nullptr;
        std::atomic<float>* warpMode = nullptr;
        std::atomic<float>* warpAmount = nullptr;
        std::atomic<float>* unison = nullptr;
        std::atomic<float>* detune = nullptr;
        std::atomic<float>* pan = nullptr;
        std::atomic<float>* level = nullptr;
        std::atomic<float>* enabled = nullptr;
        std::atomic<float>* phase = nullptr;
    };

    const WavetableBank& wavetableBank;
    juce::AudioProcessorValueTreeState& parameterState;
    const ModulationEngine& modulationEngine;
    std::atomic<double>& sharedMonoFrequency;
    juce::ADSR ampEnvelope;
    juce::Random random;

    OscParameters osc1;
    OscParameters osc2;
    std::array<double, 7> phases1 {};
    std::array<double, 7> phases2 {};
    double subPhase = 0.0;
    double currentFrequency = 440.0;
    double targetFrequency = 440.0;
    float noteVelocity = 0.0f;
    float pitchWheelSemitones = 0.0f;
    float pinkNoiseState = 0.0f;

    std::atomic<float>* subWaveform = nullptr;
    std::atomic<float>* subOctave = nullptr;
    std::atomic<float>* subLevel = nullptr;
    std::atomic<float>* subEnabled = nullptr;
    std::atomic<float>* noiseType = nullptr;
    std::atomic<float>* noiseLevel = nullptr;
    std::atomic<float>* noiseEnabled = nullptr;
    std::atomic<float>* envAttack = nullptr;
    std::atomic<float>* envDecay = nullptr;
    std::atomic<float>* envSustain = nullptr;
    std::atomic<float>* envRelease = nullptr;
    std::atomic<float>* glide = nullptr;
    std::atomic<float>* polyphony = nullptr;

    static double tuningRatio(float octave,
                              float semitone,
                              float fineCents,
                              float bendSemitones) noexcept;
    static double warpPhase(double phase, int mode, float amount) noexcept;
    static float fold(float sample, float amount) noexcept;
    static std::array<float, 2> panGains(float pan) noexcept;
    static float subSample(int waveform, double phase) noexcept;
    void bindOscillator(OscParameters& osc, bool first);
    void updateEnvelope();
    std::array<float, 2> renderOscillator(OscParameters& osc,
                                          std::array<double, 7>& phases,
                                          double baseHz,
                                          ModulationEngine::Destination pitchDestination,
                                          ModulationEngine::Destination positionDestination,
                                          ModulationEngine::Destination warpDestination,
                                          ModulationEngine::Destination phaseDestination,
                                          ModulationEngine::Destination levelDestination);
};
}
