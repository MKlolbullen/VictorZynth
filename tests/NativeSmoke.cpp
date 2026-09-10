#include <juce_audio_utils/juce_audio_utils.h>

#include <cmath>
#include <cstdlib>
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

static void checkEditor(juce::AudioPluginInstance& plugin, const juce::File& report)
{
   #if JUCE_LINUX
    ::setenv("AETHERWAVE_UI_REPORT", report.getFullPathName().toRawUTF8(), 1);
   #endif
    for (int round = 0; round < 2; ++round)
    {
        report.deleteFile();
        juce::DocumentWindow window("AetherWave native UI test", juce::Colours::black,
                                    juce::DocumentWindow::allButtons);
        window.setUsingNativeTitleBar(true);
        auto* editor = plugin.createEditorIfNeeded();
        require(editor != nullptr, "VST3 did not create an editor");
        window.setContentOwned(editor, true);
        window.centreWithSize(round == 0 ? 1440 : 1100, round == 0 ? 900 : 760);
        window.setVisible(true);
        const auto start = juce::Time::getMillisecondCounter();
        bool ready = false;
        while (juce::Time::getMillisecondCounter() - start < 30000)
        {
            juce::MessageManager::getInstance()->runDispatchLoopUntil(100);
            const auto status = juce::JSON::parse(report.loadFileAsString());
            if (status["status"].toString() == "failed")
                throw std::runtime_error("Native editor failed: " + status["detail"].toString().toStdString());
            if (status["status"].toString() == "ready")
            {
                std::cout << "Editor " << round << ": " << status["detail"].toString() << '\n';
                ready = true;
                break;
            }
        }
        require(ready, "Native editor did not render React/CSS and complete a native parameter round-trip");
        juce::MessageManager::getInstance()->runDispatchLoopUntil(500);
        juce::ChildProcess capture;
        require(capture.start(juce::StringArray { "import", "-window", "root",
            report.getSiblingFile("native-editor-" + juce::String(round) + ".png").getFullPathName() }),
            "Could not start native editor screenshot capture");
        require(capture.waitForProcessToFinish(5000) && capture.getExitCode() == 0,
                "Native editor screenshot capture failed");
        window.clearContentComponent();
        juce::MessageManager::getInstance()->runDispatchLoopUntil(250);
    }
    std::cout << "PASS: actual VST3 editor renders React, CSS and canvases; native bridge round-trip, reopen and resize\n";
}

int main(int argc, char** argv)
{
    juce::ScopedJuceInitialiser_GUI juceInitialiser;
   #if JUCE_LINUX
    // Initialise Xlib on the host thread before loading a plugin that starts
    // its own JUCE message thread. ScopedJuceInitialiser_GUI alone is lazy.
    juce::XWindowSystem::getInstance();
   #endif
    try
    {
        require(argc == 2 || (argc == 4 && juce::String(argv[2]) == "--editor"),
                "Usage: AetherWaveSmoke /path/to/AetherWave.vst3 [--editor /absolute/report.json]");
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
        plugin->setRateAndBufferSizeDetails(48000.0, 256);
        plugin->prepareToPlay(48000.0, 256);
        parameter->setValueNotifyingHost(0.0f);
        // A VST3 host delivers queued automation to the component during process.
        render(*plugin, 256, false);
        juce::MemoryBlock saved;
        plugin->getStateInformation(saved);
        require(saved.getSize() > 0, "Empty saved state");
        parameter->setValueNotifyingHost(1.0f);
        render(*plugin, 256, false);
        plugin->setStateInformation(saved.getData(), static_cast<int>(saved.getSize()));
        require(std::abs(parameter->getValue()) < 1.0e-5f, "Host parameter state did not restore");
        plugin->releaseResources();
        if (argc == 4)
            checkEditor(*plugin, juce::File(argv[3]));
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
