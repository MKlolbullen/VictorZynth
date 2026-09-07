import { SynthState, ModSource, ModDestination, LFOShape, FilterType } from '../types/synth';
import { getInterpolatedWave, bufferToFourier } from './wavetables';

export type EnvelopeStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';

export interface LiveModValues {
  sources: Record<ModSource, number>;
  destinations: Record<ModDestination, number>;
  envStages?: {
    env1: EnvelopeStage;
    env2: EnvelopeStage;
    env1Progress: number;
    env2Progress: number;
    activeNoteCount: number;
  };
}

interface Voice {
  midiNote: number;
  frequency: number;
  velocity: number;
  startTime: number;
  isReleasing: boolean;
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
  panNode: StereoPannerNode | AudioNode;
  osc1Nodes: OscillatorNode[];
  osc1Gains: GainNode[];
  osc2Nodes: OscillatorNode[];
  osc2Gains: GainNode[];
  subOsc?: OscillatorNode;
  subGain?: GainNode;
  noiseSource?: AudioBufferSourceNode;
  noiseGain?: GainNode;
  envLevel: number;
  modEnvLevel: number;
}

export class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  private state: SynthState;
  private voices: Map<number, Voice> = new Map();
  private maxPolyphony = 8;
  
  // FX Nodes
  private filterInputNode: GainNode | null = null;
  private masterFilterNode: BiquadFilterNode | null = null;
  private chorusDelayL: DelayNode | null = null;
  private chorusDelayR: DelayNode | null = null;
  private chorusGain: GainNode | null = null;
  private delayNodeL: DelayNode | null = null;
  private delayNodeR: DelayNode | null = null;
  private delayFeedbackL: GainNode | null = null;
  private delayFeedbackR: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;
  private delayDryNode: GainNode | null = null;
  private delayWetNode: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbDryNode: GainNode | null = null;
  private reverbWetNode: GainNode | null = null;
  private masterDriveNode: WaveShaperNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Real-time Modulation State
  private lfo1Phase = 0;
  private lfo2Phase = 0;
  private chaosValue = 0;
  private chaosTarget = 0;
  private pitchBendValue = 0; // -1 to 1
  private modWheelValue = 0; // 0 to 1
  private lastAnimTime = 0;
  private animFrameId: number | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Cached Periodic Waves for Osc1 & Osc2
  private osc1PeriodicWave: PeriodicWave | null = null;
  private osc2PeriodicWave: PeriodicWave | null = null;
  private lastOsc1Pos = -1;
  private lastOsc2Pos = -1;
  private lastOsc1Phase = -1;
  private lastOsc2Phase = -1;

  // Live modulation metrics exposed to UI
  public liveModValues: LiveModValues = {
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

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingDest: MediaStreamAudioDestinationNode | null = null;
  public isRecording = false;
  private initPromise: Promise<AudioContext> | null = null;

  constructor(initialState: SynthState) {
    this.state = JSON.parse(JSON.stringify(initialState));
  }

  public async initAudio(): Promise<AudioContext> {
    if (this.ctx && this.filterInputNode && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch (e) {
          console.warn('AudioContext resume warning:', e);
        }
      }
      return this.ctx;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        if (!this.ctx || this.ctx.state === 'closed') {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
        }

        // Build the audio graph synchronously before awaiting resume
        // This guarantees all audio nodes exist immediately and prevents AudioNode.connect race conditions
        if (!this.filterInputNode) {
          this.createNoiseBuffer();
          this.setupAudioGraph();
          this.updateWavetables(true);
          this.startModulationLoop();
        }

        if (this.ctx.state === 'suspended') {
          try {
            await this.ctx.resume();
          } catch (e) {
            console.warn('AudioContext resume warning:', e);
          }
        }

        return this.ctx;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds looping buffer
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      // Pinkish/cosmic filtered noise
      const white = Math.random() * 2 - 1;
      lastOut = lastOut * 0.95 + white * 0.05;
      data[i] = lastOut * 3.0;
    }
  }

  private setupAudioGraph() {
    if (!this.ctx) return;

    // Filter Node
    this.filterInputNode = this.ctx.createGain();
    this.masterFilterNode = this.ctx.createBiquadFilter();
    this.applyFilterType(this.masterFilterNode, this.state.filter.type);
    this.masterFilterNode.frequency.value = this.state.filter.cutoff;
    this.masterFilterNode.Q.value = this.state.filter.resonance;

    this.filterInputNode.connect(this.masterFilterNode);

    // Chorus
    this.chorusDelayL = this.ctx.createDelay();
    this.chorusDelayR = this.ctx.createDelay();
    this.chorusDelayL.delayTime.value = 0.015;
    this.chorusDelayR.delayTime.value = 0.022;
    this.chorusGain = this.ctx.createGain();
    this.chorusGain.gain.value = this.state.effects.chorus.mix;

    // Delay Node (Stereo Ping-Pong)
    this.delayDryNode = this.ctx.createGain();
    this.delayWetNode = this.ctx.createGain();
    this.delayNodeL = this.ctx.createDelay(2.0);
    this.delayNodeR = this.ctx.createDelay(2.0);
    this.delayFeedbackL = this.ctx.createGain();
    this.delayFeedbackR = this.ctx.createGain();
    this.delayFilter = this.ctx.createBiquadFilter();

    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.value = this.state.effects.delay.tone;

    this.delayNodeL.delayTime.value = this.state.effects.delay.time;
    this.delayNodeR.delayTime.value = this.state.effects.delay.time * 0.75;
    this.delayFeedbackL.gain.value = this.state.effects.delay.feedback;
    this.delayFeedbackR.gain.value = this.state.effects.delay.feedback;

    // Ping-pong cross routing
    this.delayNodeL.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedbackL);
    this.delayFeedbackL.connect(this.delayNodeR); // L -> R
    this.delayNodeR.connect(this.delayFeedbackR);
    this.delayFeedbackR.connect(this.delayNodeL); // R -> L

    this.delayDryNode.gain.value = 1.0;
    this.delayWetNode.gain.value = this.state.effects.delay.mix;

    // Reverb Node (Algorithmic impulse response)
    this.reverbConvolver = this.ctx.createConvolver();
    this.createReverbImpulse(this.state.effects.reverb.decay, this.state.effects.reverb.damp);
    this.reverbDryNode = this.ctx.createGain();
    this.reverbWetNode = this.ctx.createGain();
    this.reverbDryNode.gain.value = 1.0;
    this.reverbWetNode.gain.value = this.state.effects.reverb.mix;

    // Master Drive
    this.masterDriveNode = this.ctx.createWaveShaper();
    this.updateDriveCurve(this.state.effects.master.drive);

    // Master Compressor / Limiter
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -3.0;
    this.masterCompressor.knee.value = 6.0;
    this.masterCompressor.ratio.value = 12.0;
    this.masterCompressor.attack.value = 0.003;
    this.masterCompressor.release.value = 0.15;

    // Master Volume & Analyser
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.value = this.state.effects.master.volume;

    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.85;

    // Chain Wiring:
    // Filter -> [Dry + Chorus] -> Delay -> Reverb -> Drive -> Limiter -> Master -> Analyser -> Output
    this.masterFilterNode.connect(this.delayDryNode);
    this.masterFilterNode.connect(this.delayNodeL);

    this.delayDryNode.connect(this.reverbDryNode);
    this.delayDryNode.connect(this.reverbConvolver);
    this.delayNodeL.connect(this.delayWetNode);
    this.delayNodeR.connect(this.delayWetNode);
    this.delayWetNode.connect(this.reverbDryNode);
    this.delayWetNode.connect(this.reverbConvolver);

    this.reverbConvolver.connect(this.reverbWetNode);
    this.reverbDryNode.connect(this.masterDriveNode);
    this.reverbWetNode.connect(this.masterDriveNode);

    this.masterDriveNode.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterGainNode);
    this.masterGainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.ctx.destination);
  }

  private applyFilterType(node: BiquadFilterNode, type: FilterType) {
    switch (type) {
      case 'lowpass24':
      case 'lowpass12':
        node.type = 'lowpass';
        break;
      case 'bandpass':
        node.type = 'bandpass';
        break;
      case 'highpass':
        node.type = 'highpass';
        break;
      case 'notch':
      case 'comb':
        node.type = 'notch';
        break;
      default:
        node.type = 'lowpass';
    }
  }

  private updateDriveCurve(driveAmount: number) {
    if (!this.masterDriveNode || !this.ctx) return;
    const k = driveAmount * 15;
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      if (k === 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    this.masterDriveNode.curve = curve;
    this.masterDriveNode.oversample = '4x';
  }

  private createReverbImpulse(decayTime: number, damp: number) {
    if (!this.ctx || !this.reverbConvolver) return;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * Math.max(0.5, Math.min(15, decayTime)));
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      // Exponential decay envelope
      const env = Math.pow(1 - n, 1.5 + (1 - damp) * 2.0);
      // Dual channel decorrelated noise with shimmer partials
      const shimmerHigh = Math.sin(i * 0.08) * (1 - n) * 0.15;
      left[i] = ((Math.random() * 2 - 1) + shimmerHigh) * env;
      right[i] = ((Math.random() * 2 - 1) - shimmerHigh) * env;
    }

    this.reverbConvolver.buffer = impulse;
  }

  public updateState(newState: Partial<SynthState>) {
    this.state = { ...this.state, ...newState };

    if (newState.filter && this.masterFilterNode) {
      this.applyFilterType(this.masterFilterNode, this.state.filter.type);
      this.masterFilterNode.frequency.value = this.state.filter.cutoff;
      this.masterFilterNode.Q.value = this.state.filter.resonance;
    }

    if (newState.effects) {
      if (this.reverbWetNode) {
        this.reverbWetNode.gain.value = this.state.effects.reverb.mix;
      }
      if (this.delayWetNode) {
        this.delayWetNode.gain.value = this.state.effects.delay.mix;
      }
      if (this.delayNodeL && this.delayNodeR) {
        this.delayNodeL.delayTime.value = this.state.effects.delay.time;
        this.delayNodeR.delayTime.value = this.state.effects.delay.time * (this.state.effects.delay.pingPong ? 0.75 : 1.0);
      }
      if (this.delayFeedbackL && this.delayFeedbackR) {
        this.delayFeedbackL.gain.value = this.state.effects.delay.feedback;
        this.delayFeedbackR.gain.value = this.state.effects.delay.feedback;
      }
      if (this.delayFilter) {
        this.delayFilter.frequency.value = this.state.effects.delay.tone;
      }
      if (this.masterGainNode) {
        this.masterGainNode.gain.value = this.state.effects.master.volume;
      }
      if (this.masterDriveNode) {
        this.updateDriveCurve(this.state.effects.master.drive);
      }
    }

    this.updateWavetables();
  }

  public updateWavetables(force = false) {
    if (!this.ctx) return;

    // Check if osc1 position, warp, or phase changed
    const osc1Pos = this.state.osc1.position;
    const osc1Phase = (this.state.osc1.phase ?? 0) + (this.liveModValues.destinations.osc1_phase || 0);
    if (force || Math.abs(osc1Pos - this.lastOsc1Pos) > 0.005 || Math.abs(osc1Phase - this.lastOsc1Phase) > 0.005) {
      const wave1 = getInterpolatedWave(
        this.state.osc1.tableId,
        osc1Pos,
        this.state.osc1.warpMode,
        this.state.osc1.warpAmount,
        osc1Phase
      );
      const fourier1 = bufferToFourier(wave1, 64);
      try {
        this.osc1PeriodicWave = this.ctx.createPeriodicWave(fourier1.real, fourier1.imag);
        this.lastOsc1Pos = osc1Pos;
        this.lastOsc1Phase = osc1Phase;
        // Update currently playing voices for osc1
        this.voices.forEach((v) => {
          v.osc1Nodes.forEach((osc) => {
            if (this.osc1PeriodicWave) osc.setPeriodicWave(this.osc1PeriodicWave);
          });
        });
      } catch (e) {
        console.warn('PeriodicWave creation warning:', e);
      }
    }

    // Check if osc2 position, warp, or phase changed
    const osc2Pos = this.state.osc2.position;
    const osc2Phase = (this.state.osc2.phase ?? 0) + (this.liveModValues.destinations.osc2_phase || 0);
    if (force || Math.abs(osc2Pos - this.lastOsc2Pos) > 0.005 || Math.abs(osc2Phase - this.lastOsc2Phase) > 0.005) {
      const wave2 = getInterpolatedWave(
        this.state.osc2.tableId,
        osc2Pos,
        this.state.osc2.warpMode,
        this.state.osc2.warpAmount,
        osc2Phase
      );
      const fourier2 = bufferToFourier(wave2, 64);
      try {
        this.osc2PeriodicWave = this.ctx.createPeriodicWave(fourier2.real, fourier2.imag);
        this.lastOsc2Pos = osc2Pos;
        this.lastOsc2Phase = osc2Phase;
        this.voices.forEach((v) => {
          v.osc2Nodes.forEach((osc) => {
            if (this.osc2PeriodicWave) osc.setPeriodicWave(this.osc2PeriodicWave);
          });
        });
      } catch (e) {
        console.warn('PeriodicWave creation warning:', e);
      }
    }
  }

  // --- Real-time Modulation Loop (60 FPS) ---
  private startModulationLoop() {
    const loop = (timestamp: number) => {
      if (!this.lastAnimTime) this.lastAnimTime = timestamp;
      const dt = Math.min((timestamp - this.lastAnimTime) / 1000, 0.1);
      this.lastAnimTime = timestamp;

      this.evaluateModulation(dt);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private evaluateLFOSample(shape: LFOShape, phase: number): number {
    const p = phase % 1.0;
    switch (shape) {
      case 'sine':
        return Math.sin(p * Math.PI * 2);
      case 'triangle':
        return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
      case 'sawUp':
        return 2 * p - 1;
      case 'sawDown':
        return 1 - 2 * p;
      case 'square':
        return p < 0.5 ? 1 : -1;
      case 'sampleHold':
        return Math.sin(Math.floor(p * 8) * 1.618);
      case 'smoothRandom':
        return Math.sin(p * Math.PI * 2) * 0.6 + Math.cos(p * Math.PI * 6) * 0.4;
      default:
        return Math.sin(p * Math.PI * 2);
    }
  }

  private evaluateModulation(dt: number) {
    // 1. Advance LFO phases
    const lfo1Rate = Math.max(0.05, this.state.lfo1.rate + this.liveModValues.destinations.lfo1_rate * 5);
    const lfo2Rate = Math.max(0.05, this.state.lfo2.rate + this.liveModValues.destinations.lfo2_rate * 5);

    this.lfo1Phase = (this.lfo1Phase + lfo1Rate * dt) % 1.0;
    this.lfo2Phase = (this.lfo2Phase + lfo2Rate * dt) % 1.0;

    const lfo1Val = this.evaluateLFOSample(this.state.lfo1.shape, this.lfo1Phase);
    const lfo2Val = this.evaluateLFOSample(this.state.lfo2.shape, this.lfo2Phase);

    // 2. Advance Chaos / Drift
    if (Math.random() < 0.05) {
      this.chaosTarget = Math.random() * 2 - 1;
    }
    this.chaosValue += (this.chaosTarget - this.chaosValue) * dt * 2.0;

    // 3. Evaluate Voice Envelopes
    let avgEnv1 = 0;
    let avgEnv2 = 0;
    const now = this.ctx?.currentTime || 0;

    this.voices.forEach((v) => {
      const age = now - v.startTime;
      if (!v.isReleasing) {
        // Attack & Decay
        if (age < this.state.env1.attack) {
          v.envLevel = age / this.state.env1.attack;
        } else {
          const decayProgress = (age - this.state.env1.attack) / Math.max(0.01, this.state.env1.decay);
          v.envLevel = 1 - (1 - this.state.env1.sustain) * Math.min(1, decayProgress);
        }

        if (age < this.state.env2.attack) {
          v.modEnvLevel = age / this.state.env2.attack;
        } else {
          const decayProgress = (age - this.state.env2.attack) / Math.max(0.01, this.state.env2.decay);
          v.modEnvLevel = 1 - (1 - this.state.env2.sustain) * Math.min(1, decayProgress);
        }
      }
      avgEnv1 += v.envLevel;
      avgEnv2 += v.modEnvLevel;
    });

    const activeCount = Math.max(1, this.voices.size);
    const env1Val = this.voices.size > 0 ? avgEnv1 / activeCount : 0;
    const env2Val = this.voices.size > 0 ? avgEnv2 / activeCount : 0;

    // Detect live primary envelope stage for active notes
    let stage1: EnvelopeStage = 'idle';
    let stage2: EnvelopeStage = 'idle';
    let p1 = 0;
    let p2 = 0;

    if (this.voices.size > 0) {
      let latestVoice: Voice | null = null;
      let latestTime = -1;
      this.voices.forEach((v) => {
        if (v.startTime > latestTime) {
          latestTime = v.startTime;
          latestVoice = v;
        }
      });

      if (latestVoice) {
        const v = latestVoice as Voice;
        const age = now - v.startTime;
        if (v.isReleasing) {
          stage1 = 'release';
          stage2 = 'release';
          p1 = Math.max(0, Math.min(1, v.envLevel));
          p2 = Math.max(0, Math.min(1, v.modEnvLevel));
        } else {
          // Env 1
          if (age < this.state.env1.attack) {
            stage1 = 'attack';
            p1 = Math.min(1, age / Math.max(0.001, this.state.env1.attack));
          } else if (age < this.state.env1.attack + this.state.env1.decay) {
            stage1 = 'decay';
            p1 = Math.min(1, (age - this.state.env1.attack) / Math.max(0.001, this.state.env1.decay));
          } else {
            stage1 = 'sustain';
            p1 = this.state.env1.sustain;
          }

          // Env 2
          if (age < this.state.env2.attack) {
            stage2 = 'attack';
            p2 = Math.min(1, age / Math.max(0.001, this.state.env2.attack));
          } else if (age < this.state.env2.attack + this.state.env2.decay) {
            stage2 = 'decay';
            p2 = Math.min(1, (age - this.state.env2.attack) / Math.max(0.001, this.state.env2.decay));
          } else {
            stage2 = 'sustain';
            p2 = this.state.env2.sustain;
          }
        }
      }
    }

    this.liveModValues.envStages = {
      env1: stage1,
      env2: stage2,
      env1Progress: p1,
      env2Progress: p2,
      activeNoteCount: this.voices.size,
    };

    // Populate live source values
    this.liveModValues.sources = {
      lfo1: lfo1Val,
      lfo2: lfo2Val,
      env1: env1Val,
      env2: env2Val,
      macro1: this.state.macros[0],
      macro2: this.state.macros[1],
      macro3: this.state.macros[2],
      macro4: this.state.macros[3],
      modWheel: this.modWheelValue,
      pitchBend: this.pitchBendValue,
      velocity: 0.8,
      chaos: this.chaosValue,
    };

    // 4. Calculate Modulation Destinations
    const destSums: Record<ModDestination, number> = {
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
    };

    for (const route of this.state.modMatrix) {
      if (!route.enabled) continue;
      const srcVal = this.liveModValues.sources[route.source] || 0;
      const effectiveVal = route.bipolar ? srcVal : (srcVal + 1) * 0.5;
      destSums[route.destination] += effectiveVal * route.amount;
    }

    this.liveModValues.destinations = destSums;

    // 5. Apply destination modulation to AudioNodes
    if (this.masterFilterNode && this.ctx) {
      const baseCutoff = this.state.filter.cutoff;
      // Exponential modulation for frequency
      const modCutoff = Math.max(20, Math.min(20000, baseCutoff * Math.pow(2, destSums.filter_cutoff * 4)));
      this.masterFilterNode.frequency.setTargetAtTime(modCutoff, this.ctx.currentTime, 0.01);

      const baseRes = this.state.filter.resonance;
      const modRes = Math.max(0.1, Math.min(20, baseRes + destSums.filter_res * 10));
      this.masterFilterNode.Q.setTargetAtTime(modRes, this.ctx.currentTime, 0.01);
    }

    if (this.reverbWetNode && this.ctx) {
      const modReverb = Math.max(0, Math.min(1, this.state.effects.reverb.mix + destSums.reverb_mix));
      this.reverbWetNode.gain.setTargetAtTime(modReverb, this.ctx.currentTime, 0.02);
    }

    if (this.delayWetNode && this.ctx) {
      const modDelay = Math.max(0, Math.min(1, this.state.effects.delay.mix + destSums.delay_mix));
      this.delayWetNode.gain.setTargetAtTime(modDelay, this.ctx.currentTime, 0.02);
    }

    // Dynamic Wavetable Position Modulation
    const dynamicOsc1Pos = Math.max(0, Math.min(1, this.state.osc1.position + destSums.osc1_pos));
    if (Math.abs(dynamicOsc1Pos - this.lastOsc1Pos) > 0.015) {
      this.updateWavetables();
    }
  }

  // --- Voice Management & Note Playing ---
  public noteOn(midiNote: number, velocity = 0.8) {
    if (!this.ctx || !this.filterInputNode) {
      this.initAudio().then(() => {
        if (this.ctx && this.filterInputNode) {
          this.noteOn(midiNote, velocity);
        }
      }).catch((e) => console.warn('initAudio noteOn warning:', e));
      return;
    }

    // Handle polyphony limit
    if (this.voices.size >= this.maxPolyphony) {
      // Steal oldest voice
      const oldestKey = this.voices.keys().next().value;
      if (oldestKey !== undefined) {
        this.noteOff(oldestKey, true);
      }
    }

    // If note already playing, release it first
    if (this.voices.has(midiNote)) {
      this.noteOff(midiNote, true);
    }

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const now = this.ctx.currentTime;

    // Voice Gain Node with ADSR envelope
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    // Attack phase
    const attackTime = Math.max(0.002, this.state.env1.attack);
    voiceGain.gain.exponentialRampToValueAtTime(velocity, now + attackTime);
    // Decay phase to sustain
    const decayTime = Math.max(0.01, this.state.env1.decay);
    const sustainLevel = Math.max(0.0001, this.state.env1.sustain * velocity);
    voiceGain.gain.exponentialRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

    // Voice Pan Node
    const panNode: AudioNode = typeof this.ctx.createStereoPanner === 'function'
      ? this.ctx.createStereoPanner()
      : this.ctx.createGain();
    if ('pan' in panNode && (panNode as StereoPannerNode).pan) {
      (panNode as StereoPannerNode).pan.value = Math.max(-1, Math.min(1, this.state.osc1.pan + (Math.random() - 0.5) * 0.2));
    }

    // Voice local filter (Key tracking + local tone)
    const voiceFilter = this.ctx.createBiquadFilter();
    voiceFilter.type = 'lowpass';
    const keyTrackOffset = (midiNote - 60) * 15 * this.state.filter.keyTracking;
    voiceFilter.frequency.value = Math.max(40, Math.min(20000, 8000 + keyTrackOffset));

    // Connect voice: Components -> voiceGain -> voiceFilter -> panNode -> filterInputNode
    voiceGain.connect(voiceFilter);
    voiceFilter.connect(panNode);
    if (this.filterInputNode) {
      panNode.connect(this.filterInputNode);
    }

    // 1. Setup Osc 1 Unison Voices
    const osc1Nodes: OscillatorNode[] = [];
    const osc1Gains: GainNode[] = [];
    if (this.state.osc1.enabled) {
      const unisonCount = Math.max(1, this.state.osc1.unison);
      const detuneSpread = this.state.osc1.detune * 40; // cents spread
      const osc1PitchSemitones = this.state.osc1.octave * 12 + this.state.osc1.semitone;
      const basePitch = freq * Math.pow(2, osc1PitchSemitones / 12);

      for (let u = 0; u < unisonCount; u++) {
        const osc = this.ctx.createOscillator();
        if (this.osc1PeriodicWave) {
          osc.setPeriodicWave(this.osc1PeriodicWave);
        } else {
          osc.type = 'sawtooth';
        }
        
        // Detune calculation across unison voices
        const detuneCents = unisonCount > 1
          ? ((u / (unisonCount - 1)) * 2 - 1) * detuneSpread + this.state.osc1.fine
          : this.state.osc1.fine;

        osc.frequency.setValueAtTime(basePitch, now);
        osc.detune.setValueAtTime(detuneCents, now);

        const subGain = this.ctx.createGain();
        subGain.gain.value = (this.state.osc1.level / unisonCount) * 0.6;

        osc.connect(subGain);
        subGain.connect(voiceGain);
        osc.start(now);

        osc1Nodes.push(osc);
        osc1Gains.push(subGain);
      }
    }

    // 2. Setup Osc 2 Unison Voices
    const osc2Nodes: OscillatorNode[] = [];
    const osc2Gains: GainNode[] = [];
    if (this.state.osc2.enabled) {
      const unisonCount = Math.max(1, this.state.osc2.unison);
      const detuneSpread = this.state.osc2.detune * 45;
      const osc2PitchSemitones = this.state.osc2.octave * 12 + this.state.osc2.semitone;
      const basePitch = freq * Math.pow(2, osc2PitchSemitones / 12);

      for (let u = 0; u < unisonCount; u++) {
        const osc = this.ctx.createOscillator();
        if (this.osc2PeriodicWave) {
          osc.setPeriodicWave(this.osc2PeriodicWave);
        } else {
          osc.type = 'triangle';
        }

        const detuneCents = unisonCount > 1
          ? ((u / (unisonCount - 1)) * 2 - 1) * detuneSpread + this.state.osc2.fine
          : this.state.osc2.fine;

        osc.frequency.setValueAtTime(basePitch, now);
        osc.detune.setValueAtTime(detuneCents, now);

        const subGain = this.ctx.createGain();
        subGain.gain.value = (this.state.osc2.level / unisonCount) * 0.6;

        osc.connect(subGain);
        subGain.connect(voiceGain);
        osc.start(now);

        osc2Nodes.push(osc);
        osc2Gains.push(subGain);
      }
    }

    // 3. Sub Oscillator
    let subOsc: OscillatorNode | undefined;
    let subGain: GainNode | undefined;
    if (this.state.sub.enabled && this.state.sub.level > 0.01) {
      subOsc = this.ctx.createOscillator();
      subOsc.type = this.state.sub.waveform;
      const subPitch = freq * Math.pow(2, (this.state.sub.octave * 12) / 12);
      subOsc.frequency.setValueAtTime(subPitch, now);

      subGain = this.ctx.createGain();
      subGain.gain.value = this.state.sub.level * 0.5;

      subOsc.connect(subGain);
      subGain.connect(voiceGain);
      subOsc.start(now);
    }

    // 4. Noise Generator
    let noiseSource: AudioBufferSourceNode | undefined;
    let noiseGain: GainNode | undefined;
    if (this.state.noise.enabled && this.noiseBuffer && this.state.noise.level > 0.01) {
      noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.loop = true;

      noiseGain = this.ctx.createGain();
      noiseGain.gain.value = this.state.noise.level * 0.25;

      noiseSource.connect(noiseGain);
      noiseGain.connect(voiceGain);
      noiseSource.start(now);
    }

    const voice: Voice = {
      midiNote,
      frequency: freq,
      velocity,
      startTime: now,
      isReleasing: false,
      gainNode: voiceGain,
      filterNode: voiceFilter,
      panNode,
      osc1Nodes,
      osc1Gains,
      osc2Nodes,
      osc2Gains,
      subOsc,
      subGain,
      noiseSource,
      noiseGain,
      envLevel: 0,
      modEnvLevel: 0,
    };

    this.voices.set(midiNote, voice);
  }

  public noteOff(midiNote: number, immediate = false) {
    if (!this.ctx) return;
    const voice = this.voices.get(midiNote);
    if (!voice || voice.isReleasing) return;

    const now = this.ctx.currentTime;
    voice.isReleasing = true;

    const releaseTime = immediate ? 0.02 : Math.max(0.02, this.state.env1.release);

    try {
      voice.gainNode.gain.cancelScheduledValues(now);
      voice.gainNode.gain.setValueAtTime(Math.max(0.0001, voice.gainNode.gain.value), now);
      voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

      setTimeout(() => {
        // Stop all oscillators and cleanup nodes
        voice.osc1Nodes.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        });
        voice.osc2Nodes.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        });
        if (voice.subOsc) {
          try {
            voice.subOsc.stop();
            voice.subOsc.disconnect();
          } catch {}
        }
        if (voice.noiseSource) {
          try {
            voice.noiseSource.stop();
            voice.noiseSource.disconnect();
          } catch {}
        }
        voice.gainNode.disconnect();
        voice.filterNode.disconnect();
        voice.panNode.disconnect();
        this.voices.delete(midiNote);
      }, releaseTime * 1000 + 50);
    } catch {
      this.voices.delete(midiNote);
    }
  }

  public allNotesOff() {
    this.voices.forEach((_, note) => this.noteOff(note, true));
  }

  public setPitchBend(val: number) {
    // val is -1.0 to 1.0
    this.pitchBendValue = val;
  }

  public setModWheel(val: number) {
    // val is 0.0 to 1.0
    this.modWheelValue = val;
  }

  public setMacro(index: 0 | 1 | 2 | 3, val: number) {
    this.state.macros[index] = Math.max(0, Math.min(1, val));
  }

  // --- WAV Recording Export ---
  public startRecording(): boolean {
    if (!this.ctx || !this.masterGainNode) return false;
    try {
      if (typeof this.ctx.createMediaStreamDestination !== 'function') {
        console.warn('createMediaStreamDestination is not supported in this browser environment');
        return false;
      }
      const dest = this.ctx.createMediaStreamDestination();
      if (!dest) return false;
      this.recordingDest = dest;
      this.masterGainNode.connect(dest);
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(dest.stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (e) {
      console.error('Recording start failed:', e);
      return false;
    }
  }

  public stopRecording(): Blob | null {
    if (!this.mediaRecorder || !this.isRecording) return null;
    try {
      this.mediaRecorder.stop();
    } catch (e) {
      console.warn('MediaRecorder stop warning:', e);
    }
    this.isRecording = false;

    if (this.recordingDest && this.masterGainNode) {
      try {
        this.masterGainNode.disconnect(this.recordingDest);
      } catch {}
      this.recordingDest = null;
    }

    return new Blob(this.recordedChunks, { type: 'audio/wav' });
  }

  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.allNotesOff();
    if (this.recordingDest && this.masterGainNode) {
      try {
        this.masterGainNode.disconnect(this.recordingDest);
      } catch {}
      this.recordingDest = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {}
    }
  }
}
