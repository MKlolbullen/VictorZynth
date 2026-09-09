#pragma once

#include "ModulationEngine.h"
#include "../Parameters/Parameters.h"

#include <array>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>

namespace aetherwave::dsp
{
class EffectsChain final
{
public:
    EffectsChain(juce::AudioProcessorValueTreeState& state, const ModulationEngine& modulation);

    void prepare(double sampleRate, int maximumBlockSize, int channels);
    void reset();
    void process(juce::AudioBuffer<float>& buffer);

private:
    using Filter = juce::dsp::ProcessorDuplicator<juce::dsp::IIR::Filter<float>, juce::dsp::IIR::Coefficients<float>>;
    using Delay = juce::dsp::DelayLine<float, juce::dsp::DelayLineInterpolationTypes::Linear>;

    juce::AudioProcessorValueTreeState& parameterState;
    const ModulationEngine& modulationEngine;
    double currentSampleRate = 48000.0;

    Filter filter1;
    Filter filter2;
    juce::dsp::Chorus<float> chorus;
    Delay delay { 384000 };
    juce::Reverb reverb;
    juce::dsp::Limiter<float> limiter;
    std::array<float, 2> delayToneState { 0.0f, 0.0f };

    float parameter(const char* id, float fallback = 0.0f) const noexcept;
    void updateFilter();
    void processDelay(juce::AudioBuffer<float>& buffer);
    void processReverb(juce::AudioBuffer<float>& buffer);
    void processDriveAndMaster(juce::AudioBuffer<float>& buffer);
};
}
