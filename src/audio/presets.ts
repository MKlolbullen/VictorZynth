import { Preset, SynthState } from '../types/synth';

export const INITIAL_SYNTH_STATE: SynthState = {
  osc1: {
    tableId: 'celestial-drone',
    position: 0.25,
    octave: 0,
    semitone: 0,
    fine: 0,
    warpMode: 'bend',
    warpAmount: 0.2,
    unison: 3,
    detune: 0.15,
    pan: -0.2,
    level: 0.85,
    enabled: true,
    phase: 0,
  },
  osc2: {
    tableId: 'spectral-void',
    position: 0.5,
    octave: -1,
    semitone: 7, // Fifth interval
    fine: 8,
    warpMode: 'wavefold',
    warpAmount: 0.35,
    unison: 2,
    detune: 0.2,
    pan: 0.2,
    level: 0.7,
    enabled: true,
    phase: 0,
  },
  sub: {
    waveform: 'sine',
    octave: -1,
    level: 0.4,
    enabled: true,
  },
  noise: {
    type: 'cosmic',
    level: 0.15,
    enabled: true,
  },
  filter: {
    type: 'lowpass24',
    cutoff: 2800,
    resonance: 3.5,
    drive: 0.3,
    keyTracking: 0.5,
    enabled: true,
  },
  env1: {
    // Amp envelope
    attack: 0.4,
    decay: 1.8,
    sustain: 0.75,
    release: 2.5,
  },
  env2: {
    // Mod envelope
    attack: 0.8,
    decay: 2.5,
    sustain: 0.3,
    release: 3.0,
  },
  lfo1: {
    shape: 'triangle',
    rate: 0.35, // Hz
    sync: false,
    syncDivision: '1/2',
    retrigger: false,
    phase: 0,
  },
  lfo2: {
    shape: 'smoothRandom',
    rate: 0.18, // Hz
    sync: false,
    syncDivision: '1/1',
    retrigger: false,
    phase: 0.25,
  },
  macros: [0.65, 0.45, 0.5, 0.7],
  macroNames: ['Atmosphere', 'Morph Scan', 'Motion LFO', 'Shimmer Space'],
  modMatrix: [
    {
      id: 'm1',
      source: 'lfo1',
      destination: 'osc1_pos',
      amount: 0.4,
      bipolar: true,
      enabled: true,
    },
    {
      id: 'm2',
      source: 'lfo2',
      destination: 'filter_cutoff',
      amount: 0.55,
      bipolar: true,
      enabled: true,
    },
    {
      id: 'm3',
      source: 'env2',
      destination: 'osc2_warp',
      amount: 0.45,
      bipolar: false,
      enabled: true,
    },
    {
      id: 'm4',
      source: 'macro1',
      destination: 'reverb_mix',
      amount: 0.6,
      bipolar: false,
      enabled: true,
    },
    {
      id: 'm5',
      source: 'macro2',
      destination: 'osc2_pos',
      amount: 0.5,
      bipolar: false,
      enabled: true,
    },
    {
      id: 'm6',
      source: 'chaos',
      destination: 'filter_res',
      amount: 0.25,
      bipolar: true,
      enabled: true,
    },
  ],
  effects: {
    reverb: {
      enabled: true,
      decay: 6.5,
      size: 0.85,
      damp: 0.3,
      shimmer: 0.45,
      mix: 0.45,
    },
    delay: {
      enabled: true,
      time: 0.45,
      feedback: 0.55,
      pingPong: true,
      tone: 3200,
      mix: 0.35,
    },
    chorus: {
      enabled: true,
      rate: 0.8,
      depth: 0.6,
      feedback: 0.3,
      mix: 0.4,
    },
    master: {
      drive: 0.15,
      volume: 0.8,
      limiter: true,
    },
  },
  glide: 0.05,
  polyphony: 'poly',
  droneMode: false,
  octave: 0,
};

export const PRESET_LIBRARY: Preset[] = [
  {
    id: 'celestial-void',
    name: 'Celestial Void',
    category: 'Atmospheres',
    description: 'Evolving ethereal soundscape with dual wavetable morphing and shimmering ambient space.',
    state: INITIAL_SYNTH_STATE,
  },
  {
    id: 'cyberpunk-reese',
    name: 'Cyberpunk Abyss',
    category: 'Bass',
    description: 'Aggressive wavefolded Reese bass with sync harmonics, warm saturation, and stereo widening.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'cyber-wavefold',
        position: 0.65,
        octave: -1,
        semitone: 0,
        fine: -6,
        warpMode: 'wavefold',
        warpAmount: 0.55,
        unison: 5,
        detune: 0.35,
        pan: -0.1,
        level: 0.9,
        enabled: true,
      },
      osc2: {
        tableId: 'analog-warmth',
        position: 0.75,
        octave: -1,
        semitone: 0,
        fine: 7,
        warpMode: 'sync',
        warpAmount: 0.4,
        unison: 4,
        detune: 0.28,
        pan: 0.1,
        level: 0.8,
        enabled: true,
      },
      filter: {
        type: 'lowpass24',
        cutoff: 1100,
        resonance: 4.8,
        drive: 0.65,
        keyTracking: 0.3,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        reverb: { ...INITIAL_SYNTH_STATE.effects.reverb, mix: 0.25, decay: 3.0 },
        delay: { ...INITIAL_SYNTH_STATE.effects.delay, mix: 0.25, feedback: 0.4 },
        master: { drive: 0.45, volume: 0.85, limiter: true },
      },
    },
  },
  {
    id: 'solar-wind-shimmer',
    name: 'Solar Wind Shimmer',
    category: 'Pads',
    description: 'Slow bloom vowel formant pad with cosmic noise dispersion and celestial top octave shimmer.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'vocal-formants',
        position: 0.1,
        octave: 0,
        semitone: 0,
        fine: 0,
        warpMode: 'fm',
        warpAmount: 0.25,
        unison: 4,
        detune: 0.2,
        pan: -0.3,
        level: 0.8,
        enabled: true,
      },
      osc2: {
        tableId: 'celestial-drone',
        position: 0.4,
        octave: 1,
        semitone: 0,
        fine: 5,
        warpMode: 'bend',
        warpAmount: 0.3,
        unison: 3,
        detune: 0.25,
        pan: 0.3,
        level: 0.75,
        enabled: true,
      },
      env1: {
        attack: 1.2,
        decay: 3.0,
        sustain: 0.9,
        release: 4.0,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        reverb: { enabled: true, decay: 9.0, size: 0.95, damp: 0.2, shimmer: 0.7, mix: 0.6 },
        delay: { enabled: true, time: 0.6, feedback: 0.65, pingPong: true, tone: 4000, mix: 0.45 },
      },
    },
  },
  {
    id: 'subterranean-drone',
    name: 'Subterranean Drone',
    category: 'Ambient Drones',
    description: 'Deep subterranean earth rumble with metallic inharmonic resonances and chaotic modulation.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'metallic-bell',
        position: 0.7,
        octave: -2,
        semitone: 0,
        fine: 0,
        warpMode: 'pwm',
        warpAmount: 0.4,
        unison: 3,
        detune: 0.15,
        pan: 0,
        level: 0.85,
        enabled: true,
      },
      osc2: {
        tableId: 'spectral-void',
        position: 0.8,
        octave: -1,
        semitone: 5,
        fine: -12,
        warpMode: 'wavefold',
        warpAmount: 0.5,
        unison: 2,
        detune: 0.3,
        pan: 0,
        level: 0.7,
        enabled: true,
      },
      sub: {
        waveform: 'sine',
        octave: -2,
        level: 0.7,
        enabled: true,
      },
      filter: {
        type: 'comb',
        cutoff: 450,
        resonance: 8.5,
        drive: 0.4,
        keyTracking: 0.4,
        enabled: true,
      },
    },
  },
  {
    id: 'crystalline-arp',
    name: 'Crystalline Pluck',
    category: 'Cinematic',
    description: 'Crisp percussive metallic bells with ping-pong tape delays and expansive spatial shimmer.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'metallic-bell',
        position: 0.2,
        octave: 1,
        semitone: 0,
        fine: 0,
        warpMode: 'sync',
        warpAmount: 0.3,
        unison: 3,
        detune: 0.1,
        pan: -0.2,
        level: 0.9,
        enabled: true,
      },
      osc2: {
        tableId: 'celestial-drone',
        position: 0.1,
        octave: 0,
        semitone: 12,
        fine: 3,
        warpMode: 'bend',
        warpAmount: 0.1,
        unison: 2,
        detune: 0.12,
        pan: 0.2,
        level: 0.65,
        enabled: true,
      },
      env1: {
        attack: 0.005,
        decay: 1.2,
        sustain: 0.1,
        release: 1.5,
      },
      filter: {
        type: 'lowpass12',
        cutoff: 5500,
        resonance: 2.2,
        drive: 0.1,
        keyTracking: 0.8,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        delay: { enabled: true, time: 0.32, feedback: 0.6, pingPong: true, tone: 5000, mix: 0.5 },
        reverb: { enabled: true, decay: 5.0, size: 0.8, damp: 0.3, shimmer: 0.5, mix: 0.4 },
      },
    },
  },
  {
    id: 'init-patch',
    name: 'Init Clean Wavetable',
    category: 'Atmospheres',
    description: 'Single pure analog warmth wavetable slice ready for modular patch sound design.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'analog-warmth',
        position: 0.0,
        octave: 0,
        semitone: 0,
        fine: 0,
        warpMode: 'none',
        warpAmount: 0,
        unison: 1,
        detune: 0,
        pan: 0,
        level: 0.9,
        enabled: true,
      },
      osc2: {
        ...INITIAL_SYNTH_STATE.osc2,
        enabled: false,
      },
      filter: {
        type: 'lowpass24',
        cutoff: 12000,
        resonance: 1.0,
        drive: 0.0,
        keyTracking: 0.0,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        reverb: { ...INITIAL_SYNTH_STATE.effects.reverb, mix: 0.15 },
        delay: { ...INITIAL_SYNTH_STATE.effects.delay, mix: 0.0 },
        chorus: { ...INITIAL_SYNTH_STATE.effects.chorus, mix: 0.0 },
      },
    },
  },
  {
    id: 'cyber-neon-lead',
    name: 'Cyber Neon Solo',
    category: 'Leads',
    description: 'Cutting sync-lead with fast vibrato modulation, stereo chorus delay, and rich harmonic overtones.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'analog-warmth',
        position: 0.45,
        octave: 0,
        semitone: 0,
        fine: 0,
        warpMode: 'sync',
        warpAmount: 0.62,
        unison: 2,
        detune: 0.08,
        pan: -0.1,
        level: 0.95,
        enabled: true,
      },
      osc2: {
        tableId: 'cyber-wavefold',
        position: 0.2,
        octave: 1,
        semitone: 0,
        fine: 4,
        warpMode: 'bend',
        warpAmount: 0.3,
        unison: 1,
        detune: 0,
        pan: 0.1,
        level: 0.75,
        enabled: true,
      },
      env1: {
        attack: 0.015,
        decay: 1.2,
        sustain: 0.65,
        release: 0.8,
      },
      filter: {
        type: 'lowpass24',
        cutoff: 4800,
        resonance: 4.2,
        drive: 0.45,
        keyTracking: 0.8,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        delay: { enabled: true, time: 0.25, feedback: 0.45, pingPong: true, tone: 4500, mix: 0.35 },
        chorus: { enabled: true, rate: 1.2, depth: 0.7, feedback: 0.3, mix: 0.45 },
        reverb: { ...INITIAL_SYNTH_STATE.effects.reverb, mix: 0.3, decay: 3.5 },
      },
    },
  },
  {
    id: 'vocal-formant-lead',
    name: 'Astral Vowel Lead',
    category: 'Leads',
    description: 'Expressive vowel formant lead with FM modulation warp, envelope punch, and soaring top end.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'vocal-formants',
        position: 0.35,
        octave: 1,
        semitone: 0,
        fine: 0,
        warpMode: 'fm',
        warpAmount: 0.4,
        unison: 3,
        detune: 0.12,
        pan: 0,
        level: 0.9,
        enabled: true,
      },
      osc2: {
        tableId: 'metallic-bell',
        position: 0.15,
        octave: 0,
        semitone: 7,
        fine: 3,
        warpMode: 'pwm',
        warpAmount: 0.3,
        unison: 2,
        detune: 0.15,
        pan: 0.2,
        level: 0.6,
        enabled: true,
      },
      filter: {
        type: 'bandpass',
        cutoff: 2400,
        resonance: 5.5,
        drive: 0.35,
        keyTracking: 0.6,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        reverb: { enabled: true, decay: 5.5, size: 0.85, damp: 0.25, shimmer: 0.6, mix: 0.4 },
        delay: { enabled: true, time: 0.35, feedback: 0.5, pingPong: true, tone: 4000, mix: 0.35 },
      },
    },
  },
  {
    id: 'singularity-void-fx',
    name: 'Singularity Void Rift',
    category: 'FX',
    description: 'Chaotic sound design texture with sweeping comb filter, cosmic noise explosion, and self-oscillating delay.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'spectral-void',
        position: 0.85,
        octave: -1,
        semitone: 6, // Tritone dissonance
        fine: 15,
        warpMode: 'wavefold',
        warpAmount: 0.85,
        unison: 4,
        detune: 0.4,
        pan: -0.4,
        level: 0.8,
        enabled: true,
      },
      noise: {
        type: 'cosmic',
        level: 0.45,
        enabled: true,
      },
      filter: {
        type: 'comb',
        cutoff: 820,
        resonance: 14.5,
        drive: 0.7,
        keyTracking: 0.2,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        reverb: { enabled: true, decay: 12.0, size: 1.0, damp: 0.1, shimmer: 0.85, mix: 0.65 },
        delay: { enabled: true, time: 0.75, feedback: 0.8, pingPong: true, tone: 2200, mix: 0.55 },
        chorus: { enabled: true, rate: 3.5, depth: 0.9, feedback: 0.6, mix: 0.6 },
        master: { drive: 0.5, volume: 0.75, limiter: true },
      },
    },
  },
  {
    id: 'cosmic-glitch-swarm',
    name: 'Cosmic Glitch Swarm',
    category: 'FX',
    description: 'Sample & hold chaotic pitch scatter with ping-pong tape stutter and resonant notch filter sweeps.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'metallic-bell',
        position: 0.6,
        octave: 0,
        semitone: 11,
        fine: -25,
        warpMode: 'sync',
        warpAmount: 0.75,
        unison: 3,
        detune: 0.3,
        pan: 0.3,
        level: 0.85,
        enabled: true,
      },
      lfo1: {
        shape: 'sampleHold',
        rate: 8.5,
        sync: false,
        syncDivision: '1/16',
        retrigger: true,
        phase: 0,
      },
      filter: {
        type: 'notch',
        cutoff: 3100,
        resonance: 12.0,
        drive: 0.5,
        keyTracking: 0.1,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        delay: { enabled: true, time: 0.14, feedback: 0.75, pingPong: true, tone: 6000, mix: 0.5 },
        reverb: { enabled: true, decay: 4.0, size: 0.7, damp: 0.4, shimmer: 0.3, mix: 0.4 },
      },
    },
  },
  {
    id: 'ethereal-silk-bloom',
    name: 'Ethereal Silk Bloom',
    category: 'Pads',
    description: 'Ultra-wide lush cinematic atmospheric pad with slow evolving filter bloom and celestial shimmer.',
    state: {
      ...INITIAL_SYNTH_STATE,
      osc1: {
        tableId: 'celestial-drone',
        position: 0.3,
        octave: 0,
        semitone: 0,
        fine: -4,
        warpMode: 'bend',
        warpAmount: 0.25,
        unison: 6,
        detune: 0.22,
        pan: -0.35,
        level: 0.85,
        enabled: true,
      },
      osc2: {
        tableId: 'spectral-void',
        position: 0.4,
        octave: 0,
        semitone: 7,
        fine: 6,
        warpMode: 'wavefold',
        warpAmount: 0.2,
        unison: 5,
        detune: 0.25,
        pan: 0.35,
        level: 0.75,
        enabled: true,
      },
      env1: {
        attack: 2.0,
        decay: 3.5,
        sustain: 0.85,
        release: 4.5,
      },
      filter: {
        type: 'lowpass24',
        cutoff: 2100,
        resonance: 2.8,
        drive: 0.15,
        keyTracking: 0.5,
        enabled: true,
      },
      effects: {
        ...INITIAL_SYNTH_STATE.effects,
        reverb: { enabled: true, decay: 10.5, size: 0.95, damp: 0.2, shimmer: 0.75, mix: 0.6 },
        delay: { enabled: true, time: 0.55, feedback: 0.6, pingPong: true, tone: 3500, mix: 0.4 },
        chorus: { enabled: true, rate: 0.6, depth: 0.8, feedback: 0.35, mix: 0.55 },
      },
    },
  },
];

const LOCAL_STORAGE_KEY = 'aetherwave_user_presets_v1';

export function getLocalUserPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load user presets from localStorage', e);
    return [];
  }
}

export function saveLocalUserPreset(preset: Preset): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getLocalUserPresets();
    const existingIndex = current.findIndex((p) => p.id === preset.id);
    let updated: Preset[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = preset;
    } else {
      updated = [preset, ...current];
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save user preset to localStorage', e);
    return [];
  }
}

export function deleteLocalUserPreset(id: string): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getLocalUserPresets();
    const updated = current.filter((p) => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete user preset from localStorage', e);
    return [];
  }
}
