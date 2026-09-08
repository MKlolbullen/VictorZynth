#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "../DSP/WavetableVoice.h"

VictorZynthAudioProcessor::VictorZynthAudioProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      state(*this, nullptr, "AETHERWAVE_STATE", aetherwave::parameters::createParameterLayout())
{
    synthesiser.addSound(new aetherwave::dsp::WavetableSound());

    for (int i = 0; i < 16; ++i)
        synthesiser.addVoice(new aetherwave::dsp::WavetableVoice(wavetableBank, state));
}

void VictorZynthAudioProcessor::prepareToPlay(double sampleRate, int)
{
    synthesiser.setCurrentPlaybackSampleRate(sampleRate);
}

void VictorZynthAudioProcessor::releaseResources()
{
}

bool VictorZynthAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    return output == juce::AudioChannelSet::mono() || output == juce::AudioChannelSet::stereo();
}

void VictorZynthAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                             juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
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

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VictorZynthAudioProcessor();
}
