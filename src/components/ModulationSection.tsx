import React, { useRef, useEffect, useState } from 'react';
import {
  LFOParams,
  EnvelopeParams,
  LFOShape,
  ModSource,
} from '../types/synth';
import { Knob } from './Knob';
import { Waves, Sliders, Activity, Zap, Tag, Edit3, Check, X } from 'lucide-react';

interface ModulationSectionProps {
  lfo1: LFOParams;
  lfo2: LFOParams;
  env1: EnvelopeParams;
  env2: EnvelopeParams;
  macros: [number, number, number, number];
  macroNames: [string, string, string, string];
  liveSourceValues: Record<ModSource, number>;
  envStages?: {
    env1: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
    env2: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
    env1Progress: number;
    env2Progress: number;
    activeNoteCount: number;
  };
  hoveredModSource?: ModSource | null;
  onHoverModSource?: (source: ModSource | null) => void;
  onLfo1Change: (params: Partial<LFOParams>) => void;
  onLfo2Change: (params: Partial<LFOParams>) => void;
  onEnv1Change: (params: Partial<EnvelopeParams>) => void;
  onEnv2Change: (params: Partial<EnvelopeParams>) => void;
  onMacroChange: (index: 0 | 1 | 2 | 3, val: number) => void;
  onMacroRename?: (index: 0 | 1 | 2 | 3, newName: string) => void;
}

export const ModulationSection: React.FC<ModulationSectionProps> = ({
  lfo1,
  lfo2,
  env1,
  env2,
  macros,
  macroNames,
  liveSourceValues,
  envStages,
  hoveredModSource,
  onHoverModSource,
  onLfo1Change,
  onLfo2Change,
  onEnv1Change,
  onEnv2Change,
  onMacroChange,
  onMacroRename,
}) => {
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [editingIndex, setEditingIndex] = useState<0 | 1 | 2 | 3 | null>(null);
  const [inlineName, setInlineName] = useState('');
  const lfo1CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lfo2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const env1CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const env2CanvasRef = useRef<HTMLCanvasElement | null>(null);

  const lfoShapes: { id: LFOShape; label: string }[] = [
    { id: 'sine', label: 'SIN' },
    { id: 'triangle', label: 'TRI' },
    { id: 'sawUp', label: 'SAW+' },
    { id: 'sawDown', label: 'SAW-' },
    { id: 'square', label: 'SQR' },
    { id: 'sampleHold', label: 'S&H' },
    { id: 'smoothRandom', label: 'RAND' },
  ];

  // Draw animated LFO canvas
  const drawLFOWave = (
    canvas: HTMLCanvasElement | null,
    shape: LFOShape,
    currentValue: number,
    color: string
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Wave points
    ctx.beginPath();
    const points = 80;
    for (let i = 0; i <= points; i++) {
      const p = i / points;
      let yNorm = 0;
      switch (shape) {
        case 'sine':
          yNorm = Math.sin(p * Math.PI * 2);
          break;
        case 'triangle':
          yNorm = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
          break;
        case 'sawUp':
          yNorm = 2 * p - 1;
          break;
        case 'sawDown':
          yNorm = 1 - 2 * p;
          break;
        case 'square':
          yNorm = p < 0.5 ? 1 : -1;
          break;
        case 'sampleHold':
          yNorm = Math.sin(Math.floor(p * 8) * 1.618);
          break;
        case 'smoothRandom':
          yNorm = Math.sin(p * Math.PI * 2) * 0.6 + Math.cos(p * Math.PI * 6) * 0.4;
          break;
      }
      const x = p * width;
      const y = height / 2 - yNorm * (height * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw live animated value dot along Y axis
    const liveY = height / 2 - currentValue * (height * 0.4);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(width - 6, liveY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  };

  // Draw real-time animated ADSR mini-graph
  const drawADSR = (
    canvas: HTMLCanvasElement | null,
    env: EnvelopeParams,
    liveLevel: number,
    color: string,
    stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release' = 'idle',
    stageProgress = 0
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Dark sleek canvas background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Subtle horizontal reference grid lines
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.33);
    ctx.lineTo(width, height * 0.33);
    ctx.moveTo(0, height * 0.66);
    ctx.lineTo(width, height * 0.66);
    ctx.stroke();

    const totalTime = env.attack + env.decay + 1.2 + env.release;
    const padX = 6;
    const padTop = 6;
    const padBottom = 15; // reserved space for stage labels (A, D, S, R)
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;

    const aX = padX + (env.attack / totalTime) * innerW;
    const dX = aX + (env.decay / totalTime) * innerW;
    const sX = dX + (1.2 / totalTime) * innerW;
    const rX = padX + innerW;

    const topY = padTop;
    const bottomY = padTop + innerH;
    const susY = bottomY - Math.max(0, Math.min(1, env.sustain)) * innerH;

    // Stage boundary demarcation guides
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    [aX, dX, sX].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, bottomY);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Stage labels at the bottom (A, D, S, R) with active glow
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = stage === 'attack' ? color : '#52525b';
    ctx.fillText('A', (padX + aX) / 2, height - 3);
    ctx.fillStyle = stage === 'decay' ? color : '#52525b';
    ctx.fillText('D', (aX + dX) / 2, height - 3);
    ctx.fillStyle = stage === 'sustain' ? color : '#52525b';
    ctx.fillText('S', (dX + sX) / 2, height - 3);
    ctx.fillStyle = stage === 'release' ? color : '#52525b';
    ctx.fillText('R', (sX + rX) / 2, height - 3);

    // Shaded gradient fill under ADSR curve
    ctx.beginPath();
    ctx.moveTo(padX, bottomY);
    ctx.lineTo(aX, topY); // Attack
    ctx.lineTo(dX, susY); // Decay
    ctx.lineTo(sX, susY); // Sustain
    ctx.lineTo(rX, bottomY); // Release
    ctx.lineTo(padX, bottomY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, topY, 0, bottomY);
    grad.addColorStop(0, `${color}25`);
    grad.addColorStop(1, `${color}03`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Base ADSR curve line
    ctx.beginPath();
    ctx.moveTo(padX, bottomY);
    ctx.lineTo(aX, topY);
    ctx.lineTo(dX, susY);
    ctx.lineTo(sX, susY);
    ctx.lineTo(rX, bottomY);
    ctx.strokeStyle = `${color}70`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active stage segment highlight (illuminates actively during Attack, Decay, Sustain, or Release)
    if (stage !== 'idle') {
      ctx.beginPath();
      if (stage === 'attack') {
        ctx.moveTo(padX, bottomY);
        ctx.lineTo(aX, topY);
      } else if (stage === 'decay') {
        ctx.moveTo(aX, topY);
        ctx.lineTo(dX, susY);
      } else if (stage === 'sustain') {
        ctx.moveTo(dX, susY);
        ctx.lineTo(sX, susY);
      } else if (stage === 'release') {
        ctx.moveTo(sX, susY);
        ctx.lineTo(rX, bottomY);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Real-time animated tracer position calculation based on active note stages
    let cursorX = padX;
    let cursorY = bottomY;

    if (stage === 'attack') {
      cursorX = padX + stageProgress * (aX - padX);
      cursorY = bottomY - stageProgress * (bottomY - topY);
    } else if (stage === 'decay') {
      cursorX = aX + stageProgress * (dX - aX);
      cursorY = topY + stageProgress * (susY - topY);
    } else if (stage === 'sustain') {
      // Dynamic subtle pulse along sustain stage while note is actively sustained
      const pulseShift = Math.sin(Date.now() * 0.006) * 0.15 + 0.5;
      cursorX = dX + pulseShift * (sX - dX);
      cursorY = susY;
    } else if (stage === 'release') {
      const relProg = Math.max(0, Math.min(1, stageProgress));
      cursorX = sX + (1 - relProg) * (rX - sX);
      cursorY = susY + (1 - relProg) * (bottomY - susY);
    } else if (liveLevel > 0.01) {
      cursorX = padX + (aX - padX) * liveLevel;
      cursorY = bottomY - liveLevel * (bottomY - topY);
    }

    // Draw active animated tracer cursor & guide line
    if (stage !== 'idle' || liveLevel > 0.01) {
      // Vertical drop line to baseline
      ctx.strokeStyle = `${color}40`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorX, padTop);
      ctx.lineTo(cursorX, bottomY);
      ctx.stroke();

      // Outer animated pulsing ripple on decay & sustain stages
      if (stage === 'decay' || stage === 'sustain') {
        const pulseR = 5 + Math.sin(Date.now() * 0.01) * 2;
        ctx.strokeStyle = `${color}aa`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bright tracer dot with glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Mini real-time CV percentage indicator at top right of canvas
    ctx.textAlign = 'right';
    ctx.font = '8px monospace';
    ctx.fillStyle = stage !== 'idle' ? color : '#71717a';
    const pct = Math.round(liveLevel * 100);
    ctx.fillText(`${pct}%`, width - 4, padTop + 8);
  };

  useEffect(() => {
    drawLFOWave(lfo1CanvasRef.current, lfo1.shape, liveSourceValues.lfo1, '#38bdf8');
    drawLFOWave(lfo2CanvasRef.current, lfo2.shape, liveSourceValues.lfo2, '#a78bfa');
    drawADSR(
      env1CanvasRef.current,
      env1,
      liveSourceValues.env1,
      '#fbbf24',
      envStages?.env1 || 'idle',
      envStages?.env1Progress || 0
    );
    drawADSR(
      env2CanvasRef.current,
      env2,
      liveSourceValues.env2,
      '#34d399',
      envStages?.env2 || 'idle',
      envStages?.env2Progress || 0
    );
  }, [lfo1, lfo2, env1, env2, liveSourceValues, envStages]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* 1. Low Frequency Oscillators (LFO 1 & 2) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center space-x-1.5 border-b border-zinc-800 pb-1.5">
          <Waves className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-zinc-200 tracking-wider">
            MODULATION LFOs
          </span>
        </div>

        {/* LFO 1 */}
        <div
          onMouseEnter={() => onHoverModSource?.('lfo1')}
          onMouseLeave={() => onHoverModSource?.(null)}
          className={`p-2 rounded border flex flex-col gap-1.5 transition-all duration-150 ${
            hoveredModSource === 'lfo1'
              ? 'bg-zinc-950 border-cyan-500/80 shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/50'
              : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1">
              <span className="font-mono text-cyan-400 font-bold">LFO 1</span>
              {hoveredModSource === 'lfo1' && (
                <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950 px-1 rounded border border-cyan-800">
                  Tracing Paths
                </span>
              )}
            </div>
            <div className="flex space-x-1 overflow-x-auto">
              {lfoShapes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onLfo1Change({ shape: s.id })}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono transition-colors ${
                    lfo1.shape === s.id
                      ? 'bg-cyan-900/80 text-cyan-200 font-bold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 h-12 rounded border border-zinc-800 overflow-hidden bg-zinc-950">
              <canvas ref={lfo1CanvasRef} className="w-full h-full" />
            </div>
            <div className="flex items-center space-x-2 flex-1 justify-around">
              <Knob
                label="Rate"
                value={lfo1.rate}
                min={0.05}
                max={20}
                step={0.05}
                size="sm"
                color="cyan"
                unit="Hz"
                onChange={(val) => onLfo1Change({ rate: val })}
              />
              <button
                type="button"
                onClick={() => onLfo1Change({ sync: !lfo1.sync })}
                className={`px-2 py-1 rounded text-[10px] font-mono border ${
                  lfo1.sync
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
              >
                SYNC {lfo1.sync ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* LFO 2 */}
        <div
          onMouseEnter={() => onHoverModSource?.('lfo2')}
          onMouseLeave={() => onHoverModSource?.(null)}
          className={`p-2 rounded border flex flex-col gap-1.5 transition-all duration-150 ${
            hoveredModSource === 'lfo2'
              ? 'bg-zinc-950 border-violet-500/80 shadow-[0_0_12px_rgba(167,139,250,0.25)] ring-1 ring-violet-500/50'
              : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1">
              <span className="font-mono text-violet-400 font-bold">LFO 2</span>
              {hoveredModSource === 'lfo2' && (
                <span className="text-[9px] font-mono text-violet-300 bg-violet-950 px-1 rounded border border-violet-800">
                  Tracing Paths
                </span>
              )}
            </div>
            <div className="flex space-x-1 overflow-x-auto">
              {lfoShapes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onLfo2Change({ shape: s.id })}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono transition-colors ${
                    lfo2.shape === s.id
                      ? 'bg-violet-900/80 text-violet-200 font-bold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 h-12 rounded border border-zinc-800 overflow-hidden bg-zinc-950">
              <canvas ref={lfo2CanvasRef} className="w-full h-full" />
            </div>
            <div className="flex items-center space-x-2 flex-1 justify-around">
              <Knob
                label="Rate"
                value={lfo2.rate}
                min={0.05}
                max={20}
                step={0.05}
                size="sm"
                color="violet"
                unit="Hz"
                onChange={(val) => onLfo2Change({ rate: val })}
              />
              <button
                type="button"
                onClick={() => onLfo2Change({ sync: !lfo2.sync })}
                className={`px-2 py-1 rounded text-[10px] font-mono border ${
                  lfo2.sync
                    ? 'bg-violet-950 text-violet-300 border-violet-700'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
              >
                SYNC {lfo2.sync ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ADSR Envelopes (Env 1 Amp & Env 2 Mod) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center space-x-1.5 border-b border-zinc-800 pb-1.5">
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-zinc-200 tracking-wider">
            ADSR ENVELOPES
          </span>
        </div>

        {/* Envelope 1 (Amp) */}
        <div
          onMouseEnter={() => onHoverModSource?.('env1')}
          onMouseLeave={() => onHoverModSource?.(null)}
          className={`p-2 rounded border flex flex-col gap-1.5 transition-all duration-150 ${
            hoveredModSource === 'env1'
              ? 'bg-zinc-950 border-amber-500/80 shadow-[0_0_12px_rgba(251,191,36,0.25)] ring-1 ring-amber-500/50'
              : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-amber-400 font-bold">ENV 1 (AMP)</span>
              {hoveredModSource === 'env1' && (
                <span className="text-[9px] font-mono text-amber-300 bg-amber-950 px-1 rounded border border-amber-800">
                  Tracing Paths
                </span>
              )}
            </div>
            {/* Live active stage pill badge */}
            <div className="flex items-center space-x-1 text-[9px] font-mono">
              <span
                className={`px-1.5 py-0.5 rounded border transition-colors ${
                  envStages?.env1 === 'decay'
                    ? 'bg-amber-950 text-amber-300 border-amber-500 font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                    : envStages?.env1 === 'sustain'
                    ? 'bg-yellow-950 text-yellow-300 border-yellow-500 font-bold shadow-[0_0_8px_rgba(234,179,8,0.4)]'
                    : envStages?.env1 === 'attack'
                    ? 'bg-amber-900/60 text-amber-200 border-amber-600 font-bold'
                    : envStages?.env1 === 'release'
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
              >
                {envStages?.env1 ? envStages.env1.toUpperCase() : 'IDLE'}
              </span>
            </div>
          </div>

          {/* Mini-Graph next to the Envelope Controls */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            {/* Real-time animated ADSR mini-graph */}
            <div
              className="w-full sm:w-28 md:w-32 h-20 rounded border border-zinc-800/90 overflow-hidden bg-zinc-950 shrink-0 relative shadow-inner"
              title="Real-time Envelope ADSR Graph: animates live note attack, decay, sustain, and release stages"
            >
              <canvas ref={env1CanvasRef} className="w-full h-full block" />
            </div>

            {/* ADSR Knobs Controls */}
            <div className="flex-1 grid grid-cols-4 gap-1 items-center justify-items-center bg-zinc-950/40 p-1 rounded border border-zinc-800/60">
              <Knob
                label="A"
                value={env1.attack}
                min={0.002}
                max={6.0}
                step={0.01}
                size="sm"
                color="amber"
                unit="s"
                onChange={(val) => onEnv1Change({ attack: val })}
              />
              <Knob
                label="D"
                value={env1.decay}
                min={0.01}
                max={8.0}
                step={0.01}
                size="sm"
                color="amber"
                unit="s"
                onChange={(val) => onEnv1Change({ decay: val })}
              />
              <Knob
                label="S"
                value={env1.sustain}
                min={0}
                max={1}
                step={0.01}
                size="sm"
                color="amber"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(val) => onEnv1Change({ sustain: val })}
              />
              <Knob
                label="R"
                value={env1.release}
                min={0.01}
                max={10.0}
                step={0.01}
                size="sm"
                color="amber"
                unit="s"
                onChange={(val) => onEnv1Change({ release: val })}
              />
            </div>
          </div>
        </div>

        {/* Envelope 2 (Mod) */}
        <div
          onMouseEnter={() => onHoverModSource?.('env2')}
          onMouseLeave={() => onHoverModSource?.(null)}
          className={`p-2 rounded border flex flex-col gap-1.5 transition-all duration-150 ${
            hoveredModSource === 'env2'
              ? 'bg-zinc-950 border-emerald-500/80 shadow-[0_0_12px_rgba(52,211,153,0.25)] ring-1 ring-emerald-500/50'
              : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-emerald-400 font-bold">ENV 2 (MOD)</span>
              {hoveredModSource === 'env2' && (
                <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950 px-1 rounded border border-emerald-800">
                  Tracing Paths
                </span>
              )}
            </div>
            {/* Live active stage pill badge */}
            <div className="flex items-center space-x-1 text-[9px] font-mono">
              <span
                className={`px-1.5 py-0.5 rounded border transition-colors ${
                  envStages?.env2 === 'decay'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : envStages?.env2 === 'sustain'
                    ? 'bg-teal-950 text-teal-300 border-teal-500 font-bold shadow-[0_0_8px_rgba(20,184,166,0.4)]'
                    : envStages?.env2 === 'attack'
                    ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600 font-bold'
                    : envStages?.env2 === 'release'
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
              >
                {envStages?.env2 ? envStages.env2.toUpperCase() : 'IDLE'}
              </span>
            </div>
          </div>

          {/* Mini-Graph next to the Envelope Controls */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            {/* Real-time animated ADSR mini-graph */}
            <div
              className="w-full sm:w-28 md:w-32 h-20 rounded border border-zinc-800/90 overflow-hidden bg-zinc-950 shrink-0 relative shadow-inner"
              title="Real-time Envelope ADSR Graph: animates live note attack, decay, sustain, and release stages"
            >
              <canvas ref={env2CanvasRef} className="w-full h-full block" />
            </div>

            {/* ADSR Knobs Controls */}
            <div className="flex-1 grid grid-cols-4 gap-1 items-center justify-items-center bg-zinc-950/40 p-1 rounded border border-zinc-800/60">
              <Knob
                label="A"
                value={env2.attack}
                min={0.002}
                max={6.0}
                step={0.01}
                size="sm"
                color="emerald"
                unit="s"
                onChange={(val) => onEnv2Change({ attack: val })}
              />
              <Knob
                label="D"
                value={env2.decay}
                min={0.01}
                max={8.0}
                step={0.01}
                size="sm"
                color="emerald"
                unit="s"
                onChange={(val) => onEnv2Change({ decay: val })}
              />
              <Knob
                label="S"
                value={env2.sustain}
                min={0}
                max={1}
                step={0.01}
                size="sm"
                color="emerald"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(val) => onEnv2Change({ sustain: val })}
              />
              <Knob
                label="R"
                value={env2.release}
                min={0.01}
                max={10.0}
                step={0.01}
                size="sm"
                color="emerald"
                unit="s"
                onChange={(val) => onEnv2Change({ release: val })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Performance Macros & Soundscape Morphing */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-zinc-200 tracking-wider">
              MACRO CONTROLLERS
            </span>
          </div>

          {/* Custom Labels Button */}
          <button
            type="button"
            onClick={() => setIsEditingLabels((prev) => !prev)}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
              isEditingLabels
                ? 'bg-cyan-950 text-cyan-300 border-cyan-700 shadow-sm'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-cyan-300 hover:border-zinc-700'
            }`}
            title="Custom Labels: rename macros (e.g., Filter Wobble, Sub Depth)"
          >
            <Tag className="w-3 h-3 text-cyan-400" />
            <span>Custom Labels</span>
          </button>
        </div>

        {/* Custom Macro Labels Drawer / Editor Panel */}
        {isEditingLabels && (
          <div className="bg-zinc-950/95 border border-cyan-800/60 rounded p-2.5 flex flex-col gap-2 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-cyan-300 flex items-center gap-1">
                <Edit3 className="w-3 h-3 text-cyan-400" />
                CUSTOM MACRO LABELS
              </span>
              <button
                type="button"
                onClick={() => setIsEditingLabels(false)}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors"
                title="Done"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Macro Name Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([0, 1, 2, 3] as const).map((idx) => {
                const colors = [
                  'border-cyan-800/80 text-cyan-300 focus:border-cyan-400',
                  'border-amber-800/80 text-amber-300 focus:border-amber-400',
                  'border-violet-800/80 text-violet-300 focus:border-violet-400',
                  'border-emerald-800/80 text-emerald-300 focus:border-emerald-400',
                ];
                const badgeBgs = [
                  'bg-cyan-950 text-cyan-400 border-cyan-800',
                  'bg-amber-950 text-amber-400 border-amber-800',
                  'bg-violet-950 text-violet-400 border-violet-800',
                  'bg-emerald-950 text-emerald-400 border-emerald-800',
                ];

                return (
                  <div key={idx} className="flex items-center space-x-1.5">
                    <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${badgeBgs[idx]} shrink-0`}>
                      M{idx + 1}
                    </span>
                    <input
                      type="text"
                      maxLength={18}
                      value={macroNames[idx]}
                      onChange={(e) => onMacroRename?.(idx, e.target.value)}
                      placeholder={`Macro ${idx + 1}`}
                      className={`w-full bg-zinc-900 border rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none transition-colors ${colors[idx]}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Quick Inspiration Suggestions */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-zinc-800/80">
              <span className="text-[9px] font-mono text-zinc-500">Quick suggestions (click to assign):</span>
              <div className="flex flex-wrap gap-1">
                {[
                  'Filter Wobble',
                  'Sub Depth',
                  'Reverb Space',
                  'Drive Grit',
                  'Warp Scan',
                  'Pitch Glide',
                  'Reso Bite',
                  'Air Shimmer',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      // Find first macro with default name or default to 0
                      const targetIdx = macroNames.findIndex((n) => n.startsWith('Macro')) as 0 | 1 | 2 | 3;
                      const applyIdx = targetIdx >= 0 ? targetIdx : 0;
                      onMacroRename?.(applyIdx, suggestion);
                    }}
                    className="text-[9px] font-mono bg-zinc-900 text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 border border-zinc-800 hover:border-cyan-800/60 rounded px-1.5 py-0.5 transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4 Macro Knobs with Interactive Editable Labels */}
        <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-2.5 rounded border border-zinc-800/80 items-center justify-items-center flex-1">
          {([0, 1, 2, 3] as const).map((idx) => {
            const colors: ('cyan' | 'amber' | 'violet' | 'emerald')[] = ['cyan', 'amber', 'violet', 'emerald'];
            const isEditing = editingIndex === idx;

            return (
              <div
                key={idx}
                className="flex flex-col items-center justify-center relative group/macro w-full"
                onMouseEnter={() => onHoverModSource?.(`macro${idx + 1}` as ModSource)}
                onMouseLeave={() => onHoverModSource?.(null)}
              >
                <Knob
                  label=""
                  value={macros[idx]}
                  min={0}
                  max={1}
                  step={0.01}
                  size="md"
                  color={colors[idx]}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) => onMacroChange(idx, val)}
                />

                {/* Editable Label Pill Directly Under Knob */}
                <div className="mt-1 w-full max-w-[100px] flex justify-center">
                  {isEditing ? (
                    <div className="flex items-center space-x-1 bg-zinc-900 border border-cyan-500 rounded px-1 py-0.5 shadow-sm">
                      <input
                        type="text"
                        autoFocus
                        maxLength={16}
                        value={inlineName}
                        onChange={(e) => setInlineName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onMacroRename?.(idx, inlineName.trim() || `Macro ${idx + 1}`);
                            setEditingIndex(null);
                          } else if (e.key === 'Escape') {
                            setEditingIndex(null);
                          }
                        }}
                        onBlur={() => {
                          onMacroRename?.(idx, inlineName.trim() || `Macro ${idx + 1}`);
                          setEditingIndex(null);
                        }}
                        className="w-full bg-transparent text-[10px] font-mono text-cyan-300 focus:outline-none text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onMacroRename?.(idx, inlineName.trim() || `Macro ${idx + 1}`);
                          setEditingIndex(null);
                        }}
                        className="text-cyan-400 hover:text-cyan-200"
                        title="Save label"
                      >
                        <Check className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineName(macroNames[idx]);
                        setEditingIndex(idx);
                      }}
                      className="group/lbl flex items-center justify-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono text-zinc-300 hover:text-cyan-300 hover:bg-zinc-900/90 border border-transparent hover:border-zinc-700 transition-all truncate max-w-full"
                      title="Click to rename macro (e.g. Filter Wobble, Sub Depth)"
                    >
                      <span className="truncate">{macroNames[idx]}</span>
                      <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover/lbl:opacity-100 text-zinc-500 shrink-0 transition-opacity" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
