#pragma once

#include "GRCompressor.h"
#include "LoudnessMeter.h"
#include "SpectrumSource.h"
#include "../Parameters/Parameters.h"

#include <array>
#include <atomic>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>

namespace aetherwave::dsp
{
class MasteringChain final
{
public:
    explicit MasteringChain(juce::AudioProcessorValueTreeState& state);

    void prepare(double sampleRate, int maximumBlockSize, int channels);
    void reset();
    void process(juce::AudioBuffer<float>& buffer);
    juce::var getTelemetry();

private:
    using Band = juce::dsp::ProcessorDuplicator<juce::dsp::IIR::Filter<float>,
                                                juce::dsp::IIR::Coefficients<float>>;

    juce::AudioProcessorValueTreeState& parameterState;
    double currentSampleRate = 48000.0;

    juce::dsp::Gain<float> inputGain;
    juce::dsp::Gain<float> outputGain;
    Band hpf;
    Band lowShelf;
    Band peak1;
    Band peak2;
    Band highShelf;
    GRCompressor compressor;
    juce::dsp::Limiter<float> limiter;
    LoudnessMeter loudness;
    SpectrumSource spectrum;

    juce::dsp::FFT fft { SpectrumSource::fftOrder };
    juce::dsp::WindowingFunction<float> window {
        SpectrumSource::fftSize,
        juce::dsp::WindowingFunction<float>::hann,
        true
    };
    std::array<float, SpectrumSource::fftSize * 2> fftData {};
    std::array<float, 96> spectrumBins {};
    std::array<float, 11> lastEqParams {};

    std::atomic<float> inLevelDb { -100.0f };
    std::atomic<float> outLevelDb { -100.0f };
    std::atomic<float> gainReductionDb { 0.0f };

    float parameter(const char* id, float fallback = 0.0f) const noexcept;
    bool enabled(const char* id, bool fallback = false) const noexcept;
    void updateEqCoefficients(bool force = false);
    void rebuildSpectrum();
    static float meterLevelDb(const juce::AudioBuffer<float>& buffer) noexcept;
};
}
