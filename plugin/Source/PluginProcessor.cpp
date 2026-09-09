#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "../DSP/WavetableVoice.h"

#include <cmath>

VictorZynthAudioProcessor::VictorZynthAudioProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      state(*this, nullptr, "AETHERWAVE_STATE", aetherwave::parameters::createParameterLayout()),
      modulationEngine(state),
      effectsChain(state, modulationEngine)
{
    synthesiser.addSound(new aetherwave::dsp::WavetableSound());

    for (int i = 0; i < 16; ++i)
        synthesiser.addVoice(new aetherwave::dsp::WavetableVoice(
            wavetableBank, state, modulationEngine, monoFrequencyMemory));

    if (! state.state.hasProperty(aetherwave::parameters::modMatrixProperty))
        state.state.setProperty(aetherwave::parameters::modMatrixProperty, "[]", nullptr);
    if (! state.state.hasProperty(aetherwave::parameters::uiStateProperty))
        state.state.setProperty(aetherwave::parameters::uiStateProperty, "{}", nullptr);

    modulationEngine.setModMatrixJson(state.state.getProperty(aetherwave::parameters::modMatrixProperty).toString());
}

float VictorZynthAudioProcessor::rawParameter(const char* id, float fallback) const noexcept
{
    if (const auto* raw = state.getRawParameterValue(id))
        return raw->load(std::memory_order_relaxed);
    return fallback;
}

void VictorZynthAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    currentSampleRate.store(sampleRate, std::memory_order_relaxed);
    currentBlockSize.store(samplesPerBlock, std::memory_order_relaxed);
    monoFrequencyMemory.store(0.0, std::memory_order_relaxed);
    synthesiser.setCurrentPlaybackSampleRate(sampleRate);
    uiMidiCollector.reset(sampleRate);
    modulationEngine.prepare(sampleRate);
    effectsChain.prepare(sampleRate, samplesPerBlock, getTotalNumOutputChannels());
}

void VictorZynthAudioProcessor::releaseResources()
{
    effectsChain.reset();
    modulationEngine.reset();
    uiMidiCollector.reset(currentSampleRate.load(std::memory_order_relaxed));
}

bool VictorZynthAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

juce::MidiBuffer VictorZynthAudioProcessor::preparePerformanceMidi(const juce::MidiBuffer& input)
{
    juce::MidiBuffer output;
    const auto mode = static_cast<int>(std::lround(rawParameter(aetherwave::parameters::polyphony)));
    const auto drone = rawParameter(aetherwave::parameters::droneMode) >= 0.5f;

    for (const auto metadata : input)
    {
        const auto message = metadata.getMessage();
        const auto samplePosition = metadata.samplePosition;

        if (drone && message.isNoteOff())
            continue;

        if (mode != 0 && message.isNoteOn())
            output.addEvent(juce::MidiMessage::allNotesOff(message.getChannel()), samplePosition);

        output.addEvent(message, samplePosition);
    }

    return output;
}

void VictorZynthAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                             juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;

    juce::MidiBuffer uiMessages;
    uiMidiCollector.removeNextBlockOfMessages(uiMessages, buffer.getNumSamples());
    midiMessages.addEvents(uiMessages, 0, buffer.getNumSamples(), 0);

    updateHostInfo();
    auto performanceMidi = preparePerformanceMidi(midiMessages);
    modulationEngine.handleMidi(performanceMidi);
    modulationEngine.processBlock(buffer.getNumSamples(), hostTempo.load(std::memory_order_relaxed));

    buffer.clear();
    synthesiser.renderNextBlock(buffer, performanceMidi, 0, buffer.getNumSamples());
    effectsChain.process(buffer);
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
        {
            state.replaceState(juce::ValueTree::fromXml(*xml));
            modulationEngine.setModMatrixJson(
                state.state.getProperty(aetherwave::parameters::modMatrixProperty, "[]").toString());
        }
    }
}

void VictorZynthAudioProcessor::queueMidiMessage(const juce::MidiMessage& message)
{
    uiMidiCollector.addMessageToQueue(message);
}

void VictorZynthAudioProcessor::setModMatrixJson(const juce::String& json)
{
    state.state.setProperty(aetherwave::parameters::modMatrixProperty, json, nullptr);
    modulationEngine.setModMatrixJson(json);
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
    return modulationEngine.getTelemetry(getActiveVoiceCount());
}

juce::var VictorZynthAudioProcessor::getHostInfo() const
{
    auto* result = new juce::DynamicObject();
    result->setProperty("tempo", hostTempo.load(std::memory_order_relaxed));
    result->setProperty("isPlaying", hostPlaying.load(std::memory_order_relaxed));

    juce::Array<juce::var> signature;
    signature.add(hostTimeSigNumerator.load(std::memory_order_relaxed));
    signature.add(hostTimeSigDenominator.load(std::memory_order_relaxed));
    result->setProperty("timeSignature", juce::var(signature));

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

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VictorZynthAudioProcessor();
}
