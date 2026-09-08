#include "WavetableVoice.h"

#include <cmath>

namespace aetherwave::dsp
{
WavetableVoice::WavetableVoice(const WavetableBank& bank,
                               juce::AudioProcessorValueTreeState& state)
    : wavetableBank(bank), parameterState(state)
{
    osc1Table = parameterState.getRawParameterValue(aetherwave::parameters::osc1Table);
    osc1Position = parameterState.getRawParameterValue(aetherwave::parameters::osc1Position);
    osc1Octave = parameterState.getRawParameterValue(aetherwave::parameters::osc1Octave);
    osc1Semitone = parameterState.getRawParameterValue(aetherwave::parameters::osc1Semitone);
    osc1Fine = parameterState.getRawParameterValue(aetherwave::parameters::osc1Fine);
    osc1Level = parameterState.getRawParameterValue(aetherwave::parameters::osc1Level);

    osc2Table = parameterState.getRawParameterValue(aetherwave::parameters::osc2Table);
    osc2Position = parameterState.getRawParameterValue(aetherwave::parameters::osc2Position);
    osc2Octave = parameterState.getRawParameterValue(aetherwave::parameters::osc2Octave);
    osc2Semitone = parameterState.getRawParameterValue(aetherwave::parameters::osc2Semitone);
    osc2Fine = parameterState.getRawParameterValue(aetherwave::parameters::osc2Fine);
    osc2Level = parameterState.getRawParameterValue(aetherwave::parameters::osc2Level);

    envAttack = parameterState.getRawParameterValue(aetherwave::parameters::env1Attack);
    envDecay = parameterState.getRawParameterValue(aetherwave::parameters::env1Decay);
    envSustain = parameterState.getRawParameterValue(aetherwave::parameters::env1Sustain);
    envRelease = parameterState.getRawParameterValue(aetherwave::parameters::env1Release);
    masterVolume = parameterState.getRawParameterValue(aetherwave::parameters::masterVolume);

    jassert(osc1Table && osc1Position && osc1Octave && osc1Semitone && osc1Fine && osc1Level);
    jassert(osc2Table && osc2Position && osc2Octave && osc2Semitone && osc2Fine && osc2Level);
    jassert(envAttack && envDecay && envSustain && envRelease && masterVolume);
}

bool WavetableVoice::canPlaySound(juce::SynthesiserSound* sound)
{
    return dynamic_cast<WavetableSound*>(sound) != nullptr;
}

void WavetableVoice::startNote(int midiNoteNumber,
                               float velocity,
                               juce::SynthesiserSound*,
                               int currentPitchWheelPosition)
{
    baseFrequency = juce::MidiMessage::getMidiNoteInHertz(midiNoteNumber);
    noteVelocity = velocity;
    phase1 = 0.0;
    phase2 = 0.0;
    ampEnvelope.setSampleRate(getSampleRate());
    updateEnvelope();
    pitchWheelMoved(currentPitchWheelPosition);
    ampEnvelope.noteOn();
}

void WavetableVoice::stopNote(float, bool allowTailOff)
{
    if (allowTailOff)
    {
        ampEnvelope.noteOff();
        return;
    }

    ampEnvelope.reset();
    clearCurrentNote();
}

void WavetableVoice::pitchWheelMoved(int value)
{
    constexpr float centre = 8192.0f;
    const auto normalised = juce::jlimit(-1.0f, 1.0f, (static_cast<float>(value) - centre) / centre);
    pitchWheelSemitones = normalised * 2.0f;
}

void WavetableVoice::controllerMoved(int, int)
{
}

double WavetableVoice::tuningRatio(float octave,
                                   float semitone,
                                   float fineCents,
                                   float bendSemitones) noexcept
{
    const auto totalSemitones = octave * 12.0f + semitone + fineCents / 100.0f + bendSemitones;
    return std::pow(2.0, static_cast<double>(totalSemitones) / 12.0);
}

void WavetableVoice::updateEnvelope()
{
    juce::ADSR::Parameters p;
    p.attack = envAttack->load();
    p.decay = envDecay->load();
    p.sustain = envSustain->load();
    p.release = envRelease->load();
    ampEnvelope.setParameters(p);
}

void WavetableVoice::renderNextBlock(juce::AudioBuffer<float>& outputBuffer,
                                     int startSample,
                                     int numSamples)
{
    if (! isVoiceActive())
        return;

    const auto sampleRate = getSampleRate();
    if (sampleRate <= 0.0)
        return;

    updateEnvelope();

    const auto table1 = static_cast<int>(std::lround(osc1Table->load()));
    const auto table2 = static_cast<int>(std::lround(osc2Table->load()));
    const auto position1 = osc1Position->load();
    const auto position2 = osc2Position->load();
    const auto level1 = osc1Level->load();
    const auto level2 = osc2Level->load();
    const auto master = masterVolume->load();

    const auto frequency1 = baseFrequency * tuningRatio(osc1Octave->load(),
                                                        osc1Semitone->load(),
                                                        osc1Fine->load(),
                                                        pitchWheelSemitones);
    const auto frequency2 = baseFrequency * tuningRatio(osc2Octave->load(),
                                                        osc2Semitone->load(),
                                                        osc2Fine->load(),
                                                        pitchWheelSemitones);

    const auto increment1 = frequency1 / sampleRate;
    const auto increment2 = frequency2 / sampleRate;
    const auto channels = outputBuffer.getNumChannels();

    for (int sampleIndex = 0; sampleIndex < numSamples; ++sampleIndex)
    {
        const auto envelope = ampEnvelope.getNextSample();
        const auto oscSample = wavetableBank.sample(table1, position1, phase1) * level1
                             + wavetableBank.sample(table2, position2, phase2) * level2;
        const auto sample = oscSample * envelope * noteVelocity * master * 0.5f;
        const auto destinationSample = startSample + sampleIndex;

        for (int channel = 0; channel < channels; ++channel)
            outputBuffer.addSample(channel, destinationSample, sample);

        phase1 += increment1;
        phase2 += increment2;
        phase1 -= std::floor(phase1);
        phase2 -= std::floor(phase2);
    }

    if (! ampEnvelope.isActive())
        clearCurrentNote();
}
}
