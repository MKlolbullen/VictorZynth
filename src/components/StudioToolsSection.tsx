import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, FolderOpen, Gauge, SlidersHorizontal, Sparkles } from 'lucide-react';
import {
  getNativeAISettings,
  getNativeMidiGeneratorState,
  getNativeParameterSnapshot,
  getNativeStudioTelemetry,
  isNativePluginHost,
  listNativeMidiLibrary,
  revealNativeMidiLibrary,
  setNativeAISettings,
  setNativeParameter,
  startNativeMidiGeneration,
  type NativeAISettings,
  type NativeMidiGeneratorState,
  type NativeMidiLibraryItem,
  type StudioTelemetry,
} from '../native/bridge';

interface NativeParamProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (id: string, value: number) => void;
}

const NativeParam: React.FC<NativeParamProps> = ({
  id,
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}) => (
  <label className="flex flex-col gap-1 text-[10px] text-zinc-400 min-w-0">
    <span className="flex justify-between gap-2 font-mono">
      <span className="truncate">{label}</span>
      <span className="text-cyan-300 whitespace-nowrap">
        {Number.isFinite(value) ? value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0) : '0'}{unit}
      </span>
    </span>
    <input
      aria-label={label}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(id, Number(event.target.value))}
      className="w-full accent-cyan-400"
    />
  </label>
);

interface NativeToggleProps {
  id: string;
  label: string;
  value: number;
  onChange: (id: string, value: number) => void;
}

const NativeToggle: React.FC<NativeToggleProps> = ({ id, label, value, onChange }) => {
  const active = value >= 0.5;
  return (
    <button
      type="button"
      onClick={() => onChange(id, active ? 0 : 1)}
      className={`px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
        active
          ? 'border-cyan-700 bg-cyan-950/70 text-cyan-300'
          : 'border-zinc-800 bg-zinc-950 text-zinc-500'
      }`}
    >
      {label}: {active ? 'ON' : 'OFF'}
    </button>
  );
};

const meterWidth = (db: number): string => `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;

export const StudioToolsSection: React.FC = () => {
  const native = isNativePluginHost();
  const [tab, setTab] = useState<'mastering' | 'composer'>('mastering');
  const [params, setParams] = useState<Record<string, number>>({});
  const [telemetry, setTelemetry] = useState<StudioTelemetry>({
    inLevelDb: -100,
    outLevelDb: -100,
    gainReductionDb: 0,
    lufs: -70,
    spectrumDb: [],
  });
  const [settings, setSettings] = useState<NativeAISettings>({
    useAnthropic: true,
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-opus-4-8',
    apiKey: '',
  });
  const [prompt, setPrompt] = useState('');
  const [multiTrack, setMultiTrack] = useState(false);
  const [generator, setGenerator] = useState<NativeMidiGeneratorState>({ busy: false, result: null });
  const [library, setLibrary] = useState<NativeMidiLibraryItem[]>([]);

  useEffect(() => {
    if (!native) return;

    let alive = true;
    const poll = async () => {
      const [snapshot, studio] = await Promise.all([
        getNativeParameterSnapshot(),
        getNativeStudioTelemetry(),
      ]);
      if (!alive) return;
      if (snapshot) setParams(snapshot);
      if (studio) setTelemetry(studio);
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 125);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [native]);

  useEffect(() => {
    if (!native) return;

    let alive = true;
    void getNativeAISettings().then((value) => {
      if (alive && value) setSettings(value);
    });

    const poll = async () => {
      const [state, items] = await Promise.all([
        getNativeMidiGeneratorState(),
        listNativeMidiLibrary(),
      ]);
      if (!alive) return;
      if (state) setGenerator(state);
      setLibrary(items);
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [native]);

  const updateParam = useCallback((id: string, value: number) => {
    setParams((current) => ({ ...current, [id]: value }));
    void setNativeParameter(id, value);
  }, []);

  const p = useCallback((id: string, fallback: number): number => params[id] ?? fallback, [params]);

  const spectrum = useMemo(() => {
    if (telemetry.spectrumDb.length === 0) return new Array(48).fill(-100) as number[];
    return telemetry.spectrumDb.filter((_, index) => index % 2 === 0);
  }, [telemetry.spectrumDb]);

  const switchProvider = (anthropic: boolean) => {
    setSettings((current) => ({
      ...current,
      useAnthropic: anthropic,
      endpoint: anthropic ? 'https://api.anthropic.com/v1/messages' : current.endpoint === 'https://api.anthropic.com/v1/messages' ? 'http://localhost:11434/v1/chat/completions' : current.endpoint,
      model: anthropic ? (current.model || 'claude-opus-4-8') : (current.model.startsWith('claude-') ? '' : current.model),
    }));
  };

  const generate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || generator.busy) return;
    await setNativeAISettings(settings);
    await startNativeMidiGeneration({ ...settings, prompt: cleanPrompt, multiTrack });
  };

  if (!native) return null;

  return (
    <section className="mt-3 bg-zinc-900/90 border border-zinc-800 rounded-lg shadow-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-zinc-800 bg-zinc-950/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-xs font-semibold tracking-wider text-zinc-100">STUDIO</div>
            <div className="text-[9px] text-zinc-500 font-mono">MyVST3 production tools · native backend</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('mastering')}
            className={`px-2 py-1 rounded text-[10px] font-mono border ${tab === 'mastering' ? 'border-cyan-700 bg-cyan-950/70 text-cyan-300' : 'border-zinc-800 text-zinc-500'}`}
          >
            MASTERING
          </button>
          <button
            type="button"
            onClick={() => setTab('composer')}
            className={`px-2 py-1 rounded text-[10px] font-mono border ${tab === 'composer' ? 'border-violet-700 bg-violet-950/70 text-violet-300' : 'border-zinc-800 text-zinc-500'}`}
          >
            AI COMPOSER
          </button>
        </div>
      </div>

      {tab === 'mastering' ? (
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <NativeToggle id="studio.enabled" label="Studio Chain" value={p('studio.enabled', 0)} onChange={updateParam} />
            <NativeToggle id="studio.eq.enabled" label="EQ" value={p('studio.eq.enabled', 1)} onChange={updateParam} />
            <NativeToggle id="studio.comp.enabled" label="Compressor" value={p('studio.comp.enabled', 1)} onChange={updateParam} />
            <NativeToggle id="studio.limiter.enabled" label="Limiter" value={p('studio.limiter.enabled', 1)} onChange={updateParam} />
            <span className="text-[9px] font-mono text-zinc-500">Off by default to preserve existing patch sound.</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-zinc-950/70 border border-zinc-800 rounded p-2 space-y-2">
              <div className="text-[10px] font-semibold text-cyan-300 flex items-center gap-1"><Gauge className="w-3 h-3" /> GAIN + METERS</div>
              <NativeParam id="studio.inputGainDb" label="Input" value={p('studio.inputGainDb', 0)} min={-24} max={24} step={0.1} unit=" dB" onChange={updateParam} />
              <NativeParam id="studio.outputGainDb" label="Output" value={p('studio.outputGainDb', 0)} min={-24} max={24} step={0.1} unit=" dB" onChange={updateParam} />
              <div className="space-y-1 text-[9px] font-mono">
                <div className="flex justify-between"><span>IN</span><span>{telemetry.inLevelDb.toFixed(1)} dB</span></div>
                <div className="h-1.5 bg-zinc-800 rounded overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: meterWidth(telemetry.inLevelDb) }} /></div>
                <div className="flex justify-between"><span>OUT</span><span>{telemetry.outLevelDb.toFixed(1)} dB</span></div>
                <div className="h-1.5 bg-zinc-800 rounded overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: meterWidth(telemetry.outLevelDb) }} /></div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded border border-zinc-800 p-1.5"><div className="text-zinc-500">LUFS-M</div><div className="text-emerald-300 text-sm">{telemetry.lufs.toFixed(1)}</div></div>
                  <div className="rounded border border-zinc-800 p-1.5"><div className="text-zinc-500">GR</div><div className="text-amber-300 text-sm">-{telemetry.gainReductionDb.toFixed(1)} dB</div></div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950/70 border border-zinc-800 rounded p-2 space-y-2">
              <div className="text-[10px] font-semibold text-cyan-300">5-BAND EQ · LOW</div>
              <NativeParam id="studio.eq.hpfFreq" label="HPF" value={p('studio.eq.hpfFreq', 20)} min={20} max={1000} step={1} unit=" Hz" onChange={updateParam} />
              <NativeParam id="studio.eq.lowShelfFreq" label="Low Shelf Freq" value={p('studio.eq.lowShelfFreq', 120)} min={40} max={500} step={1} unit=" Hz" onChange={updateParam} />
              <NativeParam id="studio.eq.lowShelfGainDb" label="Low Shelf Gain" value={p('studio.eq.lowShelfGainDb', 0)} min={-15} max={15} step={0.1} unit=" dB" onChange={updateParam} />
              <NativeParam id="studio.eq.peak1Freq" label="Peak 1 Freq" value={p('studio.eq.peak1Freq', 500)} min={100} max={2000} step={1} unit=" Hz" onChange={updateParam} />
              <NativeParam id="studio.eq.peak1GainDb" label="Peak 1 Gain" value={p('studio.eq.peak1GainDb', 0)} min={-15} max={15} step={0.1} unit=" dB" onChange={updateParam} />
              <NativeParam id="studio.eq.peak1Q" label="Peak 1 Q" value={p('studio.eq.peak1Q', 0.9)} min={0.3} max={8} step={0.1} onChange={updateParam} />
            </div>

            <div className="bg-zinc-950/70 border border-zinc-800 rounded p-2 space-y-2">
              <div className="text-[10px] font-semibold text-cyan-300">5-BAND EQ · HIGH</div>
              <NativeParam id="studio.eq.peak2Freq" label="Peak 2 Freq" value={p('studio.eq.peak2Freq', 3000)} min={500} max={12000} step={1} unit=" Hz" onChange={updateParam} />
              <NativeParam id="studio.eq.peak2GainDb" label="Peak 2 Gain" value={p('studio.eq.peak2GainDb', 0)} min={-15} max={15} step={0.1} unit=" dB" onChange={updateParam} />
              <NativeParam id="studio.eq.peak2Q" label="Peak 2 Q" value={p('studio.eq.peak2Q', 0.9)} min={0.3} max={8} step={0.1} onChange={updateParam} />
              <NativeParam id="studio.eq.highShelfFreq" label="High Shelf Freq" value={p('studio.eq.highShelfFreq', 8000)} min={1500} max={16000} step={1} unit=" Hz" onChange={updateParam} />
              <NativeParam id="studio.eq.highShelfGainDb" label="High Shelf Gain" value={p('studio.eq.highShelfGainDb', 0)} min={-15} max={15} step={0.1} unit=" dB" onChange={updateParam} />
            </div>

            <div className="bg-zinc-950/70 border border-zinc-800 rounded p-2 space-y-2">
              <div className="text-[10px] font-semibold text-amber-300">DYNAMICS</div>
              <NativeParam id="studio.comp.thresholdDb" label="Threshold" value={p('studio.comp.thresholdDb', -18)} min={-60} max={0} step={0.1} unit=" dB" onChange={updateParam} />
              <NativeParam id="studio.comp.ratio" label="Ratio" value={p('studio.comp.ratio', 3)} min={1} max={20} step={0.1} unit=":1" onChange={updateParam} />
              <NativeParam id="studio.comp.attackMs" label="Attack" value={p('studio.comp.attackMs', 10)} min={0.1} max={100} step={0.1} unit=" ms" onChange={updateParam} />
              <NativeParam id="studio.comp.releaseMs" label="Release" value={p('studio.comp.releaseMs', 150)} min={10} max={1000} step={1} unit=" ms" onChange={updateParam} />
              <NativeParam id="studio.comp.makeupDb" label="Makeup" value={p('studio.comp.makeupDb', 0)} min={0} max={24} step={0.1} unit=" dB" onChange={updateParam} />
              <NativeParam id="studio.limiter.ceilingDb" label="Limiter Ceiling" value={p('studio.limiter.ceilingDb', -1)} min={-20} max={0} step={0.1} unit=" dB" onChange={updateParam} />
              <NativeParam id="studio.limiter.releaseMs" label="Limiter Release" value={p('studio.limiter.releaseMs', 100)} min={1} max={500} step={1} unit=" ms" onChange={updateParam} />
            </div>
          </div>

          <div className="h-24 bg-zinc-950/80 border border-zinc-800 rounded p-2 flex items-end gap-[2px] overflow-hidden" aria-label="Studio spectrum analyser">
            {spectrum.map((db, index) => (
              <div key={index} className="flex-1 min-w-[2px] bg-cyan-500/80 rounded-t" style={{ height: `${Math.max(2, Math.min(100, db + 100))}%` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-zinc-950/70 border border-zinc-800 rounded p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-300">
              <BrainCircuit className="w-4 h-4" /> AI MIDI COMPOSER / ARRANGER
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => switchProvider(true)} className={`px-2 py-1 rounded border text-[10px] font-mono ${settings.useAnthropic ? 'border-violet-600 bg-violet-950 text-violet-200' : 'border-zinc-800 text-zinc-500'}`}>ANTHROPIC</button>
              <button type="button" onClick={() => switchProvider(false)} className={`px-2 py-1 rounded border text-[10px] font-mono ${!settings.useAnthropic ? 'border-violet-600 bg-violet-950 text-violet-200' : 'border-zinc-800 text-zinc-500'}`}>OPENAI-COMPATIBLE / LOCAL</button>
              <button type="button" onClick={() => setMultiTrack((value) => !value)} className={`px-2 py-1 rounded border text-[10px] font-mono ${multiTrack ? 'border-cyan-600 bg-cyan-950 text-cyan-200' : 'border-zinc-800 text-zinc-500'}`}>{multiTrack ? 'MULTI-TRACK ARRANGER' : 'SINGLE MIDI CLIP'}</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="text-[10px] text-zinc-500">Endpoint<input value={settings.endpoint} onChange={(event) => setSettings((current) => ({ ...current, endpoint: event.target.value }))} className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono" /></label>
              <label className="text-[10px] text-zinc-500">Model<input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono" /></label>
              <label className="md:col-span-2 text-[10px] text-zinc-500">API key · stored machine-local, never in VST project state<input type="password" value={settings.apiKey} onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))} className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono" /></label>
            </div>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              placeholder={multiTrack ? 'Example: Build an 8-bar dark ambient arrangement in D minor: sparse drums, sub bass, evolving chords and a restrained lead.' : 'Example: A moody 8-bar lo-fi chord progression in F minor with a slow melody on top.'}
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 resize-y"
            />

            <div className="flex items-center gap-2">
              <button type="button" disabled={generator.busy || !prompt.trim()} onClick={() => void generate()} className="px-3 py-1.5 rounded bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-xs font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />{generator.busy ? 'GENERATING…' : multiTrack ? 'GENERATE ARRANGEMENT' : 'GENERATE MIDI'}</button>
              <button type="button" onClick={() => void revealNativeMidiLibrary()} className="px-2 py-1.5 rounded border border-zinc-700 text-zinc-300 text-xs flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" /> Open Library</button>
            </div>

            {generator.result && (
              <div className={`rounded border p-2 text-[10px] font-mono ${generator.result.success ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>
                <div>{generator.result.message}</div>
                {generator.result.path && <div className="mt-1 text-zinc-500 break-all">{generator.result.path}</div>}
                {generator.result.success && <div className="mt-1">{generator.result.tracks?.length ? `${generator.result.tracks.length} tracks` : `${generator.result.notes?.length ?? 0} preview notes`} · {generator.result.tempoBpm.toFixed(1)} BPM</div>}
              </div>
            )}
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800 rounded p-3 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-300">MIDI LIBRARY</span>
              <span className="text-[9px] text-zinc-600 font-mono">{library.length} recent</span>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {library.length === 0 && <div className="text-[10px] text-zinc-600">Generated clips will appear here.</div>}
              {library.map((item) => (
                <div key={item.path} className="border border-zinc-800 rounded px-2 py-1.5 bg-zinc-900/70">
                  <div className="text-[10px] text-zinc-300 truncate">{item.name}</div>
                  <div className="text-[9px] font-mono text-zinc-600">{Math.max(1, Math.round(item.size / 1024))} KB · {new Date(item.modifiedMs).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
