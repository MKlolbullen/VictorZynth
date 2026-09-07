import React, { useRef, useEffect } from 'react';
import { FilterParams, FilterType } from '../types/synth';
import { Knob } from './Knob';
import { Filter, Flame } from 'lucide-react';

interface FilterSectionProps {
  filter: FilterParams;
  cutoffModOffset: number;
  resModOffset: number;
  onFilterChange: (params: Partial<FilterParams>) => void;
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  filter,
  cutoffModOffset,
  resModOffset,
  onFilterChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const filterTypes: { id: FilterType; label: string }[] = [
    { id: 'lowpass24', label: 'LP 24' },
    { id: 'lowpass12', label: 'LP 12' },
    { id: 'bandpass', label: 'BP' },
    { id: 'highpass', label: 'HP' },
    { id: 'comb', label: 'COMB' },
    { id: 'notch', label: 'NOTCH' },
  ];

  // Effective Cutoff considering live modulation
  const effectiveCutoff = Math.max(
    20,
    Math.min(20000, filter.cutoff * Math.pow(2, cutoffModOffset * 4))
  );
  const effectiveRes = Math.max(0.1, Math.min(20, filter.resonance + resModOffset * 10));

  // Render Frequency Response Graph
  useEffect(() => {
    const canvas = canvasRef.current;
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

    // Draw logarithmic frequency grid
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1;
    const freqMarkers = [100, 1000, 10000];
    freqMarkers.forEach((f) => {
      const x = (Math.log10(f / 20) / Math.log10(20000 / 20)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = '#3f3f46';
      ctx.font = '8px monospace';
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 2, height - 3);
    });

    // Zero dB line
    const zeroY = height * 0.45;
    ctx.strokeStyle = '#27272a';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot simulated response curve
    ctx.beginPath();
    const points = 120;
    const normCutoffX = (Math.log10(effectiveCutoff / 20) / Math.log10(20000 / 20)) * width;

    for (let i = 0; i <= points; i++) {
      const normI = i / points;
      const freq = 20 * Math.pow(20000 / 20, normI);
      const x = normI * width;
      const ratio = freq / effectiveCutoff;

      let gainDb = 0;
      if (filter.type === 'lowpass24' || filter.type === 'lowpass12') {
        const order = filter.type === 'lowpass24' ? 4 : 2;
        // Resonance peak near cutoff
        const resHump = Math.exp(-Math.pow(Math.log2(ratio), 2) * 5) * (effectiveRes * 3);
        const attenuation = -order * 6 * Math.log2(Math.max(1, ratio));
        gainDb = attenuation + resHump;
      } else if (filter.type === 'highpass') {
        const resHump = Math.exp(-Math.pow(Math.log2(ratio), 2) * 5) * (effectiveRes * 3);
        const attenuation = -2 * 6 * Math.log2(Math.max(1, 1 / ratio));
        gainDb = attenuation + resHump;
      } else if (filter.type === 'bandpass') {
        gainDb = -Math.abs(Math.log2(ratio)) * (18 / effectiveRes) + (effectiveRes * 2);
      } else if (filter.type === 'comb') {
        gainDb = Math.sin(normI * 18 * Math.PI) * (effectiveRes * 1.5) - 4;
      } else if (filter.type === 'notch') {
        gainDb = -Math.exp(-Math.pow(Math.log2(ratio), 2) * 12) * 25;
      }

      // Map gainDb (-40dB to +20dB) to Y coordinate
      const y = zeroY - (gainDb / 40) * (height * 0.4);
      const clampedY = Math.max(2, Math.min(height - 2, y));

      if (i === 0) ctx.moveTo(x, clampedY);
      else ctx.lineTo(x, clampedY);
    }

    // Fill under curve
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
    grad.addColorStop(1, 'rgba(52, 211, 153, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const normI = i / points;
      const freq = 20 * Math.pow(20000 / 20, normI);
      const x = normI * width;
      const ratio = freq / effectiveCutoff;
      let gainDb = 0;
      if (filter.type === 'lowpass24' || filter.type === 'lowpass12') {
        const order = filter.type === 'lowpass24' ? 4 : 2;
        const resHump = Math.exp(-Math.pow(Math.log2(ratio), 2) * 5) * (effectiveRes * 3);
        const attenuation = -order * 6 * Math.log2(Math.max(1, ratio));
        gainDb = attenuation + resHump;
      } else if (filter.type === 'highpass') {
        const resHump = Math.exp(-Math.pow(Math.log2(ratio), 2) * 5) * (effectiveRes * 3);
        const attenuation = -2 * 6 * Math.log2(Math.max(1, 1 / ratio));
        gainDb = attenuation + resHump;
      } else if (filter.type === 'bandpass') {
        gainDb = -Math.abs(Math.log2(ratio)) * (18 / effectiveRes) + (effectiveRes * 2);
      } else if (filter.type === 'comb') {
        gainDb = Math.sin(normI * 18 * Math.PI) * (effectiveRes * 1.5) - 4;
      } else if (filter.type === 'notch') {
        gainDb = -Math.exp(-Math.pow(Math.log2(ratio), 2) * 12) * 25;
      }
      const y = zeroY - (gainDb / 40) * (height * 0.4);
      const clampedY = Math.max(2, Math.min(height - 2, y));
      if (i === 0) ctx.moveTo(x, clampedY);
      else ctx.lineTo(x, clampedY);
    }
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(52, 211, 153, 0.8)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw live animated cutoff cursor dot
    ctx.fillStyle = '#6ee7b7';
    ctx.beginPath();
    ctx.arc(normCutoffX, zeroY - (effectiveRes * 1.5), 4, 0, Math.PI * 2);
    ctx.fill();
  }, [effectiveCutoff, effectiveRes, filter.type]);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-zinc-200 tracking-wider">
            MULTI-MODE FILTER
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {filterTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onFilterChange({ type: t.id })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono tactile-spring-btn ${
                filter.type === t.id
                  ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Frequency Response Canvas */}
      <div className="w-full h-20 bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden relative">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute top-1 left-2 flex items-center space-x-2 text-[9px] font-mono text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 rounded">
          <span>Cutoff: {Math.round(effectiveCutoff)} Hz</span>
          <span>•</span>
          <span>Q: {effectiveRes.toFixed(1)}</span>
        </div>
      </div>

      {/* Tactile Spring Cutoff Slider */}
      <div className="bg-zinc-950/70 px-3 py-1.5 rounded border border-zinc-800/90 flex items-center space-x-3 text-xs knob-spring-container">
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
            CUTOFF SLIDER:
          </span>
          <span className="font-mono text-zinc-200 text-[11px] w-14 text-right font-medium">
            {effectiveCutoff >= 1000 ? `${(effectiveCutoff / 1000).toFixed(1)}k` : `${Math.round(effectiveCutoff)}`} Hz
          </span>
        </div>
        <div className="flex-1 relative flex items-center space-x-2">
          <span className="text-[9px] font-mono text-zinc-500">20Hz</span>
          <input
            type="range"
            min={Math.log10(20)}
            max={Math.log10(20000)}
            step={0.005}
            value={Math.log10(Math.max(20, Math.min(20000, filter.cutoff)))}
            onChange={(e) => {
              const logVal = parseFloat(e.target.value);
              const hz = Math.round(Math.pow(10, logVal));
              onFilterChange({ cutoff: hz });
            }}
            className="tactile-spring-slider slider-emerald flex-1"
            title="Logarithmic cutoff frequency tactile spring slider"
          />
          <span className="text-[9px] font-mono text-zinc-500">20kHz</span>
        </div>
      </div>

      {/* Knobs */}
      <div className="grid grid-cols-4 gap-2 bg-zinc-950/60 p-2 rounded border border-zinc-800/80 items-center justify-items-center">
        <Knob
          label="Cutoff"
          value={filter.cutoff}
          min={20}
          max={20000}
          step={1}
          color="emerald"
          modOffset={cutoffModOffset}
          formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)}
          unit="Hz"
          onChange={(val) => onFilterChange({ cutoff: val })}
        />
        <Knob
          label="Resonance"
          value={filter.resonance}
          min={0.1}
          max={20}
          step={0.1}
          color="emerald"
          modOffset={resModOffset}
          formatValue={(v) => v.toFixed(1)}
          onChange={(val) => onFilterChange({ resonance: val })}
        />
        <Knob
          label="Drive"
          value={filter.drive}
          min={0}
          max={1}
          step={0.01}
          color="amber"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(val) => onFilterChange({ drive: val })}
        />
        <Knob
          label="Key Track"
          value={filter.keyTracking}
          min={0}
          max={1}
          step={0.01}
          color="emerald"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(val) => onFilterChange({ keyTracking: val })}
        />
      </div>
    </div>
  );
};
