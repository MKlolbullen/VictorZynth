#include "ModulationEngine.h"

#include <algorithm>
#include <cmath>

namespace aetherwave::dsp
{
namespace
{
constexpr double twoPi = juce::MathConstants<double>::twoPi;

float clampMod(float value) noexcept
{
    return juce::jlimit(-1.0f, 1.0f, value);
}
}

ModulationEngine::ModulationEngine(juce::AudioProcessorValueTreeState& state)
    : parameterState(state)
{
    reset();
}

void ModulationEngine::prepare(double sampleRate)
{
    currentSampleRate = sampleRate > 0.0 ? sampleRate : 48000.0;
    env1.setSampleRate(currentSampleRate);
    env2.setSampleRate(currentSampleRate);
    updateEnvelopes();
}

void ModulationEngine::reset()
{
    lfo1PhaseValue = 0.0;
    lfo2PhaseValue = 0.0;
    sampleHold1 = sampleHold2 = 0.0f;
    smoothRandom1 = smoothRandom2 = 0.0f;
    smoothRandomTarget1 = smoothRandomTarget2 = 0.0f;
    chaosValue = chaosTarget = 0.0f;
    activeNotes = 0;
    env1.reset();
    env2.reset();

    for (auto& source : sources)
        source.store(0.0f, std::memory_order_relaxed);
    for (auto& destination : destinations)
        destination.store(0.0f, std::memory_order_relaxed);
}

float ModulationEngine::parameter(const char* id, float fallback) const noexcept
{
    if (const auto* raw = parameterState.getRawParameterValue(id))
        return raw->load(std::memory_order_relaxed);
    return fallback;
}

void ModulationEngine::updateEnvelopes()
{
    juce::ADSR::Parameters e1;
    e1.attack = parameter(aetherwave::parameters::env1Attack, 0.4f);
    e1.decay = parameter(aetherwave::parameters::env1Decay, 1.8f);
    e1.sustain = parameter(aetherwave::parameters::env1Sustain, 0.75f);
    e1.release = parameter(aetherwave::parameters::env1Release, 2.5f);
    env1.setParameters(e1);

    juce::ADSR::Parameters e2;
    e2.attack = parameter(aetherwave::parameters::env2Attack, 0.8f);
    e2.decay = parameter(aetherwave::parameters::env2Decay, 2.5f);
    e2.sustain = parameter(aetherwave::parameters::env2Sustain, 0.3f);
    e2.release = parameter(aetherwave::parameters::env2Release, 3.0f);
    env2.setParameters(e2);
}

void ModulationEngine::handleMidi(const juce::MidiBuffer& midiMessages)
{
    updateEnvelopes();

    for (const auto metadata : midiMessages)
    {
        const auto message = metadata.getMessage();
        if (message.isNoteOn())
        {
            if (activeNotes++ == 0)
            {
                env1.noteOn();
                env2.noteOn();
            }
            sources[static_cast<std::size_t>(Source::velocity)].store(message.getFloatVelocity(), std::memory_order_relaxed);

            if (parameter(aetherwave::parameters::lfo1Retrigger) >= 0.5f)
                lfo1PhaseValue = parameter(aetherwave::parameters::lfo1Phase);
            if (parameter(aetherwave::parameters::lfo2Retrigger) >= 0.5f)
                lfo2PhaseValue = parameter(aetherwave::parameters::lfo2Phase);
        }
        else if (message.isNoteOff())
        {
            activeNotes = std::max(0, activeNotes - 1);
            if (activeNotes == 0)
            {
                env1.noteOff();
                env2.noteOff();
            }
        }
        else if (message.isController() && message.getControllerNumber() == 1)
        {
            sources[static_cast<std::size_t>(Source::modWheel)].store(
                static_cast<float>(message.getControllerValue()) / 127.0f,
                std::memory_order_relaxed);
        }
        else if (message.isPitchWheel())
        {
            constexpr float centre = 8192.0f;
            const auto value = juce::jlimit(-1.0f, 1.0f,
                (static_cast<float>(message.getPitchWheelValue()) - centre) / centre);
            sources[static_cast<std::size_t>(Source::pitchBend)].store(value, std::memory_order_relaxed);
        }
        else if (message.isAllNotesOff() || message.isAllSoundOff())
        {
            activeNotes = 0;
            env1.noteOff();
            env2.noteOff();
        }
    }
}

double ModulationEngine::syncedRate(double bpm, int divisionIndex) noexcept
{
    static constexpr std::array<double, 7> beats { 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0 };
    const auto index = juce::jlimit(0, static_cast<int>(beats.size()) - 1, divisionIndex);
    const auto secondsPerBeat = 60.0 / std::max(1.0, bpm);
    return 1.0 / (secondsPerBeat * beats[static_cast<std::size_t>(index)]);
}

float ModulationEngine::lfoShape(int shape,
                                 double phase,
                                 float& held,
                                 float& smooth,
                                 float& target,
                                 juce::Random& rng)
{
    const auto p = phase - std::floor(phase);
    switch (shape)
    {
        case 0: return static_cast<float>(std::sin(twoPi * p));
        case 1: return static_cast<float>(1.0 - 4.0 * std::abs(p - 0.5));
        case 2: return static_cast<float>(2.0 * p - 1.0);
        case 3: return static_cast<float>(1.0 - 2.0 * p);
        case 4: return p < 0.5 ? 1.0f : -1.0f;
        case 5:
            if (p < 0.02)
                held = rng.nextFloat() * 2.0f - 1.0f;
            return held;
        case 6:
            if (p < 0.02)
                target = rng.nextFloat() * 2.0f - 1.0f;
            smooth += (target - smooth) * 0.04f;
            return smooth;
        default: return 0.0f;
    }
}

void ModulationEngine::updateSources(int numSamples, double bpm)
{
    const auto blockSeconds = static_cast<double>(numSamples) / std::max(1.0, currentSampleRate);

    const auto previousLfo1RateMod = getDestination(Destination::lfo1Rate);
    const auto previousLfo2RateMod = getDestination(Destination::lfo2Rate);

    const auto lfo1Base = parameter(aetherwave::parameters::lfo1Sync) >= 0.5f
        ? syncedRate(bpm, static_cast<int>(std::lround(parameter(aetherwave::parameters::lfo1SyncDivision))))
        : static_cast<double>(parameter(aetherwave::parameters::lfo1Rate, 0.35f));
    const auto lfo2Base = parameter(aetherwave::parameters::lfo2Sync) >= 0.5f
        ? syncedRate(bpm, static_cast<int>(std::lround(parameter(aetherwave::parameters::lfo2SyncDivision))))
        : static_cast<double>(parameter(aetherwave::parameters::lfo2Rate, 0.18f));

    const auto lfo1RateValue = juce::jlimit(0.01, 60.0, lfo1Base * std::pow(2.0, previousLfo1RateMod * 3.0f));
    const auto lfo2RateValue = juce::jlimit(0.01, 60.0, lfo2Base * std::pow(2.0, previousLfo2RateMod * 3.0f));

    lfo1PhaseValue += lfo1RateValue * blockSeconds;
    lfo2PhaseValue += lfo2RateValue * blockSeconds;
    lfo1PhaseValue -= std::floor(lfo1PhaseValue);
    lfo2PhaseValue -= std::floor(lfo2PhaseValue);

    const auto lfo1Value = lfoShape(static_cast<int>(std::lround(parameter(aetherwave::parameters::lfo1Shape))),
                                    lfo1PhaseValue, sampleHold1, smoothRandom1, smoothRandomTarget1, random);
    const auto lfo2Value = lfoShape(static_cast<int>(std::lround(parameter(aetherwave::parameters::lfo2Shape))),
                                    lfo2PhaseValue, sampleHold2, smoothRandom2, smoothRandomTarget2, random);

    float env1Value = 0.0f;
    float env2Value = 0.0f;
    for (int i = 0; i < numSamples; ++i)
    {
        env1Value = env1.getNextSample();
        env2Value = env2.getNextSample();
    }

    if (random.nextFloat() < static_cast<float>(blockSeconds * 2.0))
        chaosTarget = random.nextFloat() * 2.0f - 1.0f;
    chaosValue += (chaosTarget - chaosValue) * juce::jlimit(0.001f, 0.25f, static_cast<float>(blockSeconds * 3.0));

    sources[static_cast<std::size_t>(Source::lfo1)].store(lfo1Value, std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::lfo2)].store(lfo2Value, std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::env1)].store(env1Value, std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::env2)].store(env2Value, std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::macro1)].store(parameter(aetherwave::parameters::macro1), std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::macro2)].store(parameter(aetherwave::parameters::macro2), std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::macro3)].store(parameter(aetherwave::parameters::macro3), std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::macro4)].store(parameter(aetherwave::parameters::macro4), std::memory_order_relaxed);
    sources[static_cast<std::size_t>(Source::chaos)].store(chaosValue, std::memory_order_relaxed);
}

void ModulationEngine::evaluateRoutes()
{
    std::array<float, static_cast<std::size_t>(Destination::count)> values {};
    const auto currentRoutes = std::atomic_load_explicit(&routes, std::memory_order_acquire);

    if (currentRoutes != nullptr)
    {
        for (const auto& route : *currentRoutes)
        {
            if (! route.enabled)
                continue;

            auto source = getSource(route.source);
            const auto sourceIsNaturallyBipolar = route.source == Source::lfo1 || route.source == Source::lfo2
                || route.source == Source::pitchBend || route.source == Source::chaos;
            if (! route.bipolar && sourceIsNaturallyBipolar)
                source = (source + 1.0f) * 0.5f;

            const auto index = static_cast<std::size_t>(route.destination);
            values[index] += source * route.amount;
        }
    }

    for (std::size_t i = 0; i < values.size(); ++i)
        destinations[i].store(clampMod(values[i]), std::memory_order_relaxed);
}

void ModulationEngine::processBlock(int numSamples, double bpm)
{
    updateEnvelopes();
    updateSources(numSamples, bpm);
    evaluateRoutes();
}

float ModulationEngine::getSource(Source source) const noexcept
{
    return sources[static_cast<std::size_t>(source)].load(std::memory_order_relaxed);
}

float ModulationEngine::getDestination(Destination destination) const noexcept
{
    return destinations[static_cast<std::size_t>(destination)].load(std::memory_order_relaxed);
}

std::optional<ModulationEngine::Source> ModulationEngine::parseSource(const juce::String& name)
{
    for (std::size_t i = 0; i < static_cast<std::size_t>(Source::count); ++i)
    {
        const auto source = static_cast<Source>(i);
        if (name == sourceName(source))
            return source;
    }
    return std::nullopt;
}

std::optional<ModulationEngine::Destination> ModulationEngine::parseDestination(const juce::String& name)
{
    for (std::size_t i = 0; i < static_cast<std::size_t>(Destination::count); ++i)
    {
        const auto destination = static_cast<Destination>(i);
        if (name == destinationName(destination))
            return destination;
    }
    return std::nullopt;
}

const char* ModulationEngine::sourceName(Source source) noexcept
{
    static constexpr std::array<const char*, static_cast<std::size_t>(Source::count)> names {
        "lfo1", "lfo2", "env1", "env2", "macro1", "macro2", "macro3", "macro4",
        "modWheel", "pitchBend", "velocity", "chaos"
    };
    return names[static_cast<std::size_t>(source)];
}

const char* ModulationEngine::destinationName(Destination destination) noexcept
{
    static constexpr std::array<const char*, static_cast<std::size_t>(Destination::count)> names {
        "osc1_pitch", "osc1_pos", "osc1_warp", "osc1_phase", "osc1_level",
        "osc2_pitch", "osc2_pos", "osc2_warp", "osc2_phase", "osc2_level",
        "filter_cutoff", "filter_res", "filter_drive", "reverb_mix", "delay_mix",
        "delay_time", "chorus_mix", "lfo1_rate", "lfo2_rate", "pan"
    };
    return names[static_cast<std::size_t>(destination)];
}

void ModulationEngine::setModMatrixJson(const juce::String& json)
{
    auto parsed = juce::JSON::parse(json);
    auto nextRoutes = std::make_shared<RouteList>();

    if (const auto* array = parsed.getArray())
    {
        nextRoutes->reserve(static_cast<std::size_t>(array->size()));
        for (const auto& entry : *array)
        {
            const auto* object = entry.getDynamicObject();
            if (object == nullptr)
                continue;

            const auto source = parseSource(object->getProperty("source").toString());
            const auto destination = parseDestination(object->getProperty("destination").toString());
            if (! source || ! destination)
                continue;

            Route route;
            route.source = *source;
            route.destination = *destination;
            route.amount = juce::jlimit(-1.0f, 1.0f, static_cast<float>(static_cast<double>(object->getProperty("amount"))));
            route.bipolar = static_cast<bool>(object->getProperty("bipolar"));
            route.enabled = static_cast<bool>(object->getProperty("enabled"));
            nextRoutes->push_back(route);
        }
    }

    std::shared_ptr<const RouteList> immutable = nextRoutes;
    std::atomic_store_explicit(&routes, std::move(immutable), std::memory_order_release);
}

juce::var ModulationEngine::getTelemetry(int activeVoiceCount) const
{
    auto* sourceObject = new juce::DynamicObject();
    for (std::size_t i = 0; i < static_cast<std::size_t>(Source::count); ++i)
    {
        const auto source = static_cast<Source>(i);
        sourceObject->setProperty(sourceName(source), getSource(source));
    }

    auto* destinationObject = new juce::DynamicObject();
    for (std::size_t i = 0; i < static_cast<std::size_t>(Destination::count); ++i)
    {
        const auto destination = static_cast<Destination>(i);
        destinationObject->setProperty(destinationName(destination), getDestination(destination));
    }

    auto* envStages = new juce::DynamicObject();
    const auto e1 = getSource(Source::env1);
    const auto e2 = getSource(Source::env2);
    envStages->setProperty("env1", activeVoiceCount > 0 ? "sustain" : (e1 > 0.001f ? "release" : "idle"));
    envStages->setProperty("env2", activeVoiceCount > 0 ? "sustain" : (e2 > 0.001f ? "release" : "idle"));
    envStages->setProperty("env1Progress", e1);
    envStages->setProperty("env2Progress", e2);
    envStages->setProperty("activeNoteCount", activeVoiceCount);

    auto* result = new juce::DynamicObject();
    result->setProperty("sources", juce::var(sourceObject));
    result->setProperty("destinations", juce::var(destinationObject));
    result->setProperty("envStages", juce::var(envStages));
    return juce::var(result);
}
}
