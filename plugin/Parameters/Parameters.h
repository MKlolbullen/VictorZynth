#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace aetherwave::parameters
{
inline constexpr auto osc1Table = "osc1.table";
inline constexpr auto osc1Position = "osc1.position";
inline constexpr auto osc1Octave = "osc1.octave";
inline constexpr auto osc1Semitone = "osc1.semitone";
inline constexpr auto osc1Fine = "osc1.fine";
inline constexpr auto osc1WarpMode = "osc1.warpMode";
inline constexpr auto osc1WarpAmount = "osc1.warpAmount";
inline constexpr auto osc1Unison = "osc1.unison";
inline constexpr auto osc1Detune = "osc1.detune";
inline constexpr auto osc1Pan = "osc1.pan";
inline constexpr auto osc1Level = "osc1.level";
inline constexpr auto osc1Enabled = "osc1.enabled";
inline constexpr auto osc1Phase = "osc1.phase";

inline constexpr auto osc2Table = "osc2.table";
inline constexpr auto osc2Position = "osc2.position";
inline constexpr auto osc2Octave = "osc2.octave";
inline constexpr auto osc2Semitone = "osc2.semitone";
inline constexpr auto osc2Fine = "osc2.fine";
inline constexpr auto osc2WarpMode = "osc2.warpMode";
inline constexpr auto osc2WarpAmount = "osc2.warpAmount";
inline constexpr auto osc2Unison = "osc2.unison";
inline constexpr auto osc2Detune = "osc2.detune";
inline constexpr auto osc2Pan = "osc2.pan";
inline constexpr auto osc2Level = "osc2.level";
inline constexpr auto osc2Enabled = "osc2.enabled";
inline constexpr auto osc2Phase = "osc2.phase";

inline constexpr auto subWaveform = "sub.waveform";
inline constexpr auto subOctave = "sub.octave";
inline constexpr auto subLevel = "sub.level";
inline constexpr auto subEnabled = "sub.enabled";

inline constexpr auto noiseType = "noise.type";
inline constexpr auto noiseLevel = "noise.level";
inline constexpr auto noiseEnabled = "noise.enabled";

inline constexpr auto filterType = "filter.type";
inline constexpr auto filterCutoff = "filter.cutoff";
inline constexpr auto filterResonance = "filter.resonance";
inline constexpr auto filterDrive = "filter.drive";
inline constexpr auto filterKeyTracking = "filter.keyTracking";
inline constexpr auto filterEnabled = "filter.enabled";

inline constexpr auto env1Attack = "env1.attack";
inline constexpr auto env1Decay = "env1.decay";
inline constexpr auto env1Sustain = "env1.sustain";
inline constexpr auto env1Release = "env1.release";
inline constexpr auto env2Attack = "env2.attack";
inline constexpr auto env2Decay = "env2.decay";
inline constexpr auto env2Sustain = "env2.sustain";
inline constexpr auto env2Release = "env2.release";

inline constexpr auto lfo1Shape = "lfo1.shape";
inline constexpr auto lfo1Rate = "lfo1.rate";
inline constexpr auto lfo1Sync = "lfo1.sync";
inline constexpr auto lfo1SyncDivision = "lfo1.syncDivision";
inline constexpr auto lfo1Retrigger = "lfo1.retrigger";
inline constexpr auto lfo1Phase = "lfo1.phase";
inline constexpr auto lfo2Shape = "lfo2.shape";
inline constexpr auto lfo2Rate = "lfo2.rate";
inline constexpr auto lfo2Sync = "lfo2.sync";
inline constexpr auto lfo2SyncDivision = "lfo2.syncDivision";
inline constexpr auto lfo2Retrigger = "lfo2.retrigger";
inline constexpr auto lfo2Phase = "lfo2.phase";

inline constexpr auto macro1 = "macro.1";
inline constexpr auto macro2 = "macro.2";
inline constexpr auto macro3 = "macro.3";
inline constexpr auto macro4 = "macro.4";

inline constexpr auto reverbEnabled = "effects.reverb.enabled";
inline constexpr auto reverbDecay = "effects.reverb.decay";
inline constexpr auto reverbSize = "effects.reverb.size";
inline constexpr auto reverbDamp = "effects.reverb.damp";
inline constexpr auto reverbShimmer = "effects.reverb.shimmer";
inline constexpr auto reverbMix = "effects.reverb.mix";

inline constexpr auto delayEnabled = "effects.delay.enabled";
inline constexpr auto delayTime = "effects.delay.time";
inline constexpr auto delayFeedback = "effects.delay.feedback";
inline constexpr auto delayPingPong = "effects.delay.pingPong";
inline constexpr auto delayTone = "effects.delay.tone";
inline constexpr auto delayMix = "effects.delay.mix";

inline constexpr auto chorusEnabled = "effects.chorus.enabled";
inline constexpr auto chorusRate = "effects.chorus.rate";
inline constexpr auto chorusDepth = "effects.chorus.depth";
inline constexpr auto chorusFeedback = "effects.chorus.feedback";
inline constexpr auto chorusMix = "effects.chorus.mix";

// Keep master.volume stable for automation compatibility with the first native migration.
inline constexpr auto masterDrive = "master.drive";
inline constexpr auto masterVolume = "master.volume";
inline constexpr auto masterLimiter = "master.limiter";

inline constexpr auto glide = "glide";
inline constexpr auto polyphony = "polyphony";
inline constexpr auto droneMode = "droneMode";

// MyVST3-derived production/mastering layer. Disabled by default so old patches remain sonically stable.
inline constexpr auto studioEnabled = "studio.enabled";
inline constexpr auto studioInputGainDb = "studio.inputGainDb";
inline constexpr auto studioOutputGainDb = "studio.outputGainDb";

inline constexpr auto studioEqEnabled = "studio.eq.enabled";
inline constexpr auto studioHpfFreq = "studio.eq.hpfFreq";
inline constexpr auto studioLowShelfFreq = "studio.eq.lowShelfFreq";
inline constexpr auto studioLowShelfGainDb = "studio.eq.lowShelfGainDb";
inline constexpr auto studioPeak1Freq = "studio.eq.peak1Freq";
inline constexpr auto studioPeak1GainDb = "studio.eq.peak1GainDb";
inline constexpr auto studioPeak1Q = "studio.eq.peak1Q";
inline constexpr auto studioPeak2Freq = "studio.eq.peak2Freq";
inline constexpr auto studioPeak2GainDb = "studio.eq.peak2GainDb";
inline constexpr auto studioPeak2Q = "studio.eq.peak2Q";
inline constexpr auto studioHighShelfFreq = "studio.eq.highShelfFreq";
inline constexpr auto studioHighShelfGainDb = "studio.eq.highShelfGainDb";

inline constexpr auto studioCompEnabled = "studio.comp.enabled";
inline constexpr auto studioCompThresholdDb = "studio.comp.thresholdDb";
inline constexpr auto studioCompRatio = "studio.comp.ratio";
inline constexpr auto studioCompAttackMs = "studio.comp.attackMs";
inline constexpr auto studioCompReleaseMs = "studio.comp.releaseMs";
inline constexpr auto studioCompMakeupDb = "studio.comp.makeupDb";

inline constexpr auto studioLimiterEnabled = "studio.limiter.enabled";
inline constexpr auto studioLimiterCeilingDb = "studio.limiter.ceilingDb";
inline constexpr auto studioLimiterReleaseMs = "studio.limiter.releaseMs";

inline constexpr auto modMatrixProperty = "modMatrixJson";
inline constexpr auto uiStateProperty = "uiStateJson";

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
}
