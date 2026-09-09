#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "../DSP/WavetableVoice.h"

#include <cmath>

namespace
{
constexpr auto performanceStateProperty = "performanceStateJson";

juce::var makeObject(std::initializer_list<std::pair<juce::Identifier, juce::var>> fields)
{
    auto* object = new juce::DynamicObject();
    for (const auto& [name, value] : fields)
        object->setProperty(name, value);
    return juce::var(object);
}
}

VictorZynthAudioProcessor::VictorZynthAudioProcessor()
    : AudioProcessor(BusesProperties()
          .withInput("Pitch Input", juce::AudioChannelSet::stereo(), true)
          .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      state(*this, nullptr, "AETHERWAVE_STATE", aetherwave::parameters::createParameterLayout()),
      modulationEngine(state),
      effectsChain(state, modulationEngine),
      masteringChain(state),
      midiGenerationState(std::make_shared<MidiGenerationSharedState>())
{
    synthesiser.addSound(new aetherwave::dsp::WavetableSound());

    for (int i = 0; i < 16; ++i)
        synthesiser.addVoice(new aetherwave::dsp::WavetableVoice(
            wavetableBank, state, modulationEngine, monoFrequencyMemory));

    if (! state.state.hasProperty(aetherwave::parameters::modMatrixProperty))
        state.state.setProperty(aetherwave::parameters::modMatrixProperty, "[]", nullptr);
    if (! state.state.hasProperty(aetherwave::parameters::uiStateProperty))
        state.state.setProperty(aetherwave::parameters::uiStateProperty, "{}", nullptr);
    if (! state.state.hasProperty(performanceStateProperty))
        state.state.setProperty(performanceStateProperty, juce::JSON::toString(getPerformanceSettings(), false), nullptr);
    else
        restorePerformanceSettingsFromState();

    modulationEngine.setModMatrixJson(state.state.getProperty(aetherwave::parameters::modMatrixProperty).toString());

    juce::PropertiesFile::Options options;
    options.applicationName = "VictorZynth";
    options.filenameSuffix = ".settings";
    options.folderName = "VictorZynth";
    options.osxLibrarySubFolder = "Application Support/VictorZynth";
    options.storageFormat = juce::PropertiesFile::storeAsXML;
    options.millisecondsBeforeSaving = 1000;

    const auto settingsDirectory = juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("VictorZynth");
    settingsDirectory.createDirectory();
    aiSettings = std::make_unique<juce::PropertiesFile>(
        settingsDirectory.getChildFile("VictorZynth.settings"), options);

    const juce::ScopedLock lock(midiGenerationState->lock);
    midiGenerationState->result = makeObject({
        { "success", false },
        { "message", "Idle" },
        { "tempoBpm", 120.0 },
        { "path", "" }
    });
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
    masteringChain.prepare(sampleRate, samplesPerBlock, getTotalNumOutputChannels());
    audioToMidiTracker.prepare(sampleRate);
    arpeggiator.prepare(sampleRate);
}

void VictorZynthAudioProcessor::releaseResources()
{
    masteringChain.reset();
    effectsChain.reset();
    modulationEngine.reset();
    audioToMidiTracker.reset();
    arpeggiator.reset();
    uiMidiCollector.reset(currentSampleRate.load(std::memory_order_relaxed));
}

bool VictorZynthAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    const auto input = layouts.getMainInputChannelSet();
    return input.isDisabled()
        || input == juce::AudioChannelSet::mono()
        || input == juce::AudioChannelSet::stereo();
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
    const auto numSamples = buffer.getNumSamples();

    juce::MidiBuffer uiMessages;
    uiMidiCollector.removeNextBlockOfMessages(uiMessages, numSamples);
    midiMessages.addEvents(uiMessages, 0, numSamples, 0);

    updateHostInfo();

    juce::MidiBuffer detectedMidi;
    audioToMidiTracker.process(buffer, getTotalNumInputChannels(), detectedMidi, getPitchTrackingSettings());
    midiMessages.addEvents(detectedMidi, 0, numSamples, 0);

    juce::MidiBuffer sequencedMidi;
    arpeggiator.process(midiMessages,
                        sequencedMidi,
                        numSamples,
                        hostTempo.load(std::memory_order_relaxed),
                        getArpeggiatorSettings());

    midiMessages.clear();
    midiMessages.addEvents(sequencedMidi, 0, numSamples, 0);

    auto performanceMidi = preparePerformanceMidi(sequencedMidi);
    modulationEngine.handleMidi(performanceMidi);
    modulationEngine.processBlock(numSamples, hostTempo.load(std::memory_order_relaxed));

    buffer.clear();
    synthesiser.renderNextBlock(buffer, performanceMidi, 0, numSamples);
    effectsChain.process(buffer);
    masteringChain.process(buffer);
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
            restorePerformanceSettingsFromState();
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

juce::var VictorZynthAudioProcessor::getStudioTelemetry()
{
    return masteringChain.getTelemetry();
}

juce::var VictorZynthAudioProcessor::getPerformanceTelemetry() const
{
    auto* object = new juce::DynamicObject();
    object->setProperty("pitch", audioToMidiTracker.getTelemetry());
    object->setProperty("arp", arpeggiator.getTelemetry());
    object->setProperty("inputChannels", getTotalNumInputChannels());
    return juce::var(object);
}

juce::var VictorZynthAudioProcessor::getPerformanceSettings() const
{
    auto* pitch = new juce::DynamicObject();
    pitch->setProperty("enabled", pitchEnabled.load(std::memory_order_relaxed));
    pitch->setProperty("gateDb", pitchGateDb.load(std::memory_order_relaxed));
    pitch->setProperty("minFrequency", pitchMinFrequency.load(std::memory_order_relaxed));
    pitch->setProperty("maxFrequency", pitchMaxFrequency.load(std::memory_order_relaxed));
    pitch->setProperty("confidence", pitchConfidence.load(std::memory_order_relaxed));
    pitch->setProperty("smoothingFrames", pitchSmoothingFrames.load(std::memory_order_relaxed));
    pitch->setProperty("velocitySensitivity", pitchVelocitySensitivity.load(std::memory_order_relaxed));
    pitch->setProperty("scale", pitchScale.load(std::memory_order_relaxed));
    pitch->setProperty("root", pitchRoot.load(std::memory_order_relaxed));
    pitch->setProperty("retrigger", pitchRetrigger.load(std::memory_order_relaxed));

    auto* arp = new juce::DynamicObject();
    arp->setProperty("enabled", arpEnabled.load(std::memory_order_relaxed));
    arp->setProperty("mode", arpMode.load(std::memory_order_relaxed));
    arp->setProperty("rate", arpRate.load(std::memory_order_relaxed));
    arp->setProperty("octaves", arpOctaves.load(std::memory_order_relaxed));
    arp->setProperty("gate", arpGate.load(std::memory_order_relaxed));
    arp->setProperty("latch", arpLatch.load(std::memory_order_relaxed));
    arp->setProperty("swing", arpSwing.load(std::memory_order_relaxed));
    arp->setProperty("retrigger", arpRetrigger.load(std::memory_order_relaxed));

    auto* object = new juce::DynamicObject();
    object->setProperty("pitch", juce::var(pitch));
    object->setProperty("arp", juce::var(arp));
    return juce::var(object);
}

void VictorZynthAudioProcessor::setPerformanceSettings(const juce::var& settings)
{
    const auto pitch = settings.getProperty("pitch", juce::var());
    if (! pitch.isVoid())
    {
        pitchEnabled.store(bool(pitch.getProperty("enabled", pitchEnabled.load())), std::memory_order_relaxed);
        pitchGateDb.store(juce::jlimit(-80.0f, -6.0f, static_cast<float>(static_cast<double>(pitch.getProperty("gateDb", pitchGateDb.load())))), std::memory_order_relaxed);
        pitchMinFrequency.store(juce::jlimit(35.0f, 500.0f, static_cast<float>(static_cast<double>(pitch.getProperty("minFrequency", pitchMinFrequency.load())))), std::memory_order_relaxed);
        pitchMaxFrequency.store(juce::jlimit(200.0f, 3000.0f, static_cast<float>(static_cast<double>(pitch.getProperty("maxFrequency", pitchMaxFrequency.load())))), std::memory_order_relaxed);
        pitchConfidence.store(juce::jlimit(0.5f, 0.95f, static_cast<float>(static_cast<double>(pitch.getProperty("confidence", pitchConfidence.load())))), std::memory_order_relaxed);
        pitchSmoothingFrames.store(juce::jlimit(1, 8, static_cast<int>(pitch.getProperty("smoothingFrames", pitchSmoothingFrames.load()))), std::memory_order_relaxed);
        pitchVelocitySensitivity.store(juce::jlimit(0.0f, 1.0f, static_cast<float>(static_cast<double>(pitch.getProperty("velocitySensitivity", pitchVelocitySensitivity.load())))), std::memory_order_relaxed);
        pitchScale.store(juce::jlimit(0, 2, static_cast<int>(pitch.getProperty("scale", pitchScale.load()))), std::memory_order_relaxed);
        pitchRoot.store(juce::jlimit(0, 11, static_cast<int>(pitch.getProperty("root", pitchRoot.load()))), std::memory_order_relaxed);
        pitchRetrigger.store(bool(pitch.getProperty("retrigger", pitchRetrigger.load())), std::memory_order_relaxed);
    }

    const auto arp = settings.getProperty("arp", juce::var());
    if (! arp.isVoid())
    {
        arpEnabled.store(bool(arp.getProperty("enabled", arpEnabled.load())), std::memory_order_relaxed);
        arpMode.store(juce::jlimit(0, 3, static_cast<int>(arp.getProperty("mode", arpMode.load()))), std::memory_order_relaxed);
        arpRate.store(juce::jlimit(0, 3, static_cast<int>(arp.getProperty("rate", arpRate.load()))), std::memory_order_relaxed);
        arpOctaves.store(juce::jlimit(1, 4, static_cast<int>(arp.getProperty("octaves", arpOctaves.load()))), std::memory_order_relaxed);
        arpGate.store(juce::jlimit(0.05f, 1.0f, static_cast<float>(static_cast<double>(arp.getProperty("gate", arpGate.load())))), std::memory_order_relaxed);
        arpLatch.store(bool(arp.getProperty("latch", arpLatch.load())), std::memory_order_relaxed);
        arpSwing.store(juce::jlimit(0.0f, 0.75f, static_cast<float>(static_cast<double>(arp.getProperty("swing", arpSwing.load())))), std::memory_order_relaxed);
        arpRetrigger.store(bool(arp.getProperty("retrigger", arpRetrigger.load())), std::memory_order_relaxed);
    }

    state.state.setProperty(performanceStateProperty, juce::JSON::toString(getPerformanceSettings(), false), nullptr);
}

aetherwave::dsp::AudioToMidiTracker::Settings VictorZynthAudioProcessor::getPitchTrackingSettings() const noexcept
{
    aetherwave::dsp::AudioToMidiTracker::Settings settings;
    settings.enabled = pitchEnabled.load(std::memory_order_relaxed);
    settings.gateDb = pitchGateDb.load(std::memory_order_relaxed);
    settings.minFrequency = pitchMinFrequency.load(std::memory_order_relaxed);
    settings.maxFrequency = pitchMaxFrequency.load(std::memory_order_relaxed);
    settings.minConfidence = pitchConfidence.load(std::memory_order_relaxed);
    settings.smoothingFrames = pitchSmoothingFrames.load(std::memory_order_relaxed);
    settings.velocitySensitivity = pitchVelocitySensitivity.load(std::memory_order_relaxed);
    settings.scale = pitchScale.load(std::memory_order_relaxed);
    settings.root = pitchRoot.load(std::memory_order_relaxed);
    settings.retriggerOnOnset = pitchRetrigger.load(std::memory_order_relaxed);
    return settings;
}

aetherwave::dsp::Arpeggiator::Settings VictorZynthAudioProcessor::getArpeggiatorSettings() const noexcept
{
    aetherwave::dsp::Arpeggiator::Settings settings;
    settings.enabled = arpEnabled.load(std::memory_order_relaxed);
    settings.mode = arpMode.load(std::memory_order_relaxed);
    settings.rate = arpRate.load(std::memory_order_relaxed);
    settings.octaves = arpOctaves.load(std::memory_order_relaxed);
    settings.gate = arpGate.load(std::memory_order_relaxed);
    settings.latch = arpLatch.load(std::memory_order_relaxed);
    settings.swing = arpSwing.load(std::memory_order_relaxed);
    settings.retrigger = arpRetrigger.load(std::memory_order_relaxed);
    return settings;
}

void VictorZynthAudioProcessor::restorePerformanceSettingsFromState()
{
    const auto json = state.state.getProperty(performanceStateProperty, "").toString();
    if (json.isEmpty())
        return;

    const auto parsed = juce::JSON::parse(json);
    if (! parsed.isVoid())
        setPerformanceSettings(parsed);
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
    if (auto* hostPlayHead = getPlayHead())
    {
        if (const auto position = hostPlayHead->getPosition())
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

juce::File VictorZynthAudioProcessor::getMidiLibraryDirectory()
{
    auto directory = juce::File::getSpecialLocation(juce::File::userDocumentsDirectory)
        .getChildFile("VictorZynth-MIDI");
    directory.createDirectory();
    return directory;
}

juce::var VictorZynthAudioProcessor::generationResultToVar(
    const aetherwave::ai::MidiGenerator::Result& result,
    const juce::File& savedFile)
{
    auto* object = new juce::DynamicObject();
    object->setProperty("success", result.success);
    object->setProperty("message", result.message);
    object->setProperty("tempoBpm", result.tempoBpm);
    object->setProperty("path", savedFile.getFullPathName());

    juce::Array<juce::var> notePreview;
    const auto noteLimit = juce::jmin<std::size_t>(result.notes.size(), 200);
    for (std::size_t i = 0; i < noteLimit; ++i)
    {
        const auto& note = result.notes[i];
        notePreview.add(makeObject({
            { "pitch", note.pitch },
            { "startBeats", note.startBeats },
            { "lengthBeats", note.lengthBeats },
            { "velocity", note.velocity }
        }));
    }
    object->setProperty("notes", juce::var(notePreview));

    juce::Array<juce::var> trackPreview;
    for (const auto& track : result.tracks)
    {
        juce::Array<juce::var> notes;
        const auto limit = juce::jmin<std::size_t>(track.notes.size(), 120);
        for (std::size_t i = 0; i < limit; ++i)
        {
            const auto& note = track.notes[i];
            notes.add(makeObject({
                { "pitch", note.pitch },
                { "startBeats", note.startBeats },
                { "lengthBeats", note.lengthBeats },
                { "velocity", note.velocity }
            }));
        }

        trackPreview.add(makeObject({
            { "name", track.name },
            { "instrument", track.instrument },
            { "gmProgram", track.gmProgram },
            { "isDrums", track.isDrums },
            { "notes", juce::var(notes) }
        }));
    }
    object->setProperty("tracks", juce::var(trackPreview));

    return juce::var(object);
}

void VictorZynthAudioProcessor::setAISettings(const juce::var& settings)
{
    if (aiSettings == nullptr)
        return;

    aiSettings->setValue("useAnthropic", bool(settings.getProperty("useAnthropic", true)));
    aiSettings->setValue("endpoint", settings.getProperty("endpoint", "").toString());
    aiSettings->setValue("model", settings.getProperty("model", "").toString());

    const auto apiKey = settings.getProperty("apiKey", "").toString();
    if (apiKey.isNotEmpty())
        aiSettings->setValue("apiKey", apiKey);

    aiSettings->saveIfNeeded();
}

juce::var VictorZynthAudioProcessor::getAISettings() const
{
    auto* object = new juce::DynamicObject();
    if (aiSettings == nullptr)
    {
        object->setProperty("useAnthropic", true);
        object->setProperty("endpoint", "https://api.anthropic.com/v1/messages");
        object->setProperty("model", "claude-opus-4-8");
        object->setProperty("apiKey", "");
        return juce::var(object);
    }

    const auto useAnthropic = aiSettings->getBoolValue("useAnthropic", true);
    object->setProperty("useAnthropic", useAnthropic);
    object->setProperty("endpoint", aiSettings->getValue(
        "endpoint", useAnthropic ? "https://api.anthropic.com/v1/messages" : ""));
    object->setProperty("model", aiSettings->getValue(
        "model", useAnthropic ? "claude-opus-4-8" : ""));
    object->setProperty("apiKey", aiSettings->getValue("apiKey", ""));
    return juce::var(object);
}

bool VictorZynthAudioProcessor::startMidiGeneration(const juce::var& requestVar)
{
    if (midiGenerationState == nullptr || midiGenerationState->busy.exchange(true))
        return false;

    aetherwave::ai::MidiGenerator::Request request;
    request.useAnthropic = bool(requestVar.getProperty("useAnthropic", true));
    request.multiTrack = bool(requestVar.getProperty("multiTrack", false));
    request.endpoint = requestVar.getProperty("endpoint", "").toString().trim();
    request.model = requestVar.getProperty("model", "").toString().trim();
    request.apiKey = requestVar.getProperty("apiKey", "").toString().trim();
    request.prompt = requestVar.getProperty("prompt", "").toString().trim();

    if (request.endpoint.isEmpty())
        request.endpoint = request.useAnthropic ? "https://api.anthropic.com/v1/messages" : juce::String();
    if (request.model.isEmpty() && request.useAnthropic)
        request.model = "claude-opus-4-8";
    if (request.apiKey.isEmpty() && aiSettings != nullptr)
        request.apiKey = aiSettings->getValue("apiKey", "");

    if (request.prompt.isEmpty() || request.endpoint.isEmpty() || request.model.isEmpty() || request.apiKey.isEmpty())
    {
        const juce::ScopedLock lock(midiGenerationState->lock);
        midiGenerationState->result = makeObject({
            { "success", false },
            { "message", "Prompt, endpoint, model and API key are required." },
            { "tempoBpm", 0.0 },
            { "path", "" }
        });
        midiGenerationState->busy.store(false);
        return false;
    }

    setAISettings(requestVar);

    {
        const juce::ScopedLock lock(midiGenerationState->lock);
        midiGenerationState->result = makeObject({
            { "success", false },
            { "message", request.multiTrack ? "Generating arrangement..." : "Generating MIDI..." },
            { "tempoBpm", 0.0 },
            { "path", "" }
        });
    }

    const auto weakState = std::weak_ptr<MidiGenerationSharedState>(midiGenerationState);
    const auto library = getMidiLibraryDirectory();
    midiGenerator.generate(std::move(request), [weakState, library](aetherwave::ai::MidiGenerator::Result result) mutable
    {
        juce::File savedFile;
        if (result.success)
        {
            const auto prefix = result.tracks.empty() ? "VictorZynth-" : "VictorZynth-arrangement-";
            const auto baseName = prefix + juce::String(juce::Time::currentTimeMillis());
            savedFile = library.getNonexistentChildFile(baseName, ".mid", false);

            const auto wrote = result.tracks.empty()
                ? aetherwave::ai::MidiGenerator::writeMidiFile(
                    result.notes, result.tempoBpm, 0.0f, juce::Time::currentTimeMillis(), savedFile)
                : aetherwave::ai::MidiGenerator::writeMultiTrackFile(result.tracks, result.tempoBpm, savedFile);

            if (! wrote)
            {
                result.success = false;
                result.message = "The MIDI was generated, but the file could not be written.";
                savedFile = juce::File();
            }
        }

        if (const auto shared = weakState.lock())
        {
            const juce::ScopedLock lock(shared->lock);
            shared->result = VictorZynthAudioProcessor::generationResultToVar(result, savedFile);
            shared->busy.store(false);
        }
    });

    return true;
}

juce::var VictorZynthAudioProcessor::getMidiGeneratorState() const
{
    auto* object = new juce::DynamicObject();
    if (midiGenerationState == nullptr)
    {
        object->setProperty("busy", false);
        object->setProperty("result", juce::var());
        return juce::var(object);
    }

    object->setProperty("busy", midiGenerationState->busy.load());
    const juce::ScopedLock lock(midiGenerationState->lock);
    object->setProperty("result", midiGenerationState->result);
    return juce::var(object);
}

juce::var VictorZynthAudioProcessor::listMidiLibrary() const
{
    const auto directory = getMidiLibraryDirectory();
    auto files = directory.findChildFiles(juce::File::findFiles, false, "*.mid");

    struct RecentFirst
    {
        static int compareElements(const juce::File& a, const juce::File& b)
        {
            const auto at = a.getLastModificationTime().toMilliseconds();
            const auto bt = b.getLastModificationTime().toMilliseconds();
            return at == bt ? a.getFileName().compareNatural(b.getFileName()) : (at > bt ? -1 : 1);
        }
    } comparator;
    files.sort(comparator);

    juce::Array<juce::var> result;
    const auto limit = juce::jmin(64, files.size());
    for (int i = 0; i < limit; ++i)
    {
        const auto& file = files.getReference(i);
        result.add(makeObject({
            { "name", file.getFileName() },
            { "path", file.getFullPathName() },
            { "size", static_cast<double>(file.getSize()) },
            { "modifiedMs", static_cast<double>(file.getLastModificationTime().toMilliseconds()) }
        }));
    }
    return juce::var(result);
}

void VictorZynthAudioProcessor::revealMidiLibrary() const
{
    getMidiLibraryDirectory().startAsProcess();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VictorZynthAudioProcessor();
}
