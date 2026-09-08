#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace aetherwave::parameters
{
inline constexpr auto osc1Table = "osc1.table";
inline constexpr auto osc1Position = "osc1.position";
inline constexpr auto osc1Octave = "osc1.octave";
inline constexpr auto osc1Semitone = "osc1.semitone";
inline constexpr auto osc1Fine = "osc1.fine";
inline constexpr auto osc1Level = "osc1.level";

inline constexpr auto osc2Table = "osc2.table";
inline constexpr auto osc2Position = "osc2.position";
inline constexpr auto osc2Octave = "osc2.octave";
inline constexpr auto osc2Semitone = "osc2.semitone";
inline constexpr auto osc2Fine = "osc2.fine";
inline constexpr auto osc2Level = "osc2.level";

inline constexpr auto env1Attack = "env1.attack";
inline constexpr auto env1Decay = "env1.decay";
inline constexpr auto env1Sustain = "env1.sustain";
inline constexpr auto env1Release = "env1.release";
inline constexpr auto masterVolume = "master.volume";

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
}
