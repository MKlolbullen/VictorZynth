#include "Parameters.h"

namespace aetherwave::parameters
{
namespace
{
using ParamID = juce::ParameterID;

juce::NormalisableRange<float> logarithmicRange(float min, float max, float centre)
{
    juce::NormalisableRange<float> range { min, max };
    range.setSkewForCentre(centre);
    return range;
}

void addFloat(juce::AudioProcessorValueTreeState::ParameterLayout& layout,
              const char* id,
              const char* name,
              juce::NormalisableRange<float> range,
              float defaultValue)
{
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { id, 1 }, name, range, defaultValue));
}

void addInt(juce::AudioProcessorValueTreeState::ParameterLayout& layout,
            const char* id,
            const char* name,
            int min,
            int max,
            int defaultValue)
{
    layout.add(std::make_unique<juce::AudioParameterInt>(ParamID { id, 1 }, name, min, max, defaultValue));
}

void addBool(juce::AudioProcessorValueTreeState::ParameterLayout& layout,
             const char* id,
             const char* name,
             bool defaultValue)
{
    layout.add(std::make_unique<juce::AudioParameterBool>(ParamID { id, 1 }, name, defaultValue));
}

void addChoice(juce::AudioProcessorValueTreeState::ParameterLayout& layout,
               const char* id,
               const char* name,
               const juce::StringArray& choices,
               int defaultIndex)
{
    layout.add(std::make_unique<juce::AudioParameterChoice>(ParamID { id, 1 }, name, choices, defaultIndex));
}
}

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    const juce::StringArray tables {
        "Analog Warmth", "Spectral Void", "Celestial Drone",
        "Vocal Formants", "Cyber Wavefold", "Metallic Bell"
    };
    const juce::StringArray warpModes { "None", "Sync", "Bend", "FM", "Wavefold", "PWM" };
    const juce::StringArray subWaveforms { "Sine", "Triangle", "Square" };
    const juce::StringArray noiseTypes { "White", "Pink", "Cosmic" };
    const juce::StringArray filterTypes { "Lowpass 24", "Lowpass 12", "Bandpass", "Highpass", "Comb", "Notch" };
    const juce::StringArray lfoShapes { "Sine", "Triangle", "Saw Up", "Saw Down", "Square", "Sample & Hold", "Smooth Random" };
    const juce::StringArray syncDivisions { "1/16", "1/8", "1/4", "1/2", "1/1", "2/1", "4/1" };
    const juce::StringArray polyphonyModes { "Poly", "Mono", "Legato" };

    addChoice(layout, osc1Table, "Osc 1 Table", tables, 2);
    addFloat(layout, osc1Position, "Osc 1 Position", { 0.0f, 1.0f }, 0.25f);
    addInt(layout, osc1Octave, "Osc 1 Octave", -3, 3, 0);
    addInt(layout, osc1Semitone, "Osc 1 Semitone", -12, 12, 0);
    addFloat(layout, osc1Fine, "Osc 1 Fine", { -100.0f, 100.0f }, 0.0f);
    addChoice(layout, osc1WarpMode, "Osc 1 Warp Mode", warpModes, 2);
    addFloat(layout, osc1WarpAmount, "Osc 1 Warp", { 0.0f, 1.0f }, 0.2f);
    addInt(layout, osc1Unison, "Osc 1 Unison", 1, 7, 3);
    addFloat(layout, osc1Detune, "Osc 1 Detune", { 0.0f, 1.0f }, 0.15f);
    addFloat(layout, osc1Pan, "Osc 1 Pan", { -1.0f, 1.0f }, -0.2f);
    addFloat(layout, osc1Level, "Osc 1 Level", { 0.0f, 1.0f }, 0.85f);
    addBool(layout, osc1Enabled, "Osc 1 Enabled", true);
    addFloat(layout, osc1Phase, "Osc 1 Phase", { 0.0f, 1.0f }, 0.0f);

    addChoice(layout, osc2Table, "Osc 2 Table", tables, 1);
    addFloat(layout, osc2Position, "Osc 2 Position", { 0.0f, 1.0f }, 0.5f);
    addInt(layout, osc2Octave, "Osc 2 Octave", -3, 3, -1);
    addInt(layout, osc2Semitone, "Osc 2 Semitone", -12, 12, 7);
    addFloat(layout, osc2Fine, "Osc 2 Fine", { -100.0f, 100.0f }, 8.0f);
    addChoice(layout, osc2WarpMode, "Osc 2 Warp Mode", warpModes, 4);
    addFloat(layout, osc2WarpAmount, "Osc 2 Warp", { 0.0f, 1.0f }, 0.35f);
    addInt(layout, osc2Unison, "Osc 2 Unison", 1, 7, 2);
    addFloat(layout, osc2Detune, "Osc 2 Detune", { 0.0f, 1.0f }, 0.2f);
    addFloat(layout, osc2Pan, "Osc 2 Pan", { -1.0f, 1.0f }, 0.2f);
    addFloat(layout, osc2Level, "Osc 2 Level", { 0.0f, 1.0f }, 0.7f);
    addBool(layout, osc2Enabled, "Osc 2 Enabled", true);
    addFloat(layout, osc2Phase, "Osc 2 Phase", { 0.0f, 1.0f }, 0.0f);

    addChoice(layout, subWaveform, "Sub Waveform", subWaveforms, 0);
    addInt(layout, subOctave, "Sub Octave", -2, -1, -1);
    addFloat(layout, subLevel, "Sub Level", { 0.0f, 1.0f }, 0.4f);
    addBool(layout, subEnabled, "Sub Enabled", true);

    addChoice(layout, noiseType, "Noise Type", noiseTypes, 2);
    addFloat(layout, noiseLevel, "Noise Level", { 0.0f, 1.0f }, 0.15f);
    addBool(layout, noiseEnabled, "Noise Enabled", true);

    addChoice(layout, filterType, "Filter Type", filterTypes, 0);
    addFloat(layout, filterCutoff, "Filter Cutoff", logarithmicRange(20.0f, 20000.0f, 1200.0f), 2800.0f);
    addFloat(layout, filterResonance, "Filter Resonance", { 0.1f, 20.0f }, 3.5f);
    addFloat(layout, filterDrive, "Filter Drive", { 0.0f, 1.0f }, 0.3f);
    addFloat(layout, filterKeyTracking, "Filter Key Tracking", { 0.0f, 1.0f }, 0.5f);
    addBool(layout, filterEnabled, "Filter Enabled", true);

    addFloat(layout, env1Attack, "Amp Attack", logarithmicRange(0.001f, 8.0f, 0.25f), 0.4f);
    addFloat(layout, env1Decay, "Amp Decay", logarithmicRange(0.01f, 10.0f, 0.7f), 1.8f);
    addFloat(layout, env1Sustain, "Amp Sustain", { 0.0f, 1.0f }, 0.75f);
    addFloat(layout, env1Release, "Amp Release", logarithmicRange(0.01f, 12.0f, 1.0f), 2.5f);
    addFloat(layout, env2Attack, "Mod Attack", logarithmicRange(0.001f, 8.0f, 0.25f), 0.8f);
    addFloat(layout, env2Decay, "Mod Decay", logarithmicRange(0.01f, 10.0f, 0.7f), 2.5f);
    addFloat(layout, env2Sustain, "Mod Sustain", { 0.0f, 1.0f }, 0.3f);
    addFloat(layout, env2Release, "Mod Release", logarithmicRange(0.01f, 12.0f, 1.0f), 3.0f);

    addChoice(layout, lfo1Shape, "LFO 1 Shape", lfoShapes, 1);
    addFloat(layout, lfo1Rate, "LFO 1 Rate", logarithmicRange(0.05f, 30.0f, 1.0f), 0.35f);
    addBool(layout, lfo1Sync, "LFO 1 Sync", false);
    addChoice(layout, lfo1SyncDivision, "LFO 1 Sync Division", syncDivisions, 3);
    addBool(layout, lfo1Retrigger, "LFO 1 Retrigger", false);
    addFloat(layout, lfo1Phase, "LFO 1 Phase", { 0.0f, 1.0f }, 0.0f);

    addChoice(layout, lfo2Shape, "LFO 2 Shape", lfoShapes, 6);
    addFloat(layout, lfo2Rate, "LFO 2 Rate", logarithmicRange(0.05f, 30.0f, 1.0f), 0.18f);
    addBool(layout, lfo2Sync, "LFO 2 Sync", false);
    addChoice(layout, lfo2SyncDivision, "LFO 2 Sync Division", syncDivisions, 4);
    addBool(layout, lfo2Retrigger, "LFO 2 Retrigger", false);
    addFloat(layout, lfo2Phase, "LFO 2 Phase", { 0.0f, 1.0f }, 0.25f);

    addFloat(layout, macro1, "Macro 1", { 0.0f, 1.0f }, 0.65f);
    addFloat(layout, macro2, "Macro 2", { 0.0f, 1.0f }, 0.45f);
    addFloat(layout, macro3, "Macro 3", { 0.0f, 1.0f }, 0.5f);
    addFloat(layout, macro4, "Macro 4", { 0.0f, 1.0f }, 0.7f);

    addBool(layout, reverbEnabled, "Reverb Enabled", true);
    addFloat(layout, reverbDecay, "Reverb Decay", logarithmicRange(0.5f, 15.0f, 4.0f), 6.5f);
    addFloat(layout, reverbSize, "Reverb Size", { 0.0f, 1.0f }, 0.85f);
    addFloat(layout, reverbDamp, "Reverb Damping", { 0.0f, 1.0f }, 0.3f);
    addFloat(layout, reverbShimmer, "Reverb Shimmer", { 0.0f, 1.0f }, 0.45f);
    addFloat(layout, reverbMix, "Reverb Mix", { 0.0f, 1.0f }, 0.45f);

    addBool(layout, delayEnabled, "Delay Enabled", true);
    addFloat(layout, delayTime, "Delay Time", { 0.05f, 1.5f }, 0.45f);
    addFloat(layout, delayFeedback, "Delay Feedback", { 0.0f, 0.95f }, 0.55f);
    addBool(layout, delayPingPong, "Delay Ping Pong", true);
    addFloat(layout, delayTone, "Delay Tone", logarithmicRange(200.0f, 10000.0f, 2500.0f), 3200.0f);
    addFloat(layout, delayMix, "Delay Mix", { 0.0f, 1.0f }, 0.35f);

    addBool(layout, chorusEnabled, "Chorus Enabled", true);
    addFloat(layout, chorusRate, "Chorus Rate", logarithmicRange(0.1f, 8.0f, 1.0f), 0.8f);
    addFloat(layout, chorusDepth, "Chorus Depth", { 0.0f, 1.0f }, 0.6f);
    addFloat(layout, chorusFeedback, "Chorus Feedback", { 0.0f, 0.8f }, 0.3f);
    addFloat(layout, chorusMix, "Chorus Mix", { 0.0f, 1.0f }, 0.4f);

    addFloat(layout, masterDrive, "Master Drive", { 0.0f, 1.0f }, 0.15f);
    addFloat(layout, masterVolume, "Master Volume", { 0.0f, 1.0f }, 0.8f);
    addBool(layout, masterLimiter, "Master Limiter", true);

    addFloat(layout, glide, "Glide", { 0.0f, 1.0f }, 0.05f);
    addChoice(layout, polyphony, "Polyphony", polyphonyModes, 0);
    addBool(layout, droneMode, "Drone Mode", false);

    return layout;
}
}
