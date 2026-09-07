import React, { useRef, useEffect, useState } from 'react';
import { WavetableId, WarpMode } from '../types/synth';
import { WAVETABLE_DEFINITIONS, getInterpolatedWave } from '../audio/wavetables';
import { Layers, Activity } from 'lucide-react';

interface WavetableVisualizerProps {
  tableId: WavetableId;
  position: number;
  warpMode: WarpMode;
  warpAmount: number;
  modOffset?: number;
  color?: 'cyan' | 'amber';
  onPositionChange?: (pos: number) => void;
}

export const WavetableVisualizer: React.FC<WavetableVisualizerProps> = ({
  tableId,
  position,
  warpMode,
  warpAmount,
  modOffset = 0,
  color = 'cyan',
  onPositionChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [isDragging, setIsDragging] = useState(false);

  const effectivePos = Math.max(0, Math.min(1, position + modOffset));

  // Render loop
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

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 30) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 20) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const def = WAVETABLE_DEFINITIONS[tableId] || WAVETABLE_DEFINITIONS['analog-warmth'];

    if (viewMode === '3d') {
      // 3D Waterfall / Ribbon view
      const numSlices = def.slices.length;
      const activeSliceIndex = effectivePos * (numSlices - 1);

      // Draw slices from back to front
      for (let s = 0; s < numSlices; s++) {
        const slice = def.slices[s];
        const normS = s / (numSlices - 1); // 0 (back) to 1 (front)
        const distFromActive = Math.abs(s - activeSliceIndex);
        const isActive = distFromActive < 0.6;

        // Perspective offsets
        const depthY = (1 - normS) * (height * 0.45);
        const depthX = (1 - normS) * (width * 0.18);
        const sliceWidth = width * 0.75 + normS * (width * 0.2);
        const sliceHeight = height * 0.25 + normS * (height * 0.15);
        const baselineY = height * 0.4 + depthY;

        ctx.beginPath();
        for (let i = 0; i < slice.length; i++) {
          const x = depthX + (i / slice.length) * sliceWidth;
          const y = baselineY - slice[i] * sliceHeight * 0.5;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        if (isActive) {
          // Highlight current active slice
          ctx.strokeStyle = color === 'cyan' ? '#38bdf8' : '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = color === 'cyan' ? 'rgba(56, 189, 248, 0.8)' : 'rgba(251, 191, 36, 0.8)';
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          // Inactive background slices
          const alpha = 0.15 + normS * 0.25;
          ctx.strokeStyle =
            color === 'cyan'
              ? `rgba(56, 189, 248, ${alpha})`
              : `rgba(251, 191, 36, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw interpolated active wave right in front with neon fill
      const currentWave = getInterpolatedWave(tableId, effectivePos, warpMode, warpAmount);
      ctx.beginPath();
      const frontBaselineY = height * 0.68;
      const frontSliceWidth = width * 0.94;
      const frontStartX = width * 0.03;
      const frontHeight = height * 0.28;

      ctx.moveTo(frontStartX, frontBaselineY);
      for (let i = 0; i < currentWave.length; i++) {
        const x = frontStartX + (i / currentWave.length) * frontSliceWidth;
        const y = frontBaselineY - currentWave[i] * frontHeight * 0.5;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = color === 'cyan' ? '#38bdf8' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.shadowColor = color === 'cyan' ? 'rgba(56, 189, 248, 0.8)' : 'rgba(251, 191, 36, 0.8)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Position Scanning indicator bar at the bottom
      const barY = height - 8;
      ctx.fillStyle = '#27272a';
      ctx.fillRect(frontStartX, barY, frontSliceWidth, 3);
      ctx.fillStyle = color === 'cyan' ? '#38bdf8' : '#fbbf24';
      const indicatorX = frontStartX + effectivePos * frontSliceWidth;
      ctx.beginPath();
      ctx.arc(indicatorX, barY + 1.5, 4, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // 2D High precision Morph Waveform
      const currentWave = getInterpolatedWave(tableId, effectivePos, warpMode, warpAmount);
      const centerY = height * 0.5;
      const waveWidth = width * 0.92;
      const startX = width * 0.04;
      const amp = height * 0.38;

      // Fill area under curve
      const gradient = ctx.createLinearGradient(0, centerY - amp, 0, centerY + amp);
      if (color === 'cyan') {
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        gradient.addColorStop(0.5, 'rgba(56, 189, 248, 0.02)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0.25)');
      } else {
        gradient.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
        gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.02)');
        gradient.addColorStop(1, 'rgba(251, 191, 36, 0.25)');
      }

      ctx.beginPath();
      ctx.moveTo(startX, centerY);
      for (let i = 0; i < currentWave.length; i++) {
        const x = startX + (i / currentWave.length) * waveWidth;
        const y = centerY - currentWave[i] * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(startX + waveWidth, centerY);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Glowing Line
      ctx.beginPath();
      for (let i = 0; i < currentWave.length; i++) {
        const x = startX + (i / currentWave.length) * waveWidth;
        const y = centerY - currentWave[i] * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color === 'cyan' ? '#38bdf8' : '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color === 'cyan' ? 'rgba(56, 189, 248, 0.9)' : 'rgba(251, 191, 36, 0.9)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Center reference zero line
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, centerY);
      ctx.lineTo(startX + waveWidth, centerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [tableId, effectivePos, warpMode, warpAmount, viewMode, color]);

  // Click & drag interaction to scan position directly on the screen
  const handleInteraction = (clientX: number) => {
    if (!canvasRef.current || !onPositionChange) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const norm = Math.max(0, Math.min(1, (x - rect.width * 0.05) / (rect.width * 0.9)));
    onPositionChange(norm);
  };

  return (
    <div className="relative w-full h-36 bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden group">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-ew-resize"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleInteraction(e.clientX);
        }}
        onMouseMove={(e) => {
          if (isDragging) handleInteraction(e.clientX);
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      />

      {/* Top Overlay Badge & View Mode Toggle */}
      <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-1.5 bg-zinc-900/90 backdrop-blur px-2 py-0.5 rounded border border-zinc-800 text-[10px] font-mono text-zinc-300">
          <span className={`w-1.5 h-1.5 rounded-full ${color === 'cyan' ? 'bg-cyan-400' : 'bg-amber-400'} animate-ping`} />
          <span className="font-semibold">{WAVETABLE_DEFINITIONS[tableId]?.name || tableId}</span>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400">Pos: {Math.round(effectivePos * 100)}%</span>
          {warpMode !== 'none' && (
            <>
              <span className="text-zinc-500">|</span>
              <span className="text-amber-400 uppercase">{warpMode}</span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-1 pointer-events-auto bg-zinc-900/90 backdrop-blur p-0.5 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`p-1 rounded text-xs transition-colors ${
              viewMode === '3d'
                ? color === 'cyan'
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50'
                  : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="3D Waterfall Ribbon View"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`p-1 rounded text-xs transition-colors ${
              viewMode === '2d'
                ? color === 'cyan'
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50'
                  : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="2D Morph Waveform View"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
