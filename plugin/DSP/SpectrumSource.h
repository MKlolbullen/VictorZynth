#pragma once

#include <array>
#include <atomic>
#include <cstring>
#include <juce_audio_basics/juce_audio_basics.h>

namespace aetherwave::dsp
{
class SpectrumSource final
{
public:
    static constexpr int fftOrder = 11;
    static constexpr int fftSize = 1 << fftOrder;

    void push(const juce::AudioBuffer<float>& buffer)
    {
        if (buffer.getNumChannels() == 0)
            return;

        const auto* left = buffer.getReadPointer(0);
        const auto* right = buffer.getNumChannels() > 1 ? buffer.getReadPointer(1) : nullptr;

        for (int i = 0; i < buffer.getNumSamples(); ++i)
        {
            fifo[static_cast<std::size_t>(index++)] = right != nullptr
                ? 0.5f * (left[i] + right[i])
                : left[i];

            if (index == fftSize)
            {
                index = 0;
                if (! blockReady.load(std::memory_order_acquire))
                {
                    std::memcpy(snapshot.data(), fifo.data(), sizeof(float) * fftSize);
                    blockReady.store(true, std::memory_order_release);
                }
            }
        }
    }

    bool pull(float* dest)
    {
        if (! blockReady.load(std::memory_order_acquire))
            return false;

        std::memcpy(dest, snapshot.data(), sizeof(float) * fftSize);
        blockReady.store(false, std::memory_order_release);
        return true;
    }

private:
    std::array<float, fftSize> fifo {};
    std::array<float, fftSize> snapshot {};
    int index = 0;
    std::atomic<bool> blockReady { false };
};
}
