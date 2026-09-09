#pragma once

#include "../Parameters/Parameters.h"

#include <array>
#include <atomic>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_processors/juce_audio_processors.h>

namespace aetherwave::dsp
{
class ModulationEngine final
{
public:
    enum class Source : std::size_t
    {
        lfo1, lfo2, env1, env2, macro1, macro2, macro3, macro4,
        modWheel, pitchBend, velocity, chaos, count
    };

    enum class Destination : std::size_t
    {
        osc1Pitch, osc1Position, osc1Warp, osc1Phase, osc1Level,
        osc2Pitch, osc2Position, osc2Warp, osc2Phase, osc2Level,
        filterCutoff, filterResonance, filterDrive,
        reverbMix, delayMix, delayTime, chorusMix,
        lfo1Rate, lfo2Rate, pan, count
    };

    explicit ModulationEngine(juce::AudioProcessorValueTreeState& state);

    void prepare(double sampleRate);
    void reset();
    void handleMidi(const juce::MidiBuffer& midiMessages);
    void processBlock(int numSamples, double bpm);
    void setModMatrixJson(const juce::String& json);

    float getSource(Source source) const noexcept;
    float getDestination(Destination destination) const noexcept;
    juce::var getTelemetry(int activeVoiceCount) const;

private:
    struct Route
    {
        Source source = Source::lfo1;
        Destination destination = Destination::filterCutoff;
        float amount = 0.0f;
        bool bipolar = true;
        bool enabled = true;
    };

    using RouteList = std::vector<Route>;

    juce::AudioProcessorValueTreeState& parameterState;
    double currentSampleRate = 48000.0;
    double lfo1PhaseValue = 0.0;
    double lfo2PhaseValue = 0.0;
    float sampleHold1 = 0.0f;
    float sampleHold2 = 0.0f;
    float smoothRandom1 = 0.0f;
    float smoothRandom2 = 0.0f;
    float smoothRandomTarget1 = 0.0f;
    float smoothRandomTarget2 = 0.0f;
    float chaosValue = 0.0f;
    float chaosTarget = 0.0f;
    int activeNotes = 0;
    juce::Random random;
    juce::ADSR env1;
    juce::ADSR env2;

    std::array<std::atomic<float>, static_cast<std::size_t>(Source::count)> sources {};
    std::array<std::atomic<float>, static_cast<std::size_t>(Destination::count)> destinations {};
    std::shared_ptr<const RouteList> routes = std::make_shared<const RouteList>();

    float parameter(const char* id, float fallback = 0.0f) const noexcept;
    static float lfoShape(int shape, double phase, float& held, float& smooth, float& target, juce::Random& random);
    static double syncedRate(double bpm, int divisionIndex) noexcept;
    static std::optional<Source> parseSource(const juce::String& name);
    static std::optional<Destination> parseDestination(const juce::String& name);
    static const char* sourceName(Source source) noexcept;
    static const char* destinationName(Destination destination) noexcept;
    void updateEnvelopes();
    void updateSources(int numSamples, double bpm);
    void evaluateRoutes();
};
}
