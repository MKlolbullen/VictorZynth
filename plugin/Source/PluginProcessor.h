#pragma once

#include "../DSP/WavetableBank.h"
#include "../Parameters/Parameters.h"

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_basics/juce_audio_basics.h>

class VictorZynthAudioProcessor final : public juce::AudioProcessor
{
public:
    VictorZynthAudioProcessor();
    ~VictorZynthAudioProcessor() override = default;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 12.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getValueTreeState() noexcept { return state; }
    const juce::AudioProcessorValueTreeState& getValueTreeState() const noexcept { return state; }

private:
    aetherwave::dsp::WavetableBank wavetableBank;
    juce::AudioProcessorValueTreeState state;
    juce::Synthesiser synthesiser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VictorZynthAudioProcessor)
};
