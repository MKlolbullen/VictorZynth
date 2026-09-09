#pragma once

#include "../DSP/EffectsChain.h"
#include "../DSP/ModulationEngine.h"
#include "../DSP/WavetableBank.h"
#include "../Parameters/Parameters.h"

#include <atomic>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>

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
    double getTailLengthSeconds() const override { return 15.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getValueTreeState() noexcept { return state; }
    const juce::AudioProcessorValueTreeState& getValueTreeState() const noexcept { return state; }

    void queueMidiMessage(const juce::MidiMessage& message);
    void setModMatrixJson(const juce::String& json);
    void setAuxStateJson(const juce::String& json);
    juce::var getTelemetry() const;
    juce::var getHostInfo() const;

private:
    void updateHostInfo();
    juce::MidiBuffer preparePerformanceMidi(const juce::MidiBuffer& input);
    int getActiveVoiceCount() const;
    float rawParameter(const char* id, float fallback = 0.0f) const noexcept;

    aetherwave::dsp::WavetableBank wavetableBank;
    juce::AudioProcessorValueTreeState state;
    aetherwave::dsp::ModulationEngine modulationEngine;
    aetherwave::dsp::EffectsChain effectsChain;
    std::atomic<double> monoFrequencyMemory { 0.0 };
    juce::Synthesiser synthesiser;
    juce::MidiMessageCollector uiMidiCollector;

    std::atomic<double> currentSampleRate { 48000.0 };
    std::atomic<int> currentBlockSize { 0 };
    std::atomic<double> hostTempo { 120.0 };
    std::atomic<bool> hostPlaying { false };
    std::atomic<int> hostTimeSigNumerator { 4 };
    std::atomic<int> hostTimeSigDenominator { 4 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VictorZynthAudioProcessor)
};
