#include "EffectsChain.h"

#include <algorithm>
#include <cmath>

namespace aetherwave::dsp
{
EffectsChain::EffectsChain(juce::AudioProcessorValueTreeState& state,
                           const ModulationEngine& modulation)
    : parameterState(state), modulationEngine(modulation)
{
}

float EffectsChain::parameter(const char* id, float fallback) const noexcept
{
    if (const auto* raw = parameterState.getRawParameterValue(id))
        return raw->load(std::memory_order_relaxed);
    return fallback;
}

void EffectsChain::prepare(double sampleRate, int maximumBlockSize, int channels)
{
    currentSampleRate = sampleRate > 0.0 ? sampleRate : 48000.0;
    const juce::dsp::ProcessSpec spec {
        currentSampleRate,
        static_cast<juce::uint32>(std::max(1, maximumBlockSize)),
        static_cast<juce::uint32>(std::max(1, channels))
    };

    filter1.prepare(spec);
    filter2.prepare(spec);
    chorus.prepare(spec);
    delay.prepare(spec);
    limiter.prepare(spec);
    reverb.setSampleRate(currentSampleRate);

    chorus.setCentreDelay(18.0f);
    limiter.setThreshold(-0.5f);
    limiter.setRelease(100.0f);
    reset();
}

void EffectsChain::reset()
{
    filter1.reset();
    filter2.reset();
    chorus.reset();
    delay.reset();
    limiter.reset();
    reverb.reset();
    delayToneState = { 0.0f, 0.0f };
}

void EffectsChain::updateFilter()
{
    const auto modCutoff = modulationEngine.getDestination(ModulationEngine::Destination::filterCutoff);
    const auto modRes = modulationEngine.getDestination(ModulationEngine::Destination::filterResonance);
    const auto cutoff = juce::jlimit(20.0f, static_cast<float>(currentSampleRate * 0.45),
        parameter(aetherwave::parameters::filterCutoff, 2800.0f) * std::pow(2.0f, modCutoff * 4.0f));
    const auto resonance = juce::jlimit(0.1f, 18.0f,
        parameter(aetherwave::parameters::filterResonance, 3.5f) + modRes * 5.0f);
    const auto q = juce::jlimit(0.1f, 10.0f, 0.45f + resonance * 0.35f);
    const auto type = static_cast<int>(std::lround(parameter(aetherwave::parameters::filterType)));

    juce::dsp::IIR::Coefficients<float>::Ptr coefficients;
    switch (type)
    {
        case 2: coefficients = juce::dsp::IIR::Coefficients<float>::makeBandPass(currentSampleRate, cutoff, q); break;
        case 3: coefficients = juce::dsp::IIR::Coefficients<float>::makeHighPass(currentSampleRate, cutoff, q); break;
        case 4:
        case 5: coefficients = juce::dsp::IIR::Coefficients<float>::makeNotch(currentSampleRate, cutoff, q); break;
        default: coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass(currentSampleRate, cutoff, q); break;
    }

    *filter1.state = *coefficients;
    *filter2.state = *coefficients;
}

void EffectsChain::processDelay(juce::AudioBuffer<float>& buffer)
{
    if (parameter(aetherwave::parameters::delayEnabled, 1.0f) < 0.5f || buffer.getNumChannels() < 1)
        return;

    const auto modMix = modulationEngine.getDestination(ModulationEngine::Destination::delayMix);
    const auto modTime = modulationEngine.getDestination(ModulationEngine::Destination::delayTime);
    const auto mix = juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::delayMix, 0.35f) + modMix * 0.5f);
    const auto feedback = juce::jlimit(0.0f, 0.95f, parameter(aetherwave::parameters::delayFeedback, 0.55f));
    const auto timeSeconds = juce::jlimit(0.01f, 1.9f,
        parameter(aetherwave::parameters::delayTime, 0.45f) * std::pow(2.0f, modTime));
    delay.setDelay(timeSeconds * static_cast<float>(currentSampleRate));

    const auto tone = juce::jlimit(200.0f, 10000.0f, parameter(aetherwave::parameters::delayTone, 3200.0f));
    const auto alpha = 1.0f - std::exp(-juce::MathConstants<float>::twoPi * tone / static_cast<float>(currentSampleRate));
    const auto pingPong = parameter(aetherwave::parameters::delayPingPong, 1.0f) >= 0.5f;
    const auto channels = buffer.getNumChannels();

    for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
    {
        const auto inL = buffer.getSample(0, sample);
        const auto inR = channels > 1 ? buffer.getSample(1, sample) : inL;
        const auto delayedL = delay.popSample(0);
        const auto delayedR = channels > 1 ? delay.popSample(1) : delayedL;

        delayToneState[0] += alpha * (delayedL - delayToneState[0]);
        delayToneState[1] += alpha * (delayedR - delayToneState[1]);

        const auto feedbackL = pingPong ? delayToneState[1] : delayToneState[0];
        const auto feedbackR = pingPong ? delayToneState[0] : delayToneState[1];
        delay.pushSample(0, inL + feedbackL * feedback);
        if (channels > 1)
            delay.pushSample(1, inR + feedbackR * feedback);

        buffer.setSample(0, sample, inL * (1.0f - mix) + delayedL * mix);
        if (channels > 1)
            buffer.setSample(1, sample, inR * (1.0f - mix) + delayedR * mix);
    }
}

void EffectsChain::processReverb(juce::AudioBuffer<float>& buffer)
{
    if (parameter(aetherwave::parameters::reverbEnabled, 1.0f) < 0.5f || buffer.getNumChannels() < 1)
        return;

    const auto modMix = modulationEngine.getDestination(ModulationEngine::Destination::reverbMix);
    const auto mix = juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::reverbMix, 0.45f) + modMix * 0.5f);
    const auto decay = parameter(aetherwave::parameters::reverbDecay, 6.5f);
    const auto size = juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::reverbSize, 0.85f));
    const auto damping = juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::reverbDamp, 0.3f));
    const auto shimmer = juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::reverbShimmer, 0.45f));

    juce::Reverb::Parameters params;
    params.roomSize = juce::jlimit(0.0f, 1.0f, size * 0.75f + juce::jmap(decay, 0.5f, 15.0f, 0.0f, 0.25f));
    params.damping = juce::jlimit(0.0f, 1.0f, damping * (1.0f - shimmer * 0.35f));
    params.wetLevel = mix;
    params.dryLevel = 1.0f - mix * 0.65f;
    params.width = 1.0f;
    reverb.setParameters(params);

    if (buffer.getNumChannels() > 1)
        reverb.processStereo(buffer.getWritePointer(0), buffer.getWritePointer(1), buffer.getNumSamples());
    else
        reverb.processMono(buffer.getWritePointer(0), buffer.getNumSamples());
}

void EffectsChain::processDriveAndMaster(juce::AudioBuffer<float>& buffer)
{
    const auto drive = juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::masterDrive, 0.15f));
    const auto volume = juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::masterVolume, 0.8f));
    const auto gain = 1.0f + drive * 8.0f;

    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        auto* samples = buffer.getWritePointer(channel);
        for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
            samples[sample] = std::tanh(samples[sample] * gain) * volume;
    }

    if (parameter(aetherwave::parameters::masterLimiter, 1.0f) >= 0.5f)
    {
        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> context(block);
        limiter.process(context);
    }
}

void EffectsChain::process(juce::AudioBuffer<float>& buffer)
{
    if (buffer.getNumSamples() == 0)
        return;

    if (parameter(aetherwave::parameters::filterEnabled, 1.0f) >= 0.5f)
    {
        const auto modDrive = modulationEngine.getDestination(ModulationEngine::Destination::filterDrive);
        const auto drive = juce::jlimit(0.0f, 1.0f,
            parameter(aetherwave::parameters::filterDrive, 0.3f) + modDrive * 0.5f);
        const auto driveGain = 1.0f + drive * 5.0f;
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* samples = buffer.getWritePointer(channel);
            for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
                samples[sample] = std::tanh(samples[sample] * driveGain);
        }

        updateFilter();
        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> context(block);
        filter1.process(context);
        if (static_cast<int>(std::lround(parameter(aetherwave::parameters::filterType))) == 0)
            filter2.process(context);
    }

    if (parameter(aetherwave::parameters::chorusEnabled, 1.0f) >= 0.5f)
    {
        chorus.setRate(juce::jlimit(0.1f, 8.0f, parameter(aetherwave::parameters::chorusRate, 0.8f)));
        chorus.setDepth(juce::jlimit(0.0f, 1.0f, parameter(aetherwave::parameters::chorusDepth, 0.6f)));
        chorus.setFeedback(juce::jlimit(-0.95f, 0.95f, parameter(aetherwave::parameters::chorusFeedback, 0.3f)));
        chorus.setMix(juce::jlimit(0.0f, 1.0f,
            parameter(aetherwave::parameters::chorusMix, 0.4f)
            + modulationEngine.getDestination(ModulationEngine::Destination::chorusMix) * 0.5f));
        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> context(block);
        chorus.process(context);
    }

    processDelay(buffer);
    processReverb(buffer);
    processDriveAndMaster(buffer);
}
}
