import type { ReaperHostState, SynthState, WavetableId, WarpMode, FilterType, LFOShape } from '../types/synth';
import {
  getNativeHostInfo,
  getNativeAuxiliaryState,
  getNativeParameterSnapshot,
  getNativeTelemetry,
  isNativePluginHost,
  sendNativeAllNotesOff,
  sendNativeModWheel,
  sendNativeNoteOff,
  sendNativeNoteOn,
  sendNativePitchBend,
  setNativeAuxState,
  setNativeModMatrix,
  setNativeParameter,
} from '../native/bridge';
import { SynthAudioEngine as BrowserSynthAudioEngine } from './engine';
import type { LiveModValues } from './engine';

export type { LiveModValues } from './engine';

const TABLES: WavetableId[] = [
  'analog-warmth',
  'spectral-void',
  'celestial-drone',
  'vocal-formants',
  'cyber-wavefold',
  'metallic-bell',
];
const WARPS: WarpMode[] = ['none', 'sync', 'bend', 'fm', 'wavefold', 'pwm'];
const FILTERS: FilterType[] = ['lowpass24', 'lowpass12', 'bandpass', 'highpass', 'comb', 'notch'];
const LFO_SHAPES: LFOShape[] = ['sine', 'triangle', 'sawUp', 'sawDown', 'square', 'sampleHold', 'smoothRandom'];
const SYNC_DIVISIONS = ['1/16', '1/8', '1/4', '1/2', '1/1', '2/1', '4/1'];

function cloneState<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function choiceIndex<T extends string>(choices: readonly T[], value: T): number {
  const index = choices.indexOf(value);
  return index < 0 ? 0 : index;
}

export function flattenState(state: SynthState): Record<string, number> {
  return {
    'osc1.table': choiceIndex(TABLES, state.osc1.tableId),
    'osc1.position': state.osc1.position,
    'osc1.octave': state.osc1.octave,
    'osc1.semitone': state.osc1.semitone,
    'osc1.fine': state.osc1.fine,
    'osc1.warpMode': choiceIndex(WARPS, state.osc1.warpMode),
    'osc1.warpAmount': state.osc1.warpAmount,
    'osc1.unison': state.osc1.unison,
    'osc1.detune': state.osc1.detune,
    'osc1.pan': state.osc1.pan,
    'osc1.level': state.osc1.level,
    'osc1.enabled': state.osc1.enabled ? 1 : 0,
    'osc1.phase': state.osc1.phase ?? 0,

    'osc2.table': choiceIndex(TABLES, state.osc2.tableId),
    'osc2.position': state.osc2.position,
    'osc2.octave': state.osc2.octave,
    'osc2.semitone': state.osc2.semitone,
    'osc2.fine': state.osc2.fine,
    'osc2.warpMode': choiceIndex(WARPS, state.osc2.warpMode),
    'osc2.warpAmount': state.osc2.warpAmount,
    'osc2.unison': state.osc2.unison,
    'osc2.detune': state.osc2.detune,
    'osc2.pan': state.osc2.pan,
    'osc2.level': state.osc2.level,
    'osc2.enabled': state.osc2.enabled ? 1 : 0,
    'osc2.phase': state.osc2.phase ?? 0,

    'sub.waveform': ['sine', 'triangle', 'square'].indexOf(state.sub.waveform),
    'sub.octave': state.sub.octave,
    'sub.level': state.sub.level,
    'sub.enabled': state.sub.enabled ? 1 : 0,

    'noise.type': ['white', 'pink', 'cosmic'].indexOf(state.noise.type),
    'noise.level': state.noise.level,
    'noise.enabled': state.noise.enabled ? 1 : 0,

    'filter.type': choiceIndex(FILTERS, state.filter.type),
    'filter.cutoff': state.filter.cutoff,
    'filter.resonance': state.filter.resonance,
    'filter.drive': state.filter.drive,
    'filter.keyTracking': state.filter.keyTracking,
    'filter.enabled': state.filter.enabled ? 1 : 0,

    'env1.attack': state.env1.attack,
    'env1.decay': state.env1.decay,
    'env1.sustain': state.env1.sustain,
    'env1.release': state.env1.release,
    'env2.attack': state.env2.attack,
    'env2.decay': state.env2.decay,
    'env2.sustain': state.env2.sustain,
    'env2.release': state.env2.release,

    'lfo1.shape': choiceIndex(LFO_SHAPES, state.lfo1.shape),
    'lfo1.rate': state.lfo1.rate,
    'lfo1.sync': state.lfo1.sync ? 1 : 0,
    'lfo1.syncDivision': SYNC_DIVISIONS.indexOf(state.lfo1.syncDivision),
    'lfo1.retrigger': state.lfo1.retrigger ? 1 : 0,
    'lfo1.phase': state.lfo1.phase,
    'lfo2.shape': choiceIndex(LFO_SHAPES, state.lfo2.shape),
    'lfo2.rate': state.lfo2.rate,
    'lfo2.sync': state.lfo2.sync ? 1 : 0,
    'lfo2.syncDivision': SYNC_DIVISIONS.indexOf(state.lfo2.syncDivision),
    'lfo2.retrigger': state.lfo2.retrigger ? 1 : 0,
    'lfo2.phase': state.lfo2.phase,

    'macro.1': state.macros[0],
    'macro.2': state.macros[1],
    'macro.3': state.macros[2],
    'macro.4': state.macros[3],

    'effects.reverb.enabled': state.effects.reverb.enabled ? 1 : 0,
    'effects.reverb.decay': state.effects.reverb.decay,
    'effects.reverb.size': state.effects.reverb.size,
    'effects.reverb.damp': state.effects.reverb.damp,
    'effects.reverb.shimmer': state.effects.reverb.shimmer,
    'effects.reverb.mix': state.effects.reverb.mix,

    'effects.delay.enabled': state.effects.delay.enabled ? 1 : 0,
    'effects.delay.time': state.effects.delay.time,
    'effects.delay.feedback': state.effects.delay.feedback,
    'effects.delay.pingPong': state.effects.delay.pingPong ? 1 : 0,
    'effects.delay.tone': state.effects.delay.tone,
    'effects.delay.mix': state.effects.delay.mix,

    'effects.chorus.enabled': state.effects.chorus.enabled ? 1 : 0,
    'effects.chorus.rate': state.effects.chorus.rate,
    'effects.chorus.depth': state.effects.chorus.depth,
    'effects.chorus.feedback': state.effects.chorus.feedback,
    'effects.chorus.mix': state.effects.chorus.mix,

    'master.drive': state.effects.master.drive,
    'master.volume': state.effects.master.volume,
    'master.limiter': state.effects.master.limiter ? 1 : 0,
    glide: state.glide,
    polyphony: ['poly', 'mono', 'legato'].indexOf(state.polyphony),
    droneMode: state.droneMode ? 1 : 0,
  };
}

export function applyNativeParameters(base: SynthState, snapshot: Record<string, number>): SynthState {
  const result = cloneState(base);
  const choices: Record<string, readonly string[]> = {
    'osc1.table': TABLES, 'osc2.table': TABLES,
    'osc1.warpMode': WARPS, 'osc2.warpMode': WARPS,
    'sub.waveform': ['sine', 'triangle', 'square'],
    'noise.type': ['white', 'pink', 'cosmic'], 'filter.type': FILTERS,
    'lfo1.shape': LFO_SHAPES, 'lfo2.shape': LFO_SHAPES,
    'lfo1.syncDivision': SYNC_DIVISIONS, 'lfo2.syncDivision': SYNC_DIVISIONS,
    polyphony: ['poly', 'mono', 'legato'],
  };
  // Iterate only our known IDs, never arbitrary object paths returned by a host.
  for (const id of Object.keys(flattenState(base))) {
    const value = snapshot[id];
    if (!Number.isFinite(value)) continue;
    let path = id;
    if (id.startsWith('master.')) path = `effects.${id}`;
    if (/^macro\.[1-4]$/.test(id)) path = `macros.${Number(id.split('.')[1]) - 1}`;
    if (id === 'osc1.table' || id === 'osc2.table') path = `${id}Id`;
    const parts = path.split('.');
    const key = parts.pop()!;
    let parent: any = result;
    for (const part of parts) parent = parent[part];
    const choice = choices[id];
    if (choice) {
      const index = Math.round(value);
      if (index >= 0 && index < choice.length) parent[key] = choice[index];
    } else {
      parent[key] = typeof parent[key] === 'boolean' ? value >= 0.5 : value;
    }
  }
  return result;
}

function emptyLiveModValues(): LiveModValues {
  return {
    sources: {
      lfo1: 0,
      lfo2: 0,
      env1: 0,
      env2: 0,
      macro1: 0,
      macro2: 0,
      macro3: 0,
      macro4: 0,
      modWheel: 0,
      pitchBend: 0,
      velocity: 0,
      chaos: 0,
    },
    destinations: {
      osc1_pitch: 0,
      osc1_pos: 0,
      osc1_warp: 0,
      osc1_phase: 0,
      osc1_level: 0,
      osc2_pitch: 0,
      osc2_pos: 0,
      osc2_warp: 0,
      osc2_phase: 0,
      osc2_level: 0,
      filter_cutoff: 0,
      filter_res: 0,
      filter_drive: 0,
      reverb_mix: 0,
      delay_mix: 0,
      delay_time: 0,
      chorus_mix: 0,
      lfo1_rate: 0,
      lfo2_rate: 0,
      pan: 0,
    },
    envStages: {
      env1: 'idle',
      env2: 'idle',
      env1Progress: 0,
      env2Progress: 0,
      activeNoteCount: 0,
    },
  };
}

export class SynthAudioEngine {
  private readonly native = isNativePluginHost();
  private readonly browser: BrowserSynthAudioEngine | null;
  private uiShadow: SynthState;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private lastModMatrixJson = '';
  private lastAuxJson = '';
  private latestParameterSnapshot: Record<string, number> | null = null;
  private stateRevision = 0;
  private polling = false;
  private disposed = false;
  public onStateFromHost: ((state: SynthState) => void) | null = null;

  public liveModValues: LiveModValues;
  public isRecording = false;
  public nativeHostInfo: Partial<ReaperHostState> | null = null;

  constructor(initialState: SynthState) {
    this.uiShadow = cloneState(initialState);
    this.lastModMatrixJson = JSON.stringify(initialState.modMatrix);
    this.lastAuxJson = JSON.stringify({ macroNames: initialState.macroNames, octave: initialState.octave });
    this.browser = this.native ? null : new BrowserSynthAudioEngine(initialState);
    this.liveModValues = this.browser ? this.browser.liveModValues : emptyLiveModValues();

    if (this.native) {
      this.startNativePolling();
    }
  }

  public async initAudio(): Promise<AudioContext | null> {
    if (this.browser) return await this.browser.initAudio();
    this.startNativePolling();
    return null;
  }

  public getAudioContext(): AudioContext | null {
    return this.browser?.getAudioContext() ?? null;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.browser?.getAnalyser() ?? null;
  }

  public updateState(newState: Partial<SynthState>): void {
    if (this.browser) {
      this.browser.updateState(newState);
      return;
    }

    const nextState = { ...this.uiShadow, ...cloneState(newState) } as SynthState;
    ++this.stateRevision;
    const previous = flattenState(this.uiShadow);
    const next = flattenState(nextState);
    const changed = Object.keys(next).filter((id) => Math.abs((next[id] ?? 0) - (previous[id] ?? 0)) > 1.0e-6);

    // A large state jump is a preset/undo/redo operation: intentionally replace the patch.
    // Small UI edits send only changed leaves so unrelated DAW automation is never clobbered.
    const idsToSend = changed.length > 6 ? Object.keys(next) : changed;
    this.uiShadow = cloneState(nextState);

    for (const id of idsToSend) {
      void setNativeParameter(id, next[id]);
    }

    void this.pushAuxiliaryState();
  }

  public noteOn(midiNote: number, velocity = 0.8): void {
    if (this.browser) {
      this.browser.noteOn(midiNote, velocity);
      return;
    }
    void sendNativeNoteOn(midiNote, velocity);
  }

  public noteOff(midiNote: number, force = false): void {
    if (this.browser) {
      this.browser.noteOff(midiNote, force);
      return;
    }
    void sendNativeNoteOff(midiNote);
  }

  public allNotesOff(): void {
    if (this.browser) {
      this.browser.allNotesOff();
      return;
    }
    void sendNativeAllNotesOff();
  }

  public setPitchBend(value: number): void {
    if (this.browser) {
      this.browser.setPitchBend(value);
      return;
    }
    void sendNativePitchBend(Math.max(-1, Math.min(1, value)));
  }

  public setModWheel(value: number): void {
    if (this.browser) {
      this.browser.setModWheel(value);
      return;
    }
    void sendNativeModWheel(Math.max(0, Math.min(1, value)));
  }

  public setMacro(index: 0 | 1 | 2 | 3, value: number): void {
    if (this.browser) {
      this.browser.setMacro(index, value);
      return;
    }

    const clamped = Math.max(0, Math.min(1, value));
    ++this.stateRevision;
    this.uiShadow.macros[index] = clamped;
    void setNativeParameter(`macro.${index + 1}`, clamped);
  }

  public startRecording(): boolean {
    if (this.browser) {
      const started = this.browser.startRecording();
      this.isRecording = this.browser.isRecording;
      return started;
    }

    // In plugin mode the DAW owns render/record/export. Starting a browser MediaRecorder
    // would create a second audio path and is therefore intentionally disabled.
    return false;
  }

  public stopRecording(): Blob | null {
    if (!this.browser) return null;
    const result = this.browser.stopRecording();
    this.isRecording = this.browser.isRecording;
    return result;
  }

  public dispose(): void {
    this.disposed = true;
    if (this.browser) {
      this.browser.dispose();
      return;
    }

    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
    void sendNativeAllNotesOff();
  }

  public getNativeParameterSnapshot(): Record<string, number> | null {
    return this.latestParameterSnapshot ? { ...this.latestParameterSnapshot } : null;
  }

  private startNativePolling(): void {
    if (!this.native || this.telemetryTimer) return;

    const poll = async () => {
      if (this.polling || this.disposed) return;
      this.polling = true;
      const revision = this.stateRevision;
      try {
        const [telemetry, hostInfo, parameterSnapshot, auxiliary] = await Promise.all([
          getNativeTelemetry(), getNativeHostInfo(), getNativeParameterSnapshot(), getNativeAuxiliaryState(),
        ]);
        if (this.disposed) return;
        if (telemetry) this.liveModValues = telemetry;
        if (hostInfo) this.nativeHostInfo = hostInfo;
        if (parameterSnapshot) this.latestParameterSnapshot = parameterSnapshot;
        // Do not overwrite a UI gesture made while this snapshot was in flight.
        if (parameterSnapshot && revision === this.stateRevision) {
          const next = applyNativeParameters(this.uiShadow, parameterSnapshot);
          if (auxiliary) {
            const matrix = JSON.parse(auxiliary.modMatrixJson || '[]');
            const ui = JSON.parse(auxiliary.uiStateJson || '{}');
            if (Array.isArray(matrix)) next.modMatrix = matrix;
            if (Array.isArray(ui.macroNames) && ui.macroNames.length === 4
                && ui.macroNames.every((name: unknown) => typeof name === 'string')) next.macroNames = ui.macroNames;
            if (Number.isFinite(ui.octave)) next.octave = ui.octave;
          }
          this.lastModMatrixJson = JSON.stringify(next.modMatrix);
          this.lastAuxJson = JSON.stringify({ macroNames: next.macroNames, octave: next.octave });
          if (JSON.stringify(next) !== JSON.stringify(this.uiShadow)) {
            this.uiShadow = next;
            this.onStateFromHost?.(cloneState(next));
          }
        }
      } catch (error) {
        console.warn('Native state polling failed', error);
      } finally {
        this.polling = false;
      }
    };

    void poll();
    this.telemetryTimer = setInterval(() => void poll(), 50);
  }

  private async pushAuxiliaryState(): Promise<void> {
    if (!this.native) return;

    const modMatrixJson = JSON.stringify(this.uiShadow.modMatrix);
    if (modMatrixJson !== this.lastModMatrixJson) {
      this.lastModMatrixJson = modMatrixJson;
      await setNativeModMatrix(modMatrixJson);
    }

    const auxJson = JSON.stringify({
      macroNames: this.uiShadow.macroNames,
      octave: this.uiShadow.octave,
    });
    if (auxJson !== this.lastAuxJson) {
      this.lastAuxJson = auxJson;
      await setNativeAuxState(auxJson);
    }
  }
}
