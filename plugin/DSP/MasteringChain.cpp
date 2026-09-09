#include "MasteringChain.h"

#include <algorithm>
#include <cmath>

namespace aetherwave::dsp
{
MasteringChain::MasteringChain(juce::AudioProcessorValueTreeState& state)
    : parameterState(state)
{
    spectrumBins.fill(-100.0f);
}

float MasteringChain::parameter(const char* id, float fallback) const noexcept
{
    if (const auto* raw = parameterState.getRawParameterValue(id))
        return raw->load(std::memory_order_relaxed);
    return fallback;
}

bool MasteringChain::enabled(const char* id, bool fallback) const noexcept
{
    return parameter(id, fallback ? 1.0f : 0.0f) >= 0.5f;
}

void MasteringChain::prepare(double sampleRate, int maximumBlockSize, int channels)
{
    currentSampleRate = sampleRate > 0.0 ? sampleRate : 48000.0;
    const juce::dsp::ProcessSpec spec {
        currentSampleRate,
        static_cast<juce::uint32>(juce::jmax(1, maximumBlockSize)),
        static_cast<juce::uint32>(juce::jmax(1, channels))
    };

    inputGain.prepare(spec);
    outputGain.prepare(spec);
    inputGain.setRampDurationSeconds(0.02);
    outputGain.setRampDurationSeconds(0.02);

    updateEqCoefficients(true);
    for (auto* band : { &hpf, &lowShelf, &peak1, &peak2, &highShelf })
        band->prepare(spec);

    compressor.prepare(currentSampleRate);
    limiter.prepare(spec);
    loudness.prepare(currentSampleRate, channels);
    reset();
}

void MasteringChain::reset()
{
    inputGain.reset();
    outputGain.reset();
    hpf.reset();
    lowShelf.reset();
    peak1.reset();
    peak2.reset();
    highShelf.reset();
    compressor.reset();
    limiter.reset();
    loudness.reset();
    fftData.fill(0.0f);
    spectrumBins.fill(-100.0f);
    inLevelDb.store(-100.0f, std::memory_order_relaxed);
    outLevelDb.store(-100.0f, std::memory_order_relaxed);
    gainReductionDb.store(0.0f, std::memory_order_relaxed);
}

float MasteringChain::meterLevelDb(const juce::AudioBuffer<float>& buffer) noexcept
{
    auto rms = 0.0f;
    for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
        rms = juce::jmax(rms, buffer.getRMSLevel(ch, 0, buffer.getNumSamples()));
    return juce::Decibels::gainToDecibels(rms, -100.0f);
}

void MasteringChain::updateEqCoefficients(bool force)
{
    const std::array<float, 11> current {
        parameter(aetherwave::parameters::studioHpfFreq, 20.0f),
        parameter(aetherwave::parameters::studioLowShelfFreq, 120.0f),
        parameter(aetherwave::parameters::studioLowShelfGainDb, 0.0f),
        parameter(aetherwave::parameters::studioPeak1Freq, 500.0f),
        parameter(aetherwave::parameters::studioPeak1GainDb, 0.0f),
        parameter(aetherwave::parameters::studioPeak1Q, 0.9f),
        parameter(aetherwave::parameters::studioPeak2Freq, 3000.0f),
        parameter(aetherwave::parameters::studioPeak2GainDb, 0.0f),
        parameter(aetherwave::parameters::studioPeak2Q, 0.9f),
        parameter(aetherwave::parameters::studioHighShelfFreq, 8000.0f),
        parameter(aetherwave::parameters::studioHighShelfGainDb, 0.0f)
    };

    if (! force && current == lastEqParams)
        return;

    lastEqParams = current;
    using Coeffs = juce::dsp::IIR::Coefficients<float>;
    const auto maxFreq = static_cast<float>(currentSampleRate * 0.45);
    const auto clampFreq = [maxFreq](float value) { return juce::jlimit(10.0f, maxFreq, value); };
    const auto gain = [](float db) { return juce::Decibels::decibelsToGain(db); };

    *hpf.state = *Coeffs::makeHighPass(currentSampleRate, clampFreq(current[0]));
    *lowShelf.state = *Coeffs::makeLowShelf(currentSampleRate, clampFreq(current[1]), 0.707f, gain(current[2]));
    *peak1.state = *Coeffs::makePeakFilter(currentSampleRate, clampFreq(current[3]), current[5], gain(current[4]));
    *peak2.state = *Coeffs::makePeakFilter(currentSampleRate, clampFreq(current[6]), current[8], gain(current[7]));
    *highShelf.state = *Coeffs::makeHighShelf(currentSampleRate, clampFreq(current[9]), 0.707f, gain(current[10]));
}

void MasteringChain::process(juce::AudioBuffer<float>& buffer)
{
    if (buffer.getNumSamples() == 0 || buffer.getNumChannels() == 0)
        return;

    const auto studioOn = enabled(aetherwave::parameters::studioEnabled, false);

    if (studioOn)
    {
        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> context(block);

        inputGain.setGainDecibels(parameter(aetherwave::parameters::studioInputGainDb, 0.0f));
        inputGain.process(context);
        inLevelDb.store(meterLevelDb(buffer), std::memory_order_relaxed);

        if (enabled(aetherwave::parameters::studioEqEnabled, true))
        {
            updateEqCoefficients();
            hpf.process(context);
            lowShelf.process(context);
            peak1.process(context);
            peak2.process(context);
            highShelf.process(context);
        }

        if (enabled(aetherwave::parameters::studioCompEnabled, true))
        {
            compressor.setParameters(
                parameter(aetherwave::parameters::studioCompThresholdDb, -18.0f),
                parameter(aetherwave::parameters::studioCompRatio, 3.0f),
                parameter(aetherwave::parameters::studioCompAttackMs, 10.0f),
                parameter(aetherwave::parameters::studioCompReleaseMs, 150.0f),
                parameter(aetherwave::parameters::studioCompMakeupDb, 0.0f));
            compressor.process(buffer);
            gainReductionDb.store(compressor.getGainReductionDb(), std::memory_order_relaxed);
        }
        else
        {
            gainReductionDb.store(0.0f, std::memory_order_relaxed);
        }

        if (enabled(aetherwave::parameters::studioLimiterEnabled, true))
        {
            limiter.setThreshold(parameter(aetherwave::parameters::studioLimiterCeilingDb, -1.0f));
            limiter.setRelease(parameter(aetherwave::parameters::studioLimiterReleaseMs, 100.0f));
            limiter.process(context);
        }

        outputGain.setGainDecibels(parameter(aetherwave::parameters::studioOutputGainDb, 0.0f));
        outputGain.process(context);
    }
    else
    {
        inLevelDb.store(meterLevelDb(buffer), std::memory_order_relaxed);
        gainReductionDb.store(0.0f, std::memory_order_relaxed);
    }

    outLevelDb.store(meterLevelDb(buffer), std::memory_order_relaxed);
    spectrum.push(buffer);
    loudness.process(buffer);
}

void MasteringChain::rebuildSpectrum()
{
    if (! spectrum.pull(fftData.data()))
        return;

    std::fill(fftData.begin() + SpectrumSource::fftSize, fftData.end(), 0.0f);
    window.multiplyWithWindowingTable(fftData.data(), SpectrumSource::fftSize);
    fft.performFrequencyOnlyForwardTransform(fftData.data());

    const auto nyquist = static_cast<float>(currentSampleRate * 0.5);
    const auto maxFrequency = juce::jmin(20000.0f, nyquist * 0.98f);
    const auto minFrequency = 20.0f;

    for (std::size_t i = 0; i < spectrumBins.size(); ++i)
    {
        const auto norm = static_cast<float>(i) / static_cast<float>(spectrumBins.size() - 1);
        const auto frequency = minFrequency * std::pow(maxFrequency / minFrequency, norm);
        const auto bin = juce::jlimit(1, SpectrumSource::fftSize / 2 - 1,
            static_cast<int>(std::lround(frequency * SpectrumSource::fftSize / currentSampleRate)));
        const auto magnitude = fftData[static_cast<std::size_t>(bin)] / static_cast<float>(SpectrumSource::fftSize);
        spectrumBins[i] = juce::Decibels::gainToDecibels(magnitude, -100.0f);
    }
}

juce::var MasteringChain::getTelemetry()
{
    rebuildSpectrum();

    auto* object = new juce::DynamicObject();
    object->setProperty("inLevelDb", inLevelDb.load(std::memory_order_relaxed));
    object->setProperty("outLevelDb", outLevelDb.load(std::memory_order_relaxed));
    object->setProperty("gainReductionDb", gainReductionDb.load(std::memory_order_relaxed));
    object->setProperty("lufs", loudness.getMomentaryLufs());

    juce::Array<juce::var> bins;
    bins.ensureStorageAllocated(static_cast<int>(spectrumBins.size()));
    for (const auto value : spectrumBins)
        bins.add(value);
    object->setProperty("spectrumDb", juce::var(bins));

    return juce::var(object);
}
}
