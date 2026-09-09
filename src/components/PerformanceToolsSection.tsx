import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, Mic2, RadioTower } from 'lucide-react';

import {
  type PerformanceSettings,
  type PerformanceTelemetry,
  getNativePerformanceSettings,
  getNativePerformanceTelemetry,
  isNativePluginHost,
  setNativePerformanceSettings,
} from '../native/bridge';

const DEFAULT_SETTINGS: PerformanceSettings = {
  pitch: {
    enabled: false,
    gateDb: -45,
    minFrequency: 65,
    maxFrequency: 1200,
    confidence: 0.72,
    smoothingFrames: 2,
    velocitySensitivity: 0.75,
    scale: 0,
    root: 0,
    retrigger: true,
  },
  arp: {
    enabled: false,
    mode: 0,
    rate: 2,
    octaves: 1,
    gate: 0.72,
    latch: false,
    swing: 0,
    retrigger: true,
  },
};

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['Chromatic', 'Major', 'Minor'];
const RATES = ['1/4', '1/8', '1/16', '1/32'];
const MODES = [
  { label: 'UP', hint: 'Low → high', icon: ArrowUp },
  { label: 'DOWN', hint: 'High → low', icon: ArrowDown },
  { label: 'UP/DOWN', hint: 'Low → high → low', icon: ArrowUp },
  { label: 'DOWN/UP', hint: 'High → low → high', icon: ArrowDown },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const PerformanceToolsSection: React.FC = () => {
  const native = isNativePluginHost();
  const [settings, setSettings] = useState<PerformanceSettings>(DEFAULT_SETTINGS);
  const [telemetry, setTelemetry] = useState<PerformanceTelemetry | null>(null);

  useEffect(() => {
    if (!native) return;

    let mounted = true;
    void getNativePerformanceSettings().then((value) => {
      if (mounted && value) setSettings(value);
    });

    const poll = async () => {
      const value = await getNativePerformanceTelemetry();
      if (mounted && value) setTelemetry(value);
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 50);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [native]);

  const updatePitch = (patch: Partial<PerformanceSettings['pitch']>) => {
    setSettings((previous) => {
      const next = { ...previous, pitch: { ...previous.pitch, ...patch } };
      void setNativePerformanceSettings(next);
      return next;
    });
  };

  const updateArp = (patch: Partial<PerformanceSettings['arp']>) => {
    setSettings((previous) => {
      const next = { ...previous, arp: { ...previous.arp, ...patch } };
      void setNativePerformanceSettings(next);
      return next;
    });
  };

  const waveformPoints = useMemo(() => {
    const samples = telemetry?.pitch.waveform ?? [];
    if (samples.length < 2) return '0,28 128,28';
    return samples
      .map((sample, index) => {
        const x = (index / (samples.length - 1)) * 128;
        const y = 28 - clamp(sample, -1, 1) * 23;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [telemetry?.pitch.waveform]);

  if (!native) return null;

  const pitch = telemetry?.pitch;
  const arp = telemetry?.arp;
  const inputReady = (telemetry?.inputChannels ?? 0) > 0;

  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="bg-zinc-900/90 border border-cyan-900/60 rounded-lg p-3 shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-semibold tracking-wider text-zinc-100">HUM → MIDI</div>
              <div className="text-[10px] text-zinc-500">Pitch Input → detected note → current AetherWave preset</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updatePitch({ enabled: !settings.pitch.enabled })}
            className={`px-2 py-1 rounded text-[10px] font-mono border ${
              settings.pitch.enabled
                ? 'bg-cyan-950 text-cyan-300 border-cyan-700/70'
                : 'bg-zinc-950 text-zinc-500 border-zinc-700'
            }`}
          >
            {settings.pitch.enabled ? 'LISTENING' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-stretch">
          <div className="bg-zinc-950/70 border border-zinc-800 rounded p-2 overflow-hidden">
            <svg viewBox="0 0 128 56" className="w-full h-20" preserveAspectRatio="none">
              <line x1="0" y1="28" x2="128" y2="28" stroke="currentColor" className="text-zinc-800" strokeWidth="0.7" />
              <polyline
                points={waveformPoints}
                fill="none"
                stroke="currentColor"
                className={pitch?.gateOpen ? 'text-cyan-300' : 'text-zinc-600'}
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="min-w-[120px] bg-zinc-950/70 border border-zinc-800 rounded p-2 flex flex-col justify-center text-center">
            <div className={`font-mono text-2xl font-bold ${pitch?.gateOpen ? 'text-cyan-300' : 'text-zinc-600'}`}>
              {pitch?.noteName ?? '--'}
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              {(pitch?.frequencyHz ?? 0) > 0 ? `${pitch!.frequencyHz.toFixed(1)} Hz` : 'no pitch'}
            </div>
            <div className="font-mono text-[10px] text-zinc-500 mt-1">
              {Math.round((pitch?.confidence ?? 0) * 100)}% confidence
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
          <label className="flex flex-col gap-1 text-zinc-400">
            Scale
            <select
              value={settings.pitch.scale}
              onChange={(event) => updatePitch({ scale: Number(event.target.value) })}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200"
            >
              {SCALES.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-zinc-400">
            Root
            <select
              value={settings.pitch.root}
              disabled={settings.pitch.scale === 0}
              onChange={(event) => updatePitch({ root: Number(event.target.value) })}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 disabled:text-zinc-600"
            >
              {ROOTS.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-zinc-400">
            Low pitch
            <select
              value={settings.pitch.minFrequency}
              onChange={(event) => updatePitch({ minFrequency: Number(event.target.value) })}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200"
            >
              <option value={55}>A1 · 55 Hz</option>
              <option value={65}>C2 · 65 Hz</option>
              <option value={82}>E2 · 82 Hz</option>
              <option value={110}>A2 · 110 Hz</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-zinc-400">
            Stability
            <select
              value={settings.pitch.smoothingFrames}
              onChange={(event) => updatePitch({ smoothingFrames: Number(event.target.value) })}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200"
            >
              <option value={1}>Fast</option>
              <option value={2}>Balanced</option>
              <option value={4}>Smooth</option>
              <option value={6}>Very smooth</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-[10px] text-zinc-400 flex flex-col gap-1">
            Gate {settings.pitch.gateDb.toFixed(0)} dB
            <input
              type="range"
              min={-70}
              max={-15}
              step={1}
              value={settings.pitch.gateDb}
              onChange={(event) => updatePitch({ gateDb: Number(event.target.value) })}
            />
          </label>
          <label className="text-[10px] text-zinc-400 flex flex-col gap-1">
            Confidence {Math.round(settings.pitch.confidence * 100)}%
            <input
              type="range"
              min={0.5}
              max={0.92}
              step={0.01}
              value={settings.pitch.confidence}
              onChange={(event) => updatePitch({ confidence: Number(event.target.value) })}
            />
          </label>
          <label className="text-[10px] text-zinc-400 flex flex-col gap-1">
            Velocity response {Math.round(settings.pitch.velocitySensitivity * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.pitch.velocitySensitivity}
              onChange={(event) => updatePitch({ velocitySensitivity: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
          <span className={inputReady ? 'text-emerald-400' : 'text-amber-400'}>
            {inputReady ? `Pitch Input ready · ${telemetry?.inputChannels} ch` : 'No audio input bus detected'}
          </span>
          <span className="text-zinc-500">
            Input {(pitch?.inputDb ?? -100).toFixed(1)} dB · onset {Math.round((pitch?.onset ?? 0) * 100)}%
          </span>
        </div>

        <div className="text-[10px] text-zinc-500 bg-zinc-950/50 border border-zinc-800 rounded px-2 py-1.5">
          Choose the instrument/patch from the existing preset dropdown in the top bar. In REAPER, route your microphone audio into AetherWave's <span className="text-cyan-300">Pitch Input</span>. Detected notes are emitted as VST MIDI, so the performance can be recorded as MIDI by the host.
        </div>
      </div>

      <div className="bg-zinc-900/90 border border-violet-900/60 rounded-lg p-3 shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <RadioTower className="w-4 h-4 text-violet-400" />
            <div>
              <div className="text-xs font-semibold tracking-wider text-zinc-100">ARPEGGIATOR</div>
              <div className="text-[10px] text-zinc-500">Host-synced · MIDI, keyboard or hummed notes</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateArp({ enabled: !settings.arp.enabled })}
            className={`px-2 py-1 rounded text-[10px] font-mono border ${
              settings.arp.enabled
                ? 'bg-violet-950 text-violet-300 border-violet-700/70'
                : 'bg-zinc-950 text-zinc-500 border-zinc-700'
            }`}
          >
            {settings.arp.enabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {MODES.map(({ label, hint, icon: Icon }, index) => (
            <button
              key={label}
              type="button"
              title={hint}
              onClick={() => updateArp({ mode: index })}
              className={`rounded border p-2 flex items-center gap-2 text-left transition-colors ${
                settings.arp.mode === index
                  ? 'border-violet-500/70 bg-violet-950/60 text-violet-200'
                  : 'border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <div>
                <div className="text-[10px] font-semibold tracking-wider">{label}</div>
                <div className="text-[9px] opacity-70">{hint}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
          <label className="flex flex-col gap-1 text-zinc-400">
            Rate
            <select
              value={settings.arp.rate}
              onChange={(event) => updateArp({ rate: Number(event.target.value) })}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200"
            >
              {RATES.map((rate, index) => <option key={rate} value={index}>{rate}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-zinc-400">
            Octaves
            <select
              value={settings.arp.octaves}
              onChange={(event) => updateArp({ octaves: Number(event.target.value) })}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200"
            >
              {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => updateArp({ latch: !settings.arp.latch })}
              className={`flex-1 px-2 py-1.5 rounded border font-mono ${settings.arp.latch ? 'border-violet-600 text-violet-300 bg-violet-950/50' : 'border-zinc-700 text-zinc-500 bg-zinc-950'}`}
            >
              LATCH {settings.arp.latch ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-[10px] text-zinc-400 flex flex-col gap-1">
            Gate {Math.round(settings.arp.gate * 100)}%
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={settings.arp.gate}
              onChange={(event) => updateArp({ gate: Number(event.target.value) })}
            />
          </label>
          <label className="text-[10px] text-zinc-400 flex flex-col gap-1">
            Swing {Math.round(settings.arp.swing * 100)}%
            <input
              type="range"
              min={0}
              max={0.75}
              step={0.01}
              value={settings.arp.swing}
              onChange={(event) => updateArp({ swing: Number(event.target.value) })}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => updateArp({ retrigger: !settings.arp.retrigger })}
          className={`self-start px-2 py-1 rounded border text-[10px] font-mono ${settings.arp.retrigger ? 'border-emerald-800 text-emerald-400 bg-emerald-950/30' : 'border-zinc-700 text-zinc-500 bg-zinc-950'}`}
        >
          CHORD RETRIGGER {settings.arp.retrigger ? 'ON' : 'OFF'}
        </button>

        <div className="grid grid-cols-3 gap-2 bg-zinc-950/60 border border-zinc-800 rounded p-2 text-center font-mono">
          <div>
            <div className="text-[9px] text-zinc-600 uppercase">Held</div>
            <div className="text-sm text-violet-300">{arp?.heldNotes ?? 0}</div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-600 uppercase">Current</div>
            <div className="text-sm text-violet-300">{(arp?.currentNote ?? -1) >= 0 ? arp!.currentNote : '--'}</div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-600 uppercase">Step</div>
            <div className="text-sm text-violet-300">
              {(arp?.sequenceLength ?? 0) > 0 ? `${(arp?.step ?? 0) + 1}/${arp?.sequenceLength}` : '--'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <Activity className="w-3.5 h-3.5 text-violet-500" />
          UP, DOWN, UP/DOWN and DOWN/UP are four distinct traversal orders. The arp consumes ordinary MIDI and HUM → MIDI identically.
        </div>
      </div>
    </section>
  );
};
