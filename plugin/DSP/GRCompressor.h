#pragma once

#include <atomic>
#include <cmath>
#include <juce_audio_basics/juce_audio_basics.h>

namespace aetherwave::dsp
{
class GRCompressor final
{
public:
    static constexpr float kneeWidthDb = 6.0f;

    void prepare(double sampleRate)
    {
        sr = sampleRate;
        envDb = 0.0f;
        currentGrDb.store(0.0f, std::memory_order_relaxed);
        updateTimeConstants();
    }

    void reset() noexcept
    {
        envDb = 0.0f;
        currentGrDb.store(0.0f, std::memory_order_relaxed);
    }

    void setParameters(float thresholdDb_, float ratio_,
                       float attackMs_, float releaseMs_, float makeupDb_)
    {
        thresholdDb = thresholdDb_;
        ratio = juce::jmax(1.0f, ratio_);
        makeupDb = makeupDb_;

        if (! juce::approximatelyEqual(attackMs, attackMs_)
            || ! juce::approximatelyEqual(releaseMs, releaseMs_))
        {
            attackMs = attackMs_;
            releaseMs = releaseMs_;
            updateTimeConstants();
        }
    }

    static float gainReductionFor(float levelDb, float threshold, float ratioValue)
    {
        const auto slope = 1.0f - 1.0f / juce::jmax(1.0f, ratioValue);
        const auto diff = levelDb - threshold;

        if (diff <= -kneeWidthDb * 0.5f)
            return 0.0f;
        if (diff >= kneeWidthDb * 0.5f)
            return slope * diff;

        const auto t = diff + kneeWidthDb * 0.5f;
        return slope * t * t / (2.0f * kneeWidthDb);
    }

    void process(juce::AudioBuffer<float>& buffer)
    {
        if (buffer.getNumChannels() == 0)
            return;

        const auto numSamples = buffer.getNumSamples();
        auto* left = buffer.getWritePointer(0);
        auto* right = buffer.getNumChannels() > 1 ? buffer.getWritePointer(1) : nullptr;
        const auto makeupGain = juce::Decibels::decibelsToGain(makeupDb);
        auto maxGr = 0.0f;

        for (int i = 0; i < numSamples; ++i)
        {
            auto level = std::abs(left[i]);
            if (right != nullptr)
                level = juce::jmax(level, std::abs(right[i]));

            const auto levelDb = juce::Decibels::gainToDecibels(level, -80.0f);
            const auto targetGr = gainReductionFor(levelDb, thresholdDb, ratio);
            const auto coeff = targetGr > envDb ? attackCoeff : releaseCoeff;
            envDb += coeff * (targetGr - envDb);

            const auto gain = juce::Decibels::decibelsToGain(-envDb) * makeupGain;
            left[i] *= gain;
            if (right != nullptr)
                right[i] *= gain;

            maxGr = juce::jmax(maxGr, envDb);
        }

        currentGrDb.store(maxGr, std::memory_order_relaxed);
    }

    float getGainReductionDb() const noexcept
    {
        return currentGrDb.load(std::memory_order_relaxed);
    }

private:
    void updateTimeConstants()
    {
        if (sr <= 0.0)
            return;

        attackCoeff = 1.0f - std::exp(-1.0f / static_cast<float>(sr * attackMs * 0.001));
        releaseCoeff = 1.0f - std::exp(-1.0f / static_cast<float>(sr * releaseMs * 0.001));
    }

    double sr = 0.0;
    float thresholdDb = -18.0f;
    float ratio = 3.0f;
    float makeupDb = 0.0f;
    float attackMs = 10.0f;
    float releaseMs = 150.0f;
    float attackCoeff = 1.0f;
    float releaseCoeff = 1.0f;
    float envDb = 0.0f;
    std::atomic<float> currentGrDb { 0.0f };
};
}
