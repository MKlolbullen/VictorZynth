#pragma once

#include "../AI/MidiGenerator.h"
#include "../DSP/EffectsChain.h"
#include "../DSP/MasteringChain.h"
#include "../DSP/ModulationEngine.h"
#include "../DSP/WavetableBank.h"
#include "../Parameters/Parameters.h"

#include <atomic>
#include <memory>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_data_structures/juce_data_structures.h>

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
    juce::var getStudioTelemetry();
    juce::var getHostInfo() const;

    bool startMidiGeneration(const juce::var& request);
    juce::var getMidiGeneratorState() const;
    juce::var getAISettings() const;
    void setAISettings(const juce::var& settings);
    juce::var listMidiLibrary() const;
    void revealMidiLibrary() const;

private:
    struct MidiGenerationSharedState
    {
        mutable juce::CriticalSection lock;
        juce::var result;
        std::atomic<bool> busy { false };
    };

    void updateHostInfo();
    juce::MidiBuffer preparePerformanceMidi(const juce::MidiBuffer& input);
    int getActiveVoiceCount() const;
    float rawParameter(const char* id, float fallback = 0.0f) const noexcept;
    static juce::File getMidiLibraryDirectory();
    static juce::var generationResultToVar(const aetherwave::ai::MidiGenerator::Result& result,
                                           const juce::File& savedFile);

    aetherwave::dsp::WavetableBank wavetableBank;
    juce::AudioProcessorValueTreeState state;
    aetherwave::dsp::ModulationEngine modulationEngine;
    aetherwave::dsp::EffectsChain effectsChain;
    aetherwave::dsp::MasteringChain masteringChain;
    std::atomic<double> monoFrequencyMemory { 0.0 };
    juce::Synthesiser synthesiser;
    juce::MidiMessageCollector uiMidiCollector;

    aetherwave::ai::MidiGenerator midiGenerator;
    std::shared_ptr<MidiGenerationSharedState> midiGenerationState;
    std::unique_ptr<juce::PropertiesFile> aiSettings;

    std::atomic<double> currentSampleRate { 48000.0 };
    std::atomic<int> currentBlockSize { 0 };
    std::atomic<double> hostTempo { 120.0 };
    std::atomic<bool> hostPlaying { false };
    std::atomic<int> hostTimeSigNumerator { 4 };
    std::atomic<int> hostTimeSigDenominator { 4 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VictorZynthAudioProcessor)
};
