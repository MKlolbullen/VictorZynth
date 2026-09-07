import React, { useState } from 'react';
import { SynthState, Preset, PresetCategory, ModSource, ModDestination } from '../types/synth';
import { saveLocalUserPreset, deleteLocalUserPreset } from '../audio/presets';
import {
  X,
  Copy,
  Check,
  Download,
  FileCode,
  BookmarkPlus,
  Trash2,
  FolderOpen,
  Sparkles,
  Tag,
  Save,
  Sliders,
  Search,
  Info,
  Radio,
  ExternalLink,
  Activity,
} from 'lucide-react';

interface ReaperExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: SynthState;
  currentPreset: Preset;
  userPresets?: Preset[];
  onSaveUserPreset?: (preset: Preset) => void;
  onDeleteUserPreset?: (id: string) => void;
  onLoadPreset?: (preset: Preset) => void;
}

export const ReaperExportModal: React.FC<ReaperExportModalProps> = ({
  isOpen,
  onClose,
  currentState,
  currentPreset,
  userPresets = [],
  onSaveUserPreset,
  onDeleteUserPreset,
  onLoadPreset,
}) => {
  const [activeTab, setActiveTab] = useState<'user-presets' | 'midi-cc' | 'jsfx' | 'preset' | 'vst-guide'>('user-presets');
  const [copied, setCopied] = useState(false);
  const [copiedCCText, setCopiedCCText] = useState(false);
  const [ccSearch, setCcSearch] = useState('');
  const [ccCategory, setCcCategory] = useState<'all' | 'active' | 'macros' | 'performance' | 'filter' | 'fx'>('all');

  // Form state for saving local user preset
  const [patchName, setPatchName] = useState(
    currentPreset.isUserPreset ? currentPreset.name : `${currentPreset.name} (Custom)`
  );
  const [patchCategory, setPatchCategory] = useState<string>(
    currentPreset.category === 'All' ? 'Pads' : currentPreset.category || 'Pads'
  );
  const [patchDescription, setPatchDescription] = useState(
    currentPreset.description || 'Custom patch created in AetherWave VSTi for Reaper'
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [loadedNotification, setLoadedNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  // Available categories for saving
  const categoryOptions: PresetCategory[] = [
    'Pads',
    'Leads',
    'Bass',
    'FX',
    'Atmospheres',
    'Ambient Drones',
    'Cinematic',
    'User',
  ];

  // Function to save current SynthState as a local browser-stored preset
  const handleSaveToLocalStorage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!patchName.trim()) return;

    const newPreset: Preset = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: patchName.trim(),
      category: patchCategory,
      description: patchDescription.trim() || 'Custom user soundscape patch',
      state: JSON.parse(JSON.stringify(currentState)),
      isUserPreset: true,
      createdAt: Date.now(),
    };

    // Save to browser localStorage
    saveLocalUserPreset(newPreset);

    // Notify parent App component
    if (onSaveUserPreset) {
      onSaveUserPreset(newPreset);
    }

    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 3500);
  };

  const handleDeleteUserPreset = (id: string) => {
    deleteLocalUserPreset(id);
    if (onDeleteUserPreset) {
      onDeleteUserPreset(id);
    }
  };

  const handleRecallPreset = (preset: Preset) => {
    if (onLoadPreset) {
      onLoadPreset(preset);
      setLoadedNotification(`Loaded "${preset.name}" into synthesizer!`);
      setTimeout(() => setLoadedNotification(null), 3000);
    }
  };

  // Generate real Reaper JSFX script for this synth!
  const generateJSFXCode = () => {
    return `// ==========================================================
// REAPER JSFX: AetherWave Wavetable Soundscape Synthesizer
// Paste this file into your REAPER Effects folder:
// Windows: %APPDATA%\\REAPER\\Effects\\AetherWave
// macOS: ~/Library/Application Support/REAPER/Effects/AetherWave
// ==========================================================
desc: AetherWave Wavetable VSTi [JSFX]
author: Google AI Studio
version: 1.0

slider1:0.25<0,1,0.01>-Osc 1 WT Position
slider2:0<0,5,1{None,Bend,PWM,Wavefold,Sync,FM}>-Osc 1 Warp Mode
slider3:0.2<0,1,0.01>-Osc 1 Warp Amount
slider4:2800<20,20000,1:log>-Filter Cutoff (Hz)
slider5:3.5<0.1,20,0.1>-Filter Resonance
slider6:0.35<0.05,20,0.01>-LFO 1 Rate (Hz)
slider7:0.45<0,1,0.01>-Shimmer Reverb Mix
slider8:0.35<0,1,0.01>-Tape Delay Mix
slider9:0.8<0,1,0.01>-Master Volume

in_pin:none
out_pin:left output
out_pin:right output

@init
  // Initialize wavetable phase accumulator
  phase1 = 0;
  lfo1_phase = 0;
  srate_inv = 1 / srate;
  filter_c = 0; filter_res = 0;
  s1 = 0; s2 = 0; // State variable filter nodes
  delay_pos = 0;
  delay_len = srate * 1.5;
  buf_left = 0;
  buf_right = delay_len;

@slider
  pos1 = slider1;
  warp_mode = slider2;
  warp_amt = slider3;
  cutoff = slider4;
  res = slider5;
  lfo_rate = slider6;
  rev_mix = slider7;
  del_mix = slider8;
  vol = slider9;

  // Calculate biquad filter coefficients
  w0 = 2 * $pi * cutoff * srate_inv;
  alpha = sin(w0) / (2 * res);
  b1 = 1 - cos(w0);
  b0 = b1 * 0.5;
  b2 = b0;
  a0 = 1 + alpha;
  a1 = -2 * cos(w0);
  a2 = 1 - alpha;
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;

@block
  while (midirecv(offset, msg1, msg2, msg3)) (
    status = msg1 & 0xF0;
    status == 0x90 && msg3 > 0 ? (
      // Note On
      note_freq = 440 * pow(2, (msg2 - 69) / 12);
      phase_inc = note_freq * srate_inv;
      gate = 1;
      vel = msg3 / 127;
    ) : status == 0x80 || (status == 0x90 && msg3 == 0) ? (
      // Note Off
      gate = 0;
    );
    midisend(offset, msg1, msg2, msg3);
  );

@sample
  // Real-time Wavetable Morphing oscillator DSP
  phase1 += phase_inc;
  phase1 >= 1 ? phase1 -= 1;

  // LFO 1 Calculation
  lfo1_phase += lfo_rate * srate_inv;
  lfo1_phase >= 1 ? lfo1_phase -= 1;
  lfo1_val = sin(lfo1_phase * 2 * $pi);

  // Modulate wavetable position with LFO
  scan_pos = min(1, max(0, pos1 + lfo1_val * 0.4));
  
  // Interpolated wavetable slice synthesis
  raw_wave = sin(phase1 * 2 * $pi) * (1 - scan_pos) + (phase1 < 0.5 ? 1 : -1) * scan_pos;

  // Warp modifier
  warp_mode == 3 ? (
    raw_wave = sin(raw_wave * (1 + warp_amt * 4)); // Wavefold
  );

  osc_out = raw_wave * (gate ? vel : 0);

  // 2-pole resonant filter
  f_out = b0 * osc_out + b1 * in1 + b2 * in2 - a1 * out1 - a2 * out2;
  in2 = in1; in1 = osc_out;
  out2 = out1; out1 = f_out;

  // Master output with saturation warmth
  final_l = f_out * vol;
  final_r = f_out * vol;

  spl0 = final_l;
  spl1 = final_r;
`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPresetFile = (presetToExport: Preset = currentPreset) => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(presetToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${presetToExport.name.toLowerCase().replace(/\s+/g, '_')}.aetherpreset`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // -------------------------------------------------------------
  // MIDI CC & Modulation Matrix Cheat Sheet Data & Helpers
  // -------------------------------------------------------------
  interface MidiCCItem {
    cc: number | string;
    name: string;
    section: 'Macros' | 'Performance' | 'Oscillators' | 'Filter & Envs' | 'FX';
    sourceKey?: ModSource;
    destKey?: ModDestination;
    range: string;
    currentVal: string;
    description: string;
    reaperParamName: string;
  }

  const getSourceCC = (source: ModSource): string => {
    switch (source) {
      case 'macro1': return 'CC #20';
      case 'macro2': return 'CC #21';
      case 'macro3': return 'CC #22';
      case 'macro4': return 'CC #23';
      case 'modWheel': return 'CC #1';
      case 'chaos': return 'CC #16';
      case 'pitchBend': return 'Pitch Bend';
      case 'velocity': return 'Velocity';
      case 'lfo1': return 'LFO 1 (Internal)';
      case 'lfo2': return 'LFO 2 (Internal)';
      case 'env1': return 'Amp Env (Internal)';
      case 'env2': return 'Mod Env (Internal)';
      default: return 'Internal';
    }
  };

  const getSourceLabel = (source: ModSource): string => {
    switch (source) {
      case 'macro1': return `Macro 1 ("${currentState.macroNames[0]}")`;
      case 'macro2': return `Macro 2 ("${currentState.macroNames[1]}")`;
      case 'macro3': return `Macro 3 ("${currentState.macroNames[2]}")`;
      case 'macro4': return `Macro 4 ("${currentState.macroNames[3]}")`;
      case 'modWheel': return 'Modulation Wheel';
      case 'chaos': return 'Chaos Drift Gen';
      case 'pitchBend': return 'Pitch Bend Wheel';
      case 'velocity': return 'Key Strike Velocity';
      case 'lfo1': return 'LFO 1 Periodic';
      case 'lfo2': return 'LFO 2 Periodic';
      case 'env1': return 'Env 1 (Amp ADSR)';
      case 'env2': return 'Env 2 (Mod ADSR)';
      default: return source;
    }
  };

  const formatDestName = (dest: ModDestination): string => {
    switch (dest) {
      case 'filter_cutoff': return 'Filter Cutoff';
      case 'filter_res': return 'Filter Resonance';
      case 'filter_drive': return 'Filter Drive';
      case 'osc1_pitch': return 'Osc 1 Pitch';
      case 'osc1_pos': return 'Osc 1 WT Pos';
      case 'osc1_warp': return 'Osc 1 Warp';
      case 'osc1_level': return 'Osc 1 Level';
      case 'osc2_pitch': return 'Osc 2 Pitch';
      case 'osc2_pos': return 'Osc 2 WT Pos';
      case 'osc2_warp': return 'Osc 2 Warp';
      case 'osc2_level': return 'Osc 2 Level';
      case 'reverb_mix': return 'Reverb Wet Mix';
      case 'delay_mix': return 'Delay Wet Mix';
      case 'delay_time': return 'Delay Time';
      case 'chorus_mix': return 'Chorus Wet Mix';
      case 'lfo1_rate': return 'LFO 1 Rate';
      case 'lfo2_rate': return 'LFO 2 Rate';
      case 'pan': return 'Pan';
      default: return dest;
    }
  };

  // Comprehensive list of continuous controllers mapped to synthesis engine & modulation matrix
  const midiCCList: MidiCCItem[] = [
    // Performance & Expression
    {
      cc: 1,
      name: 'Modulation Wheel',
      section: 'Performance',
      sourceKey: 'modWheel',
      range: '0 - 127 (0.0 - 1.0)',
      currentVal: '0%',
      description: 'Primary performance mod wheel; routes to vibrato, filter sweeps, and matrix destinations',
      reaperParamName: 'Mod Wheel',
    },
    {
      cc: 16,
      name: 'Chaos Generator',
      section: 'Performance',
      sourceKey: 'chaos',
      range: '0 - 127 (0.0 - 1.0)',
      currentVal: 'Analog Drift',
      description: 'Internal sample & hold chaos noise generator for organic soundscape drift',
      reaperParamName: 'Chaos Gen',
    },
    {
      cc: 'PitchBend',
      name: 'Pitch Bend Wheel',
      section: 'Performance',
      sourceKey: 'pitchBend',
      range: '-8192 to +8191 (-1.0 to +1.0)',
      currentVal: 'Center (0)',
      description: 'Standard 14-bit pitch wheel message; routable to any modulation matrix destination',
      reaperParamName: 'Pitch Bend',
    },
    {
      cc: 'Velocity',
      name: 'Key Strike Velocity',
      section: 'Performance',
      sourceKey: 'velocity',
      range: '0 - 127 (0.0 - 1.0)',
      currentVal: 'Dynamic',
      description: 'Note on strike velocity from keyboard or piano roll note velocity lane',
      reaperParamName: 'Velocity',
    },
    {
      cc: 7,
      name: 'Master Output Volume',
      section: 'Performance',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.masterVolume * 100)}%`,
      description: 'Master instrument audio output level',
      reaperParamName: 'Master Volume',
    },
    {
      cc: 64,
      name: 'Damper / Sustain Pedal',
      section: 'Performance',
      range: '0 (Off) / 127 (On)',
      currentVal: 'Pedal Hold',
      description: 'Holds notes and sustains active drone pads without releasing keys',
      reaperParamName: 'Sustain Pedal',
    },

    // Morphing Macros (CC #20 - #23)
    {
      cc: 20,
      name: `Macro 1 ("${currentState.macroNames[0]}")`,
      section: 'Macros',
      sourceKey: 'macro1',
      range: '0 - 127 (0.0 - 1.0)',
      currentVal: `${Math.round(currentState.macros[0] * 100)}%`,
      description: 'Assignable performance macro 1 for multi-target soundscape morphing',
      reaperParamName: `Macro 1 (${currentState.macroNames[0]})`,
    },
    {
      cc: 21,
      name: `Macro 2 ("${currentState.macroNames[1]}")`,
      section: 'Macros',
      sourceKey: 'macro2',
      range: '0 - 127 (0.0 - 1.0)',
      currentVal: `${Math.round(currentState.macros[1] * 100)}%`,
      description: 'Assignable performance macro 2 for multi-target soundscape morphing',
      reaperParamName: `Macro 2 (${currentState.macroNames[1]})`,
    },
    {
      cc: 22,
      name: `Macro 3 ("${currentState.macroNames[2]}")`,
      section: 'Macros',
      sourceKey: 'macro3',
      range: '0 - 127 (0.0 - 1.0)',
      currentVal: `${Math.round(currentState.macros[2] * 100)}%`,
      description: 'Assignable performance macro 3 for multi-target soundscape morphing',
      reaperParamName: `Macro 3 (${currentState.macroNames[2]})`,
    },
    {
      cc: 23,
      name: `Macro 4 ("${currentState.macroNames[3]}")`,
      section: 'Macros',
      sourceKey: 'macro4',
      range: '0 - 127 (0.0 - 1.0)',
      currentVal: `${Math.round(currentState.macros[3] * 100)}%`,
      description: 'Assignable performance macro 4 for multi-target soundscape morphing',
      reaperParamName: `Macro 4 (${currentState.macroNames[3]})`,
    },

    // Filter & Envelopes
    {
      cc: 74,
      name: 'Filter Cutoff Frequency',
      section: 'Filter & Envs',
      destKey: 'filter_cutoff',
      range: '0 - 127 (20 Hz - 20 kHz)',
      currentVal: `${Math.round(currentState.filter.cutoff)} Hz`,
      description: 'Primary ladder/SV filter cutoff frequency (Standard MIDI Brightness)',
      reaperParamName: 'Filter Cutoff',
    },
    {
      cc: 71,
      name: 'Filter Resonance',
      section: 'Filter & Envs',
      destKey: 'filter_res',
      range: '0 - 127 (Q 0.5 - 20)',
      currentVal: currentState.filter.resonance.toFixed(2),
      description: 'Filter peak resonance and harmonic emphasis (Standard MIDI Timbre/Harmonics)',
      reaperParamName: 'Filter Resonance',
    },
    {
      cc: 73,
      name: 'Amp Env Attack (Env 1)',
      section: 'Filter & Envs',
      sourceKey: 'env1',
      range: '0 - 127 (0.002s - 6s)',
      currentVal: `${currentState.env1.attack.toFixed(2)}s`,
      description: 'Attack rise time of main amplitude envelope (MIDI Attack Time)',
      reaperParamName: 'Env 1 Attack',
    },
    {
      cc: 75,
      name: 'Amp Env Decay (Env 1)',
      section: 'Filter & Envs',
      range: '0 - 127 (0.01s - 8s)',
      currentVal: `${currentState.env1.decay.toFixed(2)}s`,
      description: 'Decay fall time from peak attack to sustain level (MIDI Decay Time)',
      reaperParamName: 'Env 1 Decay',
    },
    {
      cc: 79,
      name: 'Amp Env Sustain (Env 1)',
      section: 'Filter & Envs',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.env1.sustain * 100)}%`,
      description: 'Held audio amplitude while note is sustained',
      reaperParamName: 'Env 1 Sustain',
    },
    {
      cc: 72,
      name: 'Amp Env Release (Env 1)',
      section: 'Filter & Envs',
      range: '0 - 127 (0.01s - 10s)',
      currentVal: `${currentState.env1.release.toFixed(2)}s`,
      description: 'Fade out tail time after note off (MIDI Release Time)',
      reaperParamName: 'Env 1 Release',
    },
    {
      cc: 76,
      name: 'Mod Env Attack (Env 2)',
      section: 'Filter & Envs',
      sourceKey: 'env2',
      range: '0 - 127 (0.002s - 6s)',
      currentVal: `${currentState.env2.attack.toFixed(2)}s`,
      description: 'Modulation envelope attack time',
      reaperParamName: 'Env 2 Attack',
    },
    {
      cc: 77,
      name: 'Mod Env Decay (Env 2)',
      section: 'Filter & Envs',
      range: '0 - 127 (0.01s - 8s)',
      currentVal: `${currentState.env2.decay.toFixed(2)}s`,
      description: 'Modulation envelope decay time',
      reaperParamName: 'Env 2 Decay',
    },
    {
      cc: 78,
      name: 'Mod Env Sustain (Env 2)',
      section: 'Filter & Envs',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.env2.sustain * 100)}%`,
      description: 'Modulation envelope sustain level',
      reaperParamName: 'Env 2 Sustain',
    },
    {
      cc: 80,
      name: 'Mod Env Release (Env 2)',
      section: 'Filter & Envs',
      range: '0 - 127 (0.01s - 10s)',
      currentVal: `${currentState.env2.release.toFixed(2)}s`,
      description: 'Modulation envelope release time',
      reaperParamName: 'Env 2 Release',
    },
    {
      cc: 24,
      name: 'LFO 1 Rate',
      section: 'Filter & Envs',
      sourceKey: 'lfo1',
      destKey: 'lfo1_rate',
      range: '0 - 127 (0.05 - 20 Hz)',
      currentVal: `${currentState.lfo1.rate.toFixed(2)} Hz`,
      description: 'LFO 1 oscillation frequency',
      reaperParamName: 'LFO 1 Rate',
    },
    {
      cc: 26,
      name: 'LFO 2 Rate',
      section: 'Filter & Envs',
      sourceKey: 'lfo2',
      destKey: 'lfo2_rate',
      range: '0 - 127 (0.05 - 20 Hz)',
      currentVal: `${currentState.lfo2.rate.toFixed(2)} Hz`,
      description: 'LFO 2 oscillation frequency',
      reaperParamName: 'LFO 2 Rate',
    },

    // Oscillators
    {
      cc: 14,
      name: 'Osc 1 Wavetable Position',
      section: 'Oscillators',
      destKey: 'osc1_pos',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.osc1.position * 100)}%`,
      description: 'Morphs through wavetable harmonic frames for timbre transformation',
      reaperParamName: 'Osc 1 Pos',
    },
    {
      cc: 15,
      name: 'Osc 1 Warp Amount',
      section: 'Oscillators',
      destKey: 'osc1_warp',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.osc1.warpAmount * 100)}%`,
      description: 'Non-linear wave folding, asymmetry, or sync distortion drive',
      reaperParamName: 'Osc 1 Warp',
    },
    {
      cc: 19,
      name: 'Osc 1 Level',
      section: 'Oscillators',
      destKey: 'osc1_level',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.osc1.level * 100)}%`,
      description: 'Oscillator 1 audio mix level',
      reaperParamName: 'Osc 1 Level',
    },
    {
      cc: 17,
      name: 'Osc 2 Wavetable Position',
      section: 'Oscillators',
      destKey: 'osc2_pos',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.osc2.position * 100)}%`,
      description: 'Morphs oscillator 2 wavetable frames',
      reaperParamName: 'Osc 2 Pos',
    },
    {
      cc: 18,
      name: 'Osc 2 Warp Amount',
      section: 'Oscillators',
      destKey: 'osc2_warp',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.osc2.warpAmount * 100)}%`,
      description: 'Oscillator 2 non-linear wave shaping',
      reaperParamName: 'Osc 2 Warp',
    },
    {
      cc: 12,
      name: 'Sub Oscillator Level',
      section: 'Oscillators',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.subLevel * 100)}%`,
      description: 'Sub bass generator volume',
      reaperParamName: 'Sub Level',
    },
    {
      cc: 13,
      name: 'Noise Generator Level',
      section: 'Oscillators',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.noiseLevel * 100)}%`,
      description: 'Analog noise generator blend for textured air & grit',
      reaperParamName: 'Noise Level',
    },

    // Effects
    {
      cc: 91,
      name: 'Reverb Wet Mix',
      section: 'FX',
      destKey: 'reverb_mix',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.reverb.wet * 100)}%`,
      description: 'Lush algorithmic spatial reverb send level (Standard MIDI Reverb)',
      reaperParamName: 'Reverb Wet',
    },
    {
      cc: 92,
      name: 'Tape Delay Wet Mix',
      section: 'FX',
      destKey: 'delay_mix',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.delay.wet * 100)}%`,
      description: 'Stereo tape delay echo wet level',
      reaperParamName: 'Delay Wet',
    },
    {
      cc: 93,
      name: 'Analog Chorus Wet Mix',
      section: 'FX',
      destKey: 'chorus_mix',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.chorus.wet * 100)}%`,
      description: 'Multi-voice ensemble chorus mix (Standard MIDI Chorus)',
      reaperParamName: 'Chorus Wet',
    },
    {
      cc: 94,
      name: 'Tube Drive / Distortion',
      section: 'FX',
      destKey: 'filter_drive',
      range: '0 - 127 (0% - 100%)',
      currentVal: `${Math.round(currentState.drive * 100)}%`,
      description: 'Analog warmth, tape saturation, and tube distortion drive',
      reaperParamName: 'Drive Amount',
    },
  ];

  // Active matrix routes in current patch
  const activeRoutes = currentState.modMatrix.filter((r) => r.enabled);

  // Check if a CC item is actively mapped in current patch
  const isCCMappedToMatrix = (item: MidiCCItem) => {
    if (item.sourceKey && activeRoutes.some((r) => r.source === item.sourceKey)) {
      return true;
    }
    if (item.destKey && activeRoutes.some((r) => r.destination === item.destKey)) {
      return true;
    }
    return false;
  };

  // Filter CC list based on search and section category
  const filteredCCList = midiCCList.filter((item) => {
    // Search query match
    if (ccSearch.trim() !== '') {
      const q = ccSearch.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCC = String(item.cc).toLowerCase().includes(q);
      const matchSection = item.section.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchReaper = item.reaperParamName.toLowerCase().includes(q);
      if (!matchName && !matchCC && !matchSection && !matchDesc && !matchReaper) {
        return false;
      }
    }

    // Category filter match
    if (ccCategory === 'active') {
      return isCCMappedToMatrix(item);
    }
    if (ccCategory === 'macros') {
      return item.section === 'Macros';
    }
    if (ccCategory === 'performance') {
      return item.section === 'Performance';
    }
    if (ccCategory === 'filter') {
      return item.section === 'Filter & Envs';
    }
    if (ccCategory === 'fx') {
      return item.section === 'FX';
    }
    return true;
  });

  // Copy CC cheat sheet as formatted Markdown
  const handleCopyCCMarkdown = () => {
    let md = `# AetherWave VSTi - MIDI CC & Modulation Matrix Cheat Sheet\n`;
    md += `Patch: ${currentPreset.name} | Category: ${currentPreset.category}\n\n`;
    md += `## 1. Active Modulation Matrix Routings (${activeRoutes.length} Active in Current Patch)\n`;
    activeRoutes.forEach((r, idx) => {
      const srcName = getSourceLabel(r.source);
      const cc = getSourceCC(r.source);
      const dest = formatDestName(r.destination);
      md += `- Route ${idx + 1}: ${srcName} [${cc}] -> ${dest} (Depth: ${r.amount >= 0 ? '+' : ''}${Math.round(r.amount * 100)}%, ${r.bipolar ? 'Bipolar' : 'Unipolar'})\n`;
    });
    md += `\n## 2. Complete MIDI CC Mapping Reference\n`;
    md += `| CC # | Parameter Name | Section | Range | Current Value | Mod Matrix Status |\n`;
    md += `|---|---|---|---|---|---|\n`;
    midiCCList.forEach((item) => {
      const isMapped = isCCMappedToMatrix(item);
      md += `| ${item.cc} | ${item.name} | ${item.section} | ${item.range} | ${item.currentVal} | ${isMapped ? 'ACTIVE IN MATRIX' : 'Available'} |\n`;
    });
    md += `\n## 3. Reaper MIDI Link Quick Instructions\n`;
    md += `1. Open track FX window in REAPER.\n`;
    md += `2. Click 'Param' menu -> 'Parameter modulation/MIDI link'.\n`;
    md += `3. Select parameter and choose 'Link from MIDI or FX parameter' -> MIDI -> CC.\n`;
    md += `4. Alternatively, select 'Param' -> 'Learn' and turn any knob on your MIDI controller.\n`;

    navigator.clipboard.writeText(md);
    setCopiedCCText(true);
    setTimeout(() => setCopiedCCText(false), 2000);
  };

  // Download Reaper CC Cheat Sheet as a .txt mapping definition
  const handleDownloadCCFile = () => {
    let content = `=================================================================\n`;
    content += `AETHERWAVE VSTi - REAPER MIDI CC & MODULATION MATRIX CHEAT SHEET\n`;
    content += `Patch: ${currentPreset.name} | Category: ${currentPreset.category}\n`;
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `=================================================================\n\n`;
    content += `--- ACTIVE MODULATION MATRIX ROUTES (${activeRoutes.length} Active) ---\n`;
    activeRoutes.forEach((r, idx) => {
      const srcName = getSourceLabel(r.source);
      const cc = getSourceCC(r.source);
      const dest = formatDestName(r.destination);
      content += `[Route #${idx + 1}] ${srcName.padEnd(30)} (${cc.padEnd(12)}) --> ${dest.padEnd(20)} Depth: ${r.amount >= 0 ? '+' : ''}${Math.round(r.amount * 100)}% (${r.bipolar ? 'Bipolar' : 'Unipolar'})\n`;
    });
    content += `\n--- COMPLETE MIDI CC DEFINITIONS ---\n`;
    content += `${'CC #'.padEnd(12)}${'Parameter / Source'.padEnd(36)}${'Section'.padEnd(16)}${'Range'.padEnd(26)}${'Matrix Status'}\n`;
    content += `${'-'.repeat(105)}\n`;
    midiCCList.forEach((item) => {
      const isMapped = isCCMappedToMatrix(item);
      content += `${String(item.cc).padEnd(12)}${item.name.padEnd(36)}${item.section.padEnd(16)}${item.range.padEnd(26)}${isMapped ? 'ACTIVE IN MATRIX' : 'Available'}\n`;
    });
    content += `\n=================================================================\n`;
    content += `REAPER SETUP WORKFLOW:\n`;
    content += `1. In REAPER track FX window, click 'Param' -> 'Parameter modulation/MIDI link'.\n`;
    content += `2. Select target synth parameter -> Check 'Link from MIDI or FX parameter'.\n`;
    content += `3. Choose MIDI -> CC -> Select corresponding CC number from the table above.\n`;
    content += `4. Or click 'Param' -> 'Learn' and move any physical knob/slider on your MIDI hardware!\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AetherWave_Reaper_MIDI_CC_Map_${currentPreset.name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              REAPER DAW Integration & User Presets
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-4 pt-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('user-presets')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'user-presets'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Save & Recall Presets ({userPresets.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('midi-cc')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'midi-cc'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>MIDI CC Cheat Sheet</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-700 font-mono">
              {activeRoutes.length} Matrix Mapped
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('jsfx')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'jsfx'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Native REAPER JSFX Script
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preset')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'preset'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            JSON Export & Dump
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vst-guide')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'vst-guide'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Reaper Setup Workflow
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 text-xs space-y-4 font-sans">
          {/* TAB 1: User Presets (Save SynthState to Local Browser Storage & Recall) */}
          {activeTab === 'user-presets' && (
            <div className="space-y-4">
              {/* Notification Banner */}
              {loadedNotification && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/80 rounded-lg text-emerald-200 font-mono text-xs flex items-center space-x-2 animate-fadeIn">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{loadedNotification}</span>
                </div>
              )}

              {/* 1. Save Current Patch Card */}
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <Save className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-zinc-100 text-xs">
                      Save Current SynthState to Browser Storage
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Local Bank Persistence
                  </span>
                </div>

                <form onSubmit={handleSaveToLocalStorage} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase">
                        Patch Name:
                      </label>
                      <input
                        type="text"
                        value={patchName}
                        onChange={(e) => setPatchName(e.target.value)}
                        placeholder="e.g. Celestial Nebula Pad"
                        className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500 font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase flex items-center space-x-1">
                        <Tag className="w-3 h-3 text-amber-400" />
                        <span>Category:</span>
                      </label>
                      <select
                        value={patchCategory}
                        onChange={(e) => setPatchCategory(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 text-amber-300 px-2 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase">
                      Patch Description / Notes:
                    </label>
                    <input
                      type="text"
                      value={patchDescription}
                      onChange={(e) => setPatchDescription(e.target.value)}
                      placeholder="e.g. Dual wavetable evolving pad with slow envelope filter sweep"
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">
                      Stores current oscillators, filter, modulation matrix, and FX settings in browser.
                    </span>

                    <button
                      type="submit"
                      className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded font-semibold text-xs transition-all ${
                        saveStatus === 'saved'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold shadow-sm'
                      }`}
                    >
                      {saveStatus === 'saved' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved to Bank!</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Save Preset</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. Recallable User Presets Bank List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-zinc-200 text-xs flex items-center space-x-1.5">
                    <FolderOpen className="w-4 h-4 text-cyan-400" />
                    <span>Your Saved User Presets ({userPresets.length})</span>
                  </h4>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Accessible directly in Reaper preset bar
                  </span>
                </div>

                {userPresets.length === 0 ? (
                  <div className="p-5 text-center bg-zinc-950/60 rounded-lg border border-dashed border-zinc-800 text-zinc-400 space-y-1">
                    <Sparkles className="w-6 h-6 text-amber-400/60 mx-auto mb-1" />
                    <p className="text-xs font-medium text-zinc-300">
                      No custom user presets saved yet
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Design your soundscape above and click &quot;Save Preset&quot; to store it locally in this browser.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                    {userPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800/90 hover:border-zinc-700 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-zinc-100 text-xs truncate">
                              {preset.name}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border bg-amber-950/60 text-amber-300 border-amber-800/60">
                              {preset.category}
                            </span>
                            {preset.createdAt && (
                              <span className="text-[9px] text-zinc-500 font-mono hidden sm:inline">
                                {new Date(preset.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {preset.description || 'Custom patch'}
                          </p>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRecallPreset(preset)}
                            className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-xs font-semibold font-mono transition-colors"
                            title="Recall patch into synthesizer"
                          >
                            Recall
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPresetFile(preset)}
                            className="p-1 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 rounded transition-colors"
                            title="Download .aetherpreset JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUserPreset(preset.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: MIDI CC Cheat Sheet & Modulation Matrix Mappings */}
          {activeTab === 'midi-cc' && (
            <div className="space-y-4">
              {/* Top Action Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div>
                  <h3 className="font-semibold text-zinc-100 text-xs flex items-center space-x-1.5">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>MIDI CC Cheat Sheet & Matrix Bindings</span>
                  </h3>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Configure your MIDI keyboard controllers, hardware knobs, or Reaper automation lanes.
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyCCMarkdown}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-700/80 rounded font-medium text-xs transition-colors"
                    title="Copy formatted Markdown table to clipboard"
                  >
                    {copiedCCText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCCText ? 'Copied Markdown!' : 'Copy Cheat Sheet'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCCFile}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded font-medium text-xs transition-colors"
                    title="Download Reaper CC map as a plain text file"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>

              {/* Active Modulation Matrix Routings in Current Patch */}
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-zinc-200 text-xs">
                      Active Patch Modulation Matrix Routings ({activeRoutes.length})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Preset: {currentPreset.name}
                  </span>
                </div>

                {activeRoutes.length === 0 ? (
                  <p className="text-zinc-500 text-[11px] py-1 italic">
                    No modulation matrix routes are currently active in this patch. Configure them in the Modulation Matrix panel.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {activeRoutes.map((route, idx) => {
                      const srcCC = getSourceCC(route.source);
                      const srcLabel = getSourceLabel(route.source);
                      const destLabel = formatDestName(route.destination);

                      return (
                        <div
                          key={route.id || idx}
                          className="bg-zinc-900/90 border border-cyan-900/60 hover:border-cyan-700/80 rounded-lg p-2.5 flex flex-col justify-between space-y-1.5 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5 truncate">
                              <span className="font-semibold text-cyan-300 truncate">
                                {srcLabel}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                                {srcCC}
                              </span>
                            </div>
                            <span className="text-zinc-500 font-mono text-[10px]">
                              Route #{idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[11px]">
                            <span className="text-zinc-500">modulates</span>
                            <span className="font-medium text-amber-300">
                              {destLabel}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[10px]">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-zinc-400">Depth:</span>
                              <span className={`font-mono font-semibold ${route.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {route.amount >= 0 ? `+${Math.round(route.amount * 100)}%` : `${Math.round(route.amount * 100)}%`}
                              </span>
                              <span className="text-zinc-500">
                                ({route.bipolar ? 'Bipolar ±' : 'Unipolar +'})
                              </span>
                            </div>
                            <span className="font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                              Reaper Link: {srcCC}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={ccSearch}
                    onChange={(e) => setCcSearch(e.target.value)}
                    placeholder="Search by CC #, parameter name, section, or Reaper label..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {ccSearch && (
                    <button
                      type="button"
                      onClick={() => setCcSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs px-1"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setCcCategory('all')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      ccCategory === 'all'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    All ({midiCCList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCcCategory('active')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      ccCategory === 'active'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    Active in Matrix ({midiCCList.filter(isCCMappedToMatrix).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCcCategory('macros')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      ccCategory === 'macros'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    Macros (4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCcCategory('performance')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      ccCategory === 'performance'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    Performance
                  </button>
                  <button
                    type="button"
                    onClick={() => setCcCategory('filter')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      ccCategory === 'filter'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    Filter & Envs
                  </button>
                  <button
                    type="button"
                    onClick={() => setCcCategory('fx')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      ccCategory === 'fx'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    FX
                  </button>
                </div>
              </div>

              {/* Full MIDI CC Cheat Sheet Table */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
                        <th className="py-2 px-3 font-semibold w-24">MIDI CC</th>
                        <th className="py-2 px-3 font-semibold">Parameter / Matrix Source</th>
                        <th className="py-2 px-3 font-semibold w-24">Section</th>
                        <th className="py-2 px-3 font-semibold w-24">Patch Val</th>
                        <th className="py-2 px-3 font-semibold">Matrix Status</th>
                        <th className="py-2 px-3 font-semibold">Reaper Learn Parameter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-sans">
                      {filteredCCList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-zinc-500 text-xs">
                            No MIDI CC mappings match your search query &quot;{ccSearch}&quot;.
                          </td>
                        </tr>
                      ) : (
                        filteredCCList.map((item) => {
                          const isMapped = isCCMappedToMatrix(item);

                          return (
                            <tr
                              key={String(item.cc) + item.name}
                              className={`hover:bg-zinc-900/60 transition-colors ${
                                isMapped ? 'bg-cyan-950/20' : ''
                              }`}
                            >
                              {/* CC # */}
                              <td className="py-2 px-3 font-mono">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    typeof item.cc === 'number'
                                      ? 'bg-zinc-800 text-cyan-300 border border-zinc-700'
                                      : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                                  }`}
                                >
                                  {typeof item.cc === 'number' ? `CC #${item.cc}` : item.cc}
                                </span>
                              </td>

                              {/* Parameter Name & Description */}
                              <td className="py-2 px-3">
                                <div className="font-medium text-zinc-200">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-zinc-500 truncate max-w-xs">
                                  {item.description}
                                </div>
                              </td>

                              {/* Section */}
                              <td className="py-2 px-3">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                  {item.section}
                                </span>
                              </td>

                              {/* Patch Val */}
                              <td className="py-2 px-3 font-mono text-[11px] text-zinc-300">
                                {item.currentVal}
                              </td>

                              {/* Matrix Status */}
                              <td className="py-2 px-3">
                                {isMapped ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-950 text-cyan-300 border border-cyan-700 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                    <span>Active in Matrix</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    Available
                                  </span>
                                )}
                              </td>

                              {/* Reaper Learn Parameter Name */}
                              <td className="py-2 px-3 font-mono text-[11px] text-zinc-300">
                                <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300 border border-zinc-800">
                                  {item.reaperParamName}
                                </code>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reaper DAW Configuration Guide Card */}
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-2 text-xs">
                <h4 className="font-semibold text-cyan-300 flex items-center space-x-1.5">
                  <Info className="w-4 h-4" />
                  <span>How to map these CC numbers in REAPER:</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px] text-zinc-400">
                  <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800/80 space-y-1">
                    <span className="font-semibold text-zinc-200 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-[10px]">
                        1
                      </span>
                      <span>Hardware Knob Learn</span>
                    </span>
                    <p>
                      In the REAPER FX window, click <strong>Param</strong> &rarr; <strong>Learn</strong>, then turn any physical encoder on your MIDI controller keyboard to bind immediately.
                    </p>
                  </div>
                  <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800/80 space-y-1">
                    <span className="font-semibold text-zinc-200 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-[10px]">
                        2
                      </span>
                      <span>Parameter Modulation</span>
                    </span>
                    <p>
                      Click <strong>Param</strong> &rarr; <strong>Parameter modulation/MIDI link</strong>, check <em>Link from MIDI or FX parameter</em>, and select the CC number from the table above.
                    </p>
                  </div>
                  <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800/80 space-y-1">
                    <span className="font-semibold text-zinc-200 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-[10px]">
                        3
                      </span>
                      <span>Piano Roll CC Automation</span>
                    </span>
                    <p>
                      In REAPER&apos;s MIDI editor, add a CC lane for any controller (e.g. <strong>CC #20 for Macro 1</strong> or <strong>CC #74 for Cutoff</strong>) to draw expressive sound sweeps!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Native REAPER JSFX Script */}
          {activeTab === 'jsfx' && (
            <div className="space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <p className="text-zinc-300 text-xs">
                  Reaper includes Jesusonic (JSFX) compiler natively. You can drop this
                  code file directly into Reaper to run AetherWave as an internal instrument!
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(generateJSFXCode())}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/50 rounded font-semibold transition-colors shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy JSFX'}</span>
                </button>
              </div>

              <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto max-h-72">
                <pre>{generateJSFXCode()}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: Preset Data & Automation */}
          {activeTab === 'preset' && (
            <div className="space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-200 text-xs">{currentPreset.name}</h3>
                  <p className="text-zinc-400 text-[11px]">{currentPreset.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadPresetFile(currentPreset)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/50 rounded font-semibold transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .aetherpreset</span>
                </button>
              </div>

              <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto max-h-64">
                <pre>{JSON.stringify(currentState, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: Reaper Setup Workflow */}
          {activeTab === 'vst-guide' && (
            <div className="space-y-3 font-sans text-xs text-zinc-300">
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-2.5">
                <h4 className="font-semibold text-cyan-300 flex items-center space-x-1.5">
                  <span>How to use in REAPER:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-zinc-300">
                  <li>
                    Open <strong>REAPER</strong> and press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">Ctrl+T</kbd> (or <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">Cmd+T</kbd>) to insert a new Track.
                  </li>
                  <li>
                    Click the <strong>FX</strong> button on the track header.
                  </li>
                  <li>
                    In the FX browser, you can either:
                    <ul className="list-disc list-inside pl-4 pt-1 space-y-1 text-zinc-400 text-[11px]">
                      <li>
                        Paste the <strong>JSFX Script</strong> above into a new JSFX file in your Reaper Effects folder (<code className="text-cyan-300">%APPDATA%\REAPER\Effects\AetherWave</code>).
                      </li>
                      <li>
                        Use this interactive Web VSTi host directly with Web MIDI: plug in your USB MIDI keyboard, click <strong>Enable Audio</strong>, and perform or record your soundscapes!
                      </li>
                    </ul>
                  </li>
                  <li>
                    In REAPER&apos;s transport, arm the track for recording (<span className="text-rose-400 font-bold">Record Arm</span>) and select your MIDI Input.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

