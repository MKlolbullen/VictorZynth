import React, { useRef, useEffect, useState } from 'react';
import { ModRouting, ModSource, ModDestination } from '../types/synth';
import { LiveModValues } from '../audio/engine';
import { Knob } from './Knob';
import { Cable, Plus, Trash2, Sliders, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

interface ModulationMatrixProps {
  routings: ModRouting[];
  liveModValues: LiveModValues;
  macroNames?: [string, string, string, string];
  onAddRouting: () => void;
  onRemoveRouting: (id: string) => void;
  onUpdateRouting: (id: string, updates: Partial<ModRouting>) => void;
}

export const ModulationMatrix: React.FC<ModulationMatrixProps> = ({
  routings,
  liveModValues,
  macroNames,
  onAddRouting,
  onRemoveRouting,
  onUpdateRouting,
}) => {
  const [viewMode, setViewMode] = useState<'cables' | 'table'>('cables');
  const [recentlyModifiedId, setRecentlyModifiedId] = useState<string | null>(null);
  const modifiedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleUpdate = (id: string, updates: Partial<ModRouting>) => {
    onUpdateRouting(id, updates);
    setRecentlyModifiedId(id);
    if (modifiedTimerRef.current) clearTimeout(modifiedTimerRef.current);
    modifiedTimerRef.current = setTimeout(() => {
      setRecentlyModifiedId(null);
    }, 600);
  };

  const sources: { id: ModSource; label: string; color: string }[] = [
    { id: 'lfo1', label: 'LFO 1', color: '#38bdf8' },
    { id: 'lfo2', label: 'LFO 2', color: '#a78bfa' },
    { id: 'env1', label: 'Env 1 (Amp)', color: '#fbbf24' },
    { id: 'env2', label: 'Env 2 (Mod)', color: '#34d399' },
    { id: 'macro1', label: macroNames?.[0] ? `M1: ${macroNames[0]}` : 'Macro 1', color: '#f43f5e' },
    { id: 'macro2', label: macroNames?.[1] ? `M2: ${macroNames[1]}` : 'Macro 2', color: '#fb923c' },
    { id: 'macro3', label: macroNames?.[2] ? `M3: ${macroNames[2]}` : 'Macro 3', color: '#e879f9' },
    { id: 'macro4', label: macroNames?.[3] ? `M4: ${macroNames[3]}` : 'Macro 4', color: '#2dd4bf' },
    { id: 'modWheel', label: 'Mod Wheel', color: '#818cf8' },
    { id: 'chaos', label: 'Chaos Drift', color: '#facc15' },
    { id: 'velocity', label: 'Velocity', color: '#94a3b8' },
  ];

  const destinations: { id: ModDestination; label: string; group: string }[] = [
    { id: 'osc1_pos', label: 'Osc 1 WT Pos', group: 'Osc 1' },
    { id: 'osc1_warp', label: 'Osc 1 Warp', group: 'Osc 1' },
    { id: 'osc1_pitch', label: 'Osc 1 Pitch', group: 'Osc 1' },
    { id: 'osc1_level', label: 'Osc 1 Level', group: 'Osc 1' },
    { id: 'osc2_pos', label: 'Osc 2 WT Pos', group: 'Osc 2' },
    { id: 'osc2_warp', label: 'Osc 2 Warp', group: 'Osc 2' },
    { id: 'osc2_pitch', label: 'Osc 2 Pitch', group: 'Osc 2' },
    { id: 'osc2_level', label: 'Osc 2 Level', group: 'Osc 2' },
    { id: 'filter_cutoff', label: 'Filter Cutoff', group: 'Filter' },
    { id: 'filter_res', label: 'Filter Res', group: 'Filter' },
    { id: 'filter_drive', label: 'Filter Drive', group: 'Filter' },
    { id: 'reverb_mix', label: 'Reverb Wet', group: 'FX' },
    { id: 'delay_mix', label: 'Delay Wet', group: 'FX' },
    { id: 'delay_time', label: 'Delay Time', group: 'FX' },
    { id: 'chorus_mix', label: 'Chorus Wet', group: 'FX' },
    { id: 'lfo1_rate', label: 'LFO 1 Rate', group: 'Mod' },
    { id: 'lfo2_rate', label: 'LFO 2 Rate', group: 'Mod' },
    { id: 'pan', label: 'Stereo Pan', group: 'Output' },
  ];

  // Animated Modular Patch Cords Canvas
  useEffect(() => {
    if (viewMode !== 'cables') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particleOffset = 0;

    const renderCables = () => {
      particleOffset = (particleOffset + 0.015) % 1.0;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Jack nodes positions
      const srcX = 35;
      const destX = width - 35;

      const activeSrcs = sources.filter((s) => routings.some((r) => r.source === s.id && r.enabled));
      const activeDests = destinations.filter((d) => routings.some((r) => r.destination === d.id && r.enabled));

      // Calculate vertical spacing
      const srcSpacing = height / (activeSrcs.length + 1);
      const destSpacing = height / (activeDests.length + 1);

      const srcPositions: Record<string, { x: number; y: number; label: string; color: string }> = {};
      activeSrcs.forEach((s, i) => {
        srcPositions[s.id] = {
          x: srcX,
          y: (i + 1) * srcSpacing,
          label: s.label,
          color: s.color,
        };
      });

      const destPositions: Record<string, { x: number; y: number; label: string }> = {};
      activeDests.forEach((d, i) => {
        destPositions[d.id] = {
          x: destX,
          y: (i + 1) * destSpacing,
          label: d.label,
        };
      });

      // Draw Patch Cords
      routings.forEach((route) => {
        if (!route.enabled) return;
        const p1 = srcPositions[route.source];
        const p2 = destPositions[route.destination];
        if (!p1 || !p2) return;

        const srcColor = p1.color || '#38bdf8';
        const liveVal = liveModValues.sources[route.source] || 0;
        const effectiveSignal = liveVal * route.amount;

        // Bezier Cable with natural sagging physics
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const sag = Math.max(30, Math.abs(dx) * 0.15 + Math.abs(dy) * 0.2);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(p1.x + dx * 0.45, p1.y + sag, p2.x - dx * 0.45, p2.y + sag, p2.x, p2.y);

        // Cable shadow
        ctx.strokeStyle = '#00000088';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Cable rubber jacket
        ctx.strokeStyle = srcColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = srcColor;
        ctx.shadowBlur = Math.abs(effectiveSignal) * 12 + 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Traveling electrical charge particle
        const t = (particleOffset * (1 + Math.abs(route.amount) * 2)) % 1.0;
        // Cubic bezier formula for particle coordinate
        const cx1 = p1.x + dx * 0.45;
        const cy1 = p1.y + sag;
        const cx2 = p2.x - dx * 0.45;
        const cy2 = p2.y + sag;

        const partX =
          Math.pow(1 - t, 3) * p1.x +
          3 * Math.pow(1 - t, 2) * t * cx1 +
          3 * (1 - t) * Math.pow(t, 2) * cx2 +
          Math.pow(t, 3) * p2.x;
        const partY =
          Math.pow(1 - t, 3) * p1.y +
          3 * Math.pow(1 - t, 2) * t * cy1 +
          3 * (1 - t) * Math.pow(t, 2) * cy2 +
          Math.pow(t, 3) * p2.y;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(partX, partY, 2.5, 0, Math.PI * 2);
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Jack Sockets
      Object.entries(srcPositions).forEach(([_, p]) => {
        // Jack ring
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Center hole
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(p.label, p.x + 12, p.y + 3);
      });

      Object.entries(destPositions).forEach(([_, p]) => {
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(p.label, p.x - 12, p.y + 3);
      });

      animId = requestAnimationFrame(renderCables);
    };

    animId = requestAnimationFrame(renderCables);
    return () => cancelAnimationFrame(animId);
  }, [viewMode, routings, liveModValues]);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center space-x-2">
          <Cable className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-zinc-200 tracking-wider">
            MODULAR MODULATION MATRIX
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            ({routings.filter((r) => r.enabled).length} Active Patch Cords)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* View mode toggle */}
          <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode('cables')}
              className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition-colors ${
                viewMode === 'cables'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Modular Cables</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>Routing Table</span>
            </button>
          </div>

          {/* Add Route Button */}
          <button
            type="button"
            onClick={onAddRouting}
            className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Cable</span>
          </button>
        </div>
      </div>

      {/* Visual Cable Patch Bay Canvas */}
      {viewMode === 'cables' && (
        <div className="relative w-full h-44 bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden shadow-inner">
          <canvas ref={canvasRef} className="w-full h-full" />
          <div className="absolute top-2 left-2 flex items-center space-x-2 text-[10px] font-mono text-zinc-400 bg-zinc-900/80 backdrop-blur px-2 py-0.5 rounded border border-zinc-800">
            <span>Live CV Patching</span>
            <span>•</span>
            <span className="text-cyan-400">Pulsing Speed ∝ Voltage</span>
          </div>
        </div>
      )}

      {/* Routing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
        {routings.map((route) => {
          const liveSrcVal = liveModValues.sources[route.source] || 0;
          const liveModSignal = liveSrcVal * route.amount;
          const srcMeta = sources.find((s) => s.id === route.source);

          return (
            <div
              key={route.id}
              className={`group relative p-2.5 rounded-lg border transition-all duration-300 ease-out flex flex-col gap-2 transform ${
                route.enabled
                  ? 'bg-zinc-950/80 border-zinc-800/90 hover:border-zinc-700 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                  : 'bg-zinc-950/35 border-zinc-900/80 opacity-55 grayscale-[35%] scale-[0.985]'
              } ${
                recentlyModifiedId === route.id
                  ? 'ring-1 ring-cyan-400/80 border-cyan-500/70 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                {/* Source Picker with activity LED */}
                <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${
                      route.enabled
                        ? Math.abs(liveModSignal) > 0.05
                          ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse scale-110'
                          : 'bg-emerald-500/80 shadow-[0_0_4px_rgba(52,211,153,0.4)]'
                        : 'bg-zinc-700 opacity-40'
                    }`}
                    title={route.enabled ? `Active CV: ${(liveModSignal * 100).toFixed(0)}%` : 'Muted'}
                  />
                  <select
                    value={route.source}
                    onChange={(e) => handleUpdate(route.id, { source: e.target.value as ModSource })}
                    className="w-full bg-zinc-900 text-cyan-300 border border-zinc-700/80 rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all duration-200 cursor-pointer truncate"
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <span className={`font-mono text-xs transition-colors duration-300 shrink-0 ${route.enabled ? 'text-zinc-500' : 'text-zinc-700'}`}>➔</span>

                {/* Destination Picker */}
                <div className="flex-1 min-w-0">
                  <select
                    value={route.destination}
                    onChange={(e) =>
                      handleUpdate(route.id, { destination: e.target.value as ModDestination })
                    }
                    className="w-full bg-zinc-900 text-emerald-300 border border-zinc-700/80 rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all duration-200 cursor-pointer truncate"
                  >
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveRouting(route.id)}
                  className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors duration-200 hover:bg-rose-950/30 shrink-0"
                  title="Remove cable"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Amount Knob, Bipolar toggle, and Live Meter */}
              <div className="flex items-center justify-between bg-zinc-900/50 p-1 rounded border border-zinc-800/60 transition-colors duration-200">
                <div className="flex items-center space-x-2">
                  <Knob
                    label="Amount"
                    value={route.amount}
                    min={-1.0}
                    max={1.0}
                    step={0.01}
                    size="sm"
                    color={route.amount >= 0 ? 'cyan' : 'rose'}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) => handleUpdate(route.id, { amount: val })}
                  />

                  <div className="flex flex-col gap-1 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => handleUpdate(route.id, { bipolar: !route.bipolar })}
                      className={`px-2 py-0.5 rounded border text-[9px] font-mono font-medium transition-all duration-200 ease-out active:scale-95 ${
                        route.bipolar
                          ? 'bg-cyan-950/90 text-cyan-300 border-cyan-800 shadow-[0_0_6px_rgba(56,189,248,0.2)]'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      {route.bipolar ? '± BIPOLAR' : '+ UNIPOLAR'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate(route.id, { enabled: !route.enabled })}
                      className={`px-2 py-0.5 rounded border text-[9px] font-mono font-medium transition-all duration-200 ease-out active:scale-95 flex items-center justify-center space-x-1 ${
                        route.enabled
                          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800 shadow-[0_0_8px_rgba(52,211,153,0.25)]'
                          : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <span>{route.enabled ? 'ACTIVE' : 'MUTED'}</span>
                    </button>
                  </div>
                </div>

                {/* Live CV Voltage Signal Meter */}
                <div className="flex flex-col items-center gap-1 w-14">
                  <span className="text-[9px] font-mono text-zinc-400">CV SIGNAL</span>
                  <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative">
                    {/* Zero center marker */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-zinc-700" />
                    <div
                      className={`h-full transition-all duration-100 ease-out ${
                        liveModSignal >= 0 ? 'bg-cyan-400' : 'bg-rose-400'
                      }`}
                      style={{
                        width: `${Math.min(50, Math.abs(liveModSignal) * 50)}%`,
                        marginLeft: liveModSignal >= 0 ? '50%' : `${50 - Math.min(50, Math.abs(liveModSignal) * 50)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-zinc-300 transition-colors duration-150">
                    {(liveModSignal * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
