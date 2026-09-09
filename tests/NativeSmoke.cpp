#include <juce_audio_utils/juce_audio_utils.h>

#include <cmath>
#include <iostream>
#include <stdexcept>

static void require(bool ok, const char* message)
{
    if (! ok)
        throw std::runtime_error(message);
}

static float render(juce::AudioPluginInstance& plugin, int blockSize, bool noteOn)
{
    juce::AudioBuffer<float> buffer(2, blockSize);
    float peak = 0.0f;
    for (int block = 0; block < 32; ++block)
    {
        buffer.clear();
        juce::MidiBuffer midi;
        if (noteOn && block == 0)
            midi.addEvent(juce::MidiMessage::noteOn(1, 60, 0.8f), 0);
        plugin.processBlock(buffer, midi);
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
            for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
            {
                const auto value = buffer.getSample(channel, sample);
                require(std::isfinite(value), "Non-finite audio output");
                peak = juce::jmax(peak, std::abs(value));
            }
    }
    return peak;
}

int main(int argc, char** argv)
{
    juce::ScopedJuceInitialiser_GUI juceInitialiser;
    try
    {
        require(argc == 2, "Usage: AetherWaveSmoke /path/to/AetherWave.vst3");
        juce::VST3PluginFormat format;
        juce::OwnedArray<juce::PluginDescription> descriptions;
        format.findAllTypesForFile(descriptions, juce::File(argv[1]).getFullPathName());
        require(descriptions.size() == 1, "Expected one discoverable VST3 instrument");
        require(descriptions[0]->isInstrument, "VST3 is not advertised as an instrument");
        juce::String error;
        auto plugin = format.createInstanceFromDescription(*descriptions[0], 48000.0, 256, error);
        if (! plugin)
            throw std::runtime_error("VST3 instantiation failed: " + error.toStdString());
        require(plugin->acceptsMidi(), "Instrument does not accept MIDI");
        require(plugin->getTotalNumOutputChannels() == 2, "Expected stereo output");

        // Exercise a normal instrument layout (no audio input), mono microphone,
        // and stereo input used by the hum-to-MIDI feature.
        for (const int inputChannels : { 0, 1, 2 })
        {
            auto layout = plugin->getBusesLayout();
            if (! layout.inputBuses.isEmpty())
                layout.inputBuses.set(0, juce::AudioChannelSet::canonicalChannelSet(inputChannels));
            require(plugin->setBusesLayout(layout), "Supported input layout rejected");
            for (const double sampleRate : { 44100.0, 48000.0, 96000.0 })
                for (const int blockSize : { 1, 64, 257, 1024 })
                {
                    plugin->setRateAndBufferSizeDetails(sampleRate, blockSize);
                    plugin->prepareToPlay(sampleRate, blockSize);
                    require(render(*plugin, blockSize, false) < 1.0e-6f, "Unexpected audio before MIDI");
                    juce::AudioBuffer<float> empty(2, 0);
                    juce::MidiBuffer emptyMidi;
                    plugin->processBlock(empty, emptyMidi);
                    require(render(*plugin, blockSize, true) > 1.0e-6f, "MIDI note produced no audio");
                    plugin->releaseResources();
                    // Regression: a voice must not survive a stop/re-prepare cycle.
                    plugin->prepareToPlay(sampleRate, blockSize);
                    require(render(*plugin, blockSize, false) < 1.0e-6f, "Stuck note after re-prepare");
                    plugin->releaseResources();
                }
        }

        auto& parameters = plugin->getParameters();
        require(! parameters.isEmpty(), "No host parameters");
        juce::AudioProcessorParameter* parameter = nullptr;
        for (auto* candidate : parameters)
            if (candidate->getName(128) == "Master Volume")
                parameter = candidate;
        require(parameter != nullptr, "Master Volume parameter is missing");
        parameter->setValueNotifyingHost(0.0f);
        juce::MemoryBlock saved;
        plugin->getStateInformation(saved);
        require(saved.getSize() > 0, "Empty saved state");
        parameter->setValueNotifyingHost(1.0f);
        plugin->setStateInformation(saved.getData(), static_cast<int>(saved.getSize()));
        require(std::abs(parameter->getValue()) < 1.0e-5f, "Host parameter state did not restore");
        std::cout << "PASS: VST3 discovery, instantiation, MIDI audio, finite samples, "
                     "input layouts, zero/variable blocks, restart, state restore\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL: " << error.what() << '\n';
        return 1;
    }
}
