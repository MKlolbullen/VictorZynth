export type WavetableId = 'analog-warmth' | 'spectral-void' | 'celestial-drone' | 'vocal-formants' | 'cyber-wavefold' | 'metallic-bell';

export type WarpMode = 'none' | 'sync' | 'bend' | 'fm' | 'wavefold' | 'pwm';

export type FilterType = 'lowpass24' | 'lowpass12' | 'bandpass' | 'highpass' | 'comb' | 'notch';

export type LFOShape = 'sine' | 'triangle' | 'sawUp' | 'sawDown' | 'square' | 'sampleHold' | 'smoothRandom';

export type ModSource =
  | 'lfo1'
  | 'lfo2'
  | 'env1'
  | 'env2'
  | 'macro1'
  | 'macro2'
  | 'macro3'
  | 'macro4'
  | 'modWheel'
  | 'pitchBend'
  | 'velocity'
  | 'chaos';

export type ModDestination =
  | 'osc1_pitch'
  | 'osc1_pos'
  | 'osc1_warp'
  | 'osc1_level'
  | 'osc2_pitch'
  | 'osc2_pos'
  | 'osc2_warp'
  | 'osc2_level'
  | 'filter_cutoff'
  | 'filter_res'
  | 'filter_drive'
  | 'reverb_mix'
  | 'delay_mix'
  | 'delay_time'
  | 'chorus_mix'
  | 'lfo1_rate'
  | 'lfo2_rate'
  | 'pan';

export interface ModRouting {
  id: string;
  source: ModSource;
  destination: ModDestination;
  amount: number; // -1.0 to 1.0
  bipolar: boolean;
  enabled: boolean;
}

export interface OscillatorParams {
  tableId: WavetableId;
  position: number; // 0.0 to 1.0 (wavetable slice scan)
  octave: number; // -3 to +3
  semitone: number; // -12 to +12
  fine: number; // -100 to +100 cents
  warpMode: WarpMode;
  warpAmount: number; // 0.0 to 1.0
  unison: number; // 1 to 7 voices
  detune: number; // 0.0 to 1.0
  pan: number; // -1.0 to 1.0
  level: number; // 0.0 to 1.0
  enabled: boolean;
}

export interface SubOscParams {
  waveform: 'sine' | 'triangle' | 'square';
  octave: number; // -2 or -1
  level: number; // 0.0 to 1.0
  enabled: boolean;
}

export interface NoiseParams {
  type: 'white' | 'pink' | 'cosmic';
  level: number; // 0.0 to 1.0
  enabled: boolean;
}

export interface FilterParams {
  type: FilterType;
  cutoff: number; // 20 to 20000 Hz
  resonance: number; // 0.1 to 20
  drive: number; // 0.0 to 1.0 (saturation)
  keyTracking: number; // 0.0 to 1.0
  enabled: boolean;
}

export interface EnvelopeParams {
  attack: number; // 0.001 to 8.0 seconds
  decay: number; // 0.01 to 10.0 seconds
  sustain: number; // 0.0 to 1.0
  release: number; // 0.01 to 12.0 seconds
}

export interface LFOParams {
  shape: LFOShape;
  rate: number; // 0.05 to 30 Hz or sync subdivisions
  sync: boolean;
  syncDivision: string; // '1/16', '1/8', '1/4', '1/2', '1/1', '2/1', '4/1'
  retrigger: boolean;
  phase: number; // 0.0 to 1.0
}

export interface EffectsParams {
  reverb: {
    enabled: boolean;
    decay: number; // 0.5 to 15.0 s
    size: number; // 0.0 to 1.0
    damp: number; // 0.0 to 1.0
    shimmer: number; // 0.0 to 1.0 (octave shimmer level)
    mix: number; // 0.0 to 1.0
  };
  delay: {
    enabled: boolean;
    time: number; // 0.05 to 1.5 s or sync division
    feedback: number; // 0.0 to 0.95
    pingPong: boolean;
    tone: number; // 200 to 10000 Hz
    mix: number; // 0.0 to 1.0
  };
  chorus: {
    enabled: boolean;
    rate: number; // 0.1 to 8.0 Hz
    depth: number; // 0.0 to 1.0
    feedback: number; // 0.0 to 0.8
    mix: number; // 0.0 to 1.0
  };
  master: {
    drive: number; // 0.0 to 1.0
    volume: number; // 0.0 to 1.0
    limiter: boolean;
  };
}

export interface SynthState {
  osc1: OscillatorParams;
  osc2: OscillatorParams;
  sub: SubOscParams;
  noise: NoiseParams;
  filter: FilterParams;
  env1: EnvelopeParams; // Amp envelope
  env2: EnvelopeParams; // Mod/Filter envelope
  lfo1: LFOParams;
  lfo2: LFOParams;
  macros: [number, number, number, number]; // 4 macro knobs (0.0 to 1.0)
  macroNames: [string, string, string, string];
  modMatrix: ModRouting[];
  effects: EffectsParams;
  glide: number; // 0.0 to 1.0s portamento
  polyphony: 'poly' | 'mono' | 'legato';
  droneMode: boolean; // Continuous soundscape drone hold
  octave: number; // Virtual keyboard octave (-2 to +2)
}

export type PresetCategory =
  | 'All'
  | 'Pads'
  | 'Leads'
  | 'Bass'
  | 'FX'
  | 'Atmospheres'
  | 'Ambient Drones'
  | 'Cinematic'
  | 'User';

export interface Preset {
  id: string;
  name: string;
  category: PresetCategory | string;
  description: string;
  state: SynthState;
  isUserPreset?: boolean;
  createdAt?: number;
}

export interface ReaperHostState {
  tempo: number; // BPM
  isPlaying: boolean;
  timeSignature: [number, number];
  sampleRate: number;
  bufferSize: number;
  activeTrack: number;
  trackName: string;
  midiConnected: boolean;
  midiDeviceName: string;
  cpuLoad: number;
}
