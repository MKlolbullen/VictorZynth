#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "../DSP/WavetableVoice.h"

#include <cmath>

namespace
{
juce::var makeEmptyModulationObject()
{
    auto* sources = new juce::DynamicObject();
    for (const auto* name : { "lfo1", "lfo2", "env1", "env2", "macro1", "macro2", "macro3", "macro4", "modWheel", "pitchBend", "velocity", "chaos" })
        sources->setProperty(name, 0.0);

    auto* destinations = new juce::DynamicObject();
    for (const auto* name : { "osc1_pitch", "osc1_pos", "osc1_warp", "osc1_phase", "osc1_level",
                              "osc2_pitch", "osc2_pos", "osc2_warp", "osc2_phase", "osc2_level",
                              "filter_cutoff", "filter_res", "filter_drive", "reverb_mix", "delay_mix",
                              "delay_time", "chorus_mix", "lfo1_rate", "lfo2_rate", "pan" })
        destinations->setProperty(name, 0.0);

    auto* result = new juce::DynamicObject();
    result->setProperty("sources", juce::var(sources));
    result->setProperty("destinations", juce::var(destinations));
    return juce::var(result);
}
}

VictorZynthAudioProcessor::VictorZynthAudioProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      state(*this, nullptr, "AETHERWAVE_STATE", aetherwave::parameters::createParameterLayout())
{
    synthesiser.addSound(new aetherwave::dsp::WavetableSound());

    for (int i = 0; i < 16; ++i)
        synthesiser.addVoice(new aetherwave::dsp::WavetableVoice(wavetableBank, state));

    if (! state.state.hasProperty(aetherwave::parameters::modMatrixProperty))
        state.state.setProperty(aetherwave::parameters::modMatrixProperty, "[]", nullptr);
    if (! state.state.hasProperty(aetherwave::parameters::uiStateProperty))
        state.state.setProperty(aetherwave::parameters::uiStateProperty, "{}", nullptr);
}

void VictorZynthAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    currentSampleRate.store(sampleRate, std::memory_order_relaxed);
    currentBlockSize.store(samplesPerBlock, std::memory_order_relaxed);
    synthesiser.setCurrentPlaybackSampleRate(sampleRate);
    uiMidiCollector.reset(sampleRate);
}

void VictorZynthAudioProcessor::releaseResources()
{
    uiMidiCollector.reset(currentSampleRate.load(std::memory_order_relaxed));
}

bool VictorZynthAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void VictorZynthAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                             juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;

    juce::MidiBuffer uiMessages;
    uiMidiCollector.removeNextBlockOfMessages(uiMessages, buffer.getNumSamples());
    midiMessages.addEvents(uiMessages, 0, buffer.getNumSamples(), 0);

    updateHostInfo();
    captureMidiTelemetry(midiMessages);

    buffer.clear();
    synthesiser.renderNextBlock(buffer, midiMessages, 0, buffer.getNumSamples());
}

juce::AudioProcessorEditor* VictorZynthAudioProcessor::createEditor()
{
    return new VictorZynthAudioProcessorEditor(*this);
}

void VictorZynthAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    if (const auto xml = state.copyState().createXml())
        copyXmlToBinary(*xml, destData);
}

void VictorZynthAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    if (const auto xml = getXmlFromBinary(data, sizeInBytes))
    {
        if (xml->hasTagName(state.state.getType()))
            state.replaceState(juce::ValueTree::fromXml(*xml));
    }
}

void VictorZynthAudioProcessor::queueMidiMessage(const juce::MidiMessage& message)
{
    uiMidiCollector.addMessageToQueue(message);
}

void VictorZynthAudioProcessor::setModMatrixJson(const juce::String& json)
{
    state.state.setProperty(aetherwave::parameters::modMatrixProperty, json, nullptr);
}

void VictorZynthAudioProcessor::setAuxStateJson(const juce::String& json)
{
    state.state.setProperty(aetherwave::parameters::uiStateProperty, json, nullptr);
}

int VictorZynthAudioProcessor::getActiveVoiceCount() const
{
    int active = 0;
    for (int i = 0; i < synthesiser.getNumVoices(); ++i)
        if (const auto* voice = synthesiser.getVoice(i); voice != nullptr && voice->isVoiceActive())
            ++active;
    return active;
}

juce::var VictorZynthAudioProcessor::getTelemetry() const
{
    auto telemetry = makeEmptyModulationObject();
    auto* root = telemetry.getDynamicObject();
    auto* sources = root != nullptr ? root->getProperty("sources").getDynamicObject() : nullptr;

    if (sources != nullptr)
    {
        const auto raw = [this](const char* id) -> float
        {
            if (const auto* value = state.getRawParameterValue(id))
                return value->load();
            return 0.0f;
        };

        sources->setProperty("macro1", raw(aetherwave::parameters::macro1));
        sources->setProperty("macro2", raw(aetherwave::parameters::macro2));
        sources->setProperty("macro3", raw(aetherwave::parameters::macro3));
        sources->setProperty("macro4", raw(aetherwave::parameters::macro4));
        sources->setProperty("modWheel", latestModWheel.load(std::memory_order_relaxed));
        sources->setProperty("pitchBend", latestPitchBend.load(std::memory_order_relaxed));
        sources->setProperty("velocity", latestVelocity.load(std::memory_order_relaxed));
    }

    auto* envStages = new juce::DynamicObject();
    const auto activeVoices = getActiveVoiceCount();
    envStages->setProperty("env1", activeVoices > 0 ? "sustain" : "idle");
    envStages->setProperty("env2", activeVoices > 0 ? "sustain" : "idle");
    envStages->setProperty("env1Progress", activeVoices > 0 ? 1.0 : 0.0);
    envStages->setProperty("env2Progress", activeVoices > 0 ? 1.0 : 0.0);
    envStages->setProperty("activeNoteCount", activeVoices);
    if (root != nullptr)
        root->setProperty("envStages", juce::var(envStages));

    return telemetry;
}

juce::var VictorZynthAudioProcessor::getHostInfo() const
{
    auto* result = new juce::DynamicObject();
    result->setProperty("tempo", hostTempo.load(std::memory_order_relaxed));
    result->setProperty("isPlaying", hostPlaying.load(std::memory_order_relaxed));

    juce::Array<juce::var> signature;
    signature.add(hostTimeSigNumerator.load(std::memory_order_relaxed));
    signature.add(hostTimeSigDenominator.load(std::memory_order_relaxed));
    result->setProperty("timeSignature", signature);

    result->setProperty("sampleRate", currentSampleRate.load(std::memory_order_relaxed));
    result->setProperty("bufferSize", currentBlockSize.load(std::memory_order_relaxed));
    result->setProperty("activeTrack", 0);
    result->setProperty("trackName", "DAW Host Track");
    result->setProperty("midiConnected", true);
    result->setProperty("midiDeviceName", "DAW MIDI Input");
    result->setProperty("cpuLoad", 0.0);
    return juce::var(result);
}

void VictorZynthAudioProcessor::updateHostInfo()
{
    if (auto* playHead = getPlayHead())
    {
        if (const auto position = playHead->getPosition())
        {
            hostPlaying.store(position->getIsPlaying(), std::memory_order_relaxed);
            if (const auto bpm = position->getBpm())
                hostTempo.store(*bpm, std::memory_order_relaxed);
            if (const auto timeSignature = position->getTimeSignature())
            {
                hostTimeSigNumerator.store(timeSignature->numerator, std::memory_order_relaxed);
                hostTimeSigDenominator.store(timeSignature->denominator, std::memory_order_relaxed);
            }
        }
    }
}

void VictorZynthAudioProcessor::captureMidiTelemetry(const juce::MidiBuffer& midiMessages)
{
    for (const auto metadata : midiMessages)
    {
        const auto message = metadata.getMessage();
        if (message.isNoteOn())
            latestVelocity.store(message.getFloatVelocity(), std::memory_order_relaxed);
        else if (message.isController() && message.getControllerNumber() == 1)
            latestModWheel.store(static_cast<float>(message.getControllerValue()) / 127.0f, std::memory_order_relaxed);
        else if (message.isPitchWheel())
        {
            constexpr float centre = 8192.0f;
            const auto bend = juce::jlimit(-1.0f, 1.0f,
                (static_cast<float>(message.getPitchWheelValue()) - centre) / centre);
            latestPitchBend.store(bend, std::memory_order_relaxed);
        }
    }
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VictorZynthAudioProcessor();
}
