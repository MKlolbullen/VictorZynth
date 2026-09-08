#include "Parameters.h"

namespace aetherwave::parameters
{
namespace
{
using ParamID = juce::ParameterID;

juce::NormalisableRange<float> logarithmicRange(float min, float max)
{
    return { min, max, 0.0f, 0.35f };
}
}

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    const juce::StringArray tables {
        "Analog Warmth",
        "Spectral Void",
        "Celestial Drone",
        "Vocal Formants",
        "Cyber Wavefold",
        "Metallic Bell"
    };

    layout.add(std::make_unique<juce::AudioParameterChoice>(ParamID { osc1Table, 1 }, "Osc 1 Table", tables, 0));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { osc1Position, 1 }, "Osc 1 Position", 0.0f, 1.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterInt>(ParamID { osc1Octave, 1 }, "Osc 1 Octave", -3, 3, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>(ParamID { osc1Semitone, 1 }, "Osc 1 Semitone", -12, 12, 0));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { osc1Fine, 1 }, "Osc 1 Fine", -100.0f, 100.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { osc1Level, 1 }, "Osc 1 Level", 0.0f, 1.0f, 0.8f));

    layout.add(std::make_unique<juce::AudioParameterChoice>(ParamID { osc2Table, 1 }, "Osc 2 Table", tables, 1));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { osc2Position, 1 }, "Osc 2 Position", 0.0f, 1.0f, 0.2f));
    layout.add(std::make_unique<juce::AudioParameterInt>(ParamID { osc2Octave, 1 }, "Osc 2 Octave", -3, 3, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>(ParamID { osc2Semitone, 1 }, "Osc 2 Semitone", -12, 12, 0));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { osc2Fine, 1 }, "Osc 2 Fine", -100.0f, 100.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { osc2Level, 1 }, "Osc 2 Level", 0.0f, 1.0f, 0.65f));

    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { env1Attack, 1 }, "Amp Attack", logarithmicRange(0.001f, 8.0f), 0.01f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { env1Decay, 1 }, "Amp Decay", logarithmicRange(0.01f, 10.0f), 0.3f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { env1Sustain, 1 }, "Amp Sustain", 0.0f, 1.0f, 0.8f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { env1Release, 1 }, "Amp Release", logarithmicRange(0.01f, 12.0f), 0.6f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(ParamID { masterVolume, 1 }, "Master Volume", 0.0f, 1.0f, 0.75f));

    return layout;
}
}
