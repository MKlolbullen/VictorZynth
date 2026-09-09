#pragma once

#include <atomic>
#include <cmath>
#include <juce_dsp/juce_dsp.h>

namespace aetherwave::dsp
{
class LoudnessMeter final
{
public:
    void prepare(double sampleRate, int numChannels)
    {
        channels = juce::jlimit(1, 2, numChannels);

        using Coeffs = juce::dsp::IIR::Coefficients<float>;
        auto shelfCoeffs = Coeffs::makeHighShelf(sampleRate, 1681.97, 0.7071f,
                                                  juce::Decibels::decibelsToGain(4.0f));
        auto hpCoeffs = Coeffs::makeHighPass(sampleRate, 38.13, 0.5f);

        for (int ch = 0; ch < 2; ++ch)
        {
            shelf[ch].coefficients = shelfCoeffs;
            highPass[ch].coefficients = hpCoeffs;
            shelf[ch].reset();
            highPass[ch].reset();
            meanSquare[ch] = 0.0f;
        }

        smoothing = 1.0f - std::exp(-1.0f / static_cast<float>(0.4 * sampleRate));
        lufs.store(-70.0f, std::memory_order_relaxed);
    }

    void reset() noexcept
    {
        for (int ch = 0; ch < 2; ++ch)
        {
            shelf[ch].reset();
            highPass[ch].reset();
            meanSquare[ch] = 0.0f;
        }
        lufs.store(-70.0f, std::memory_order_relaxed);
    }

    void process(const juce::AudioBuffer<float>& buffer)
    {
        double sum = 0.0;
        const auto availableChannels = juce::jmin(channels, buffer.getNumChannels());

        for (int ch = 0; ch < availableChannels; ++ch)
        {
            const auto* data = buffer.getReadPointer(ch);
            auto ms = meanSquare[ch];

            for (int i = 0; i < buffer.getNumSamples(); ++i)
            {
                const auto weighted = highPass[ch].processSample(shelf[ch].processSample(data[i]));
                ms += smoothing * (weighted * weighted - ms);
            }

            meanSquare[ch] = ms;
            sum += ms;
        }

        lufs.store(sum > 1.0e-10 ? static_cast<float>(-0.691 + 10.0 * std::log10(sum)) : -70.0f,
                   std::memory_order_relaxed);
    }

    float getMomentaryLufs() const noexcept
    {
        return lufs.load(std::memory_order_relaxed);
    }

private:
    int channels = 2;
    juce::dsp::IIR::Filter<float> shelf[2];
    juce::dsp::IIR::Filter<float> highPass[2];
    float meanSquare[2] {};
    float smoothing = 0.001f;
    std::atomic<float> lufs { -70.0f };
};
}
