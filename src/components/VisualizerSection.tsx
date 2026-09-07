import React, { useRef, useEffect, useState } from 'react';
import { Activity, BarChart2, Compass, GitFork, Zap, Layers } from 'lucide-react';
import { ModRouting, ModSource } from '../types/synth';
import { LiveModValues } from '../audio/engine';

interface VisualizerSectionProps {
  analyser: AnalyserNode | null;
  hoveredModSource?: ModSource | null;
  modMatrix?: ModRouting[];
  liveModValues?: LiveModValues;
}

export const VisualizerSection: React.FC<VisualizerSectionProps> = ({
  analyser,
  hoveredModSource,
  modMatrix = [],
  liveModValues,
}) => {
  const [mode, setMode] = useState<'oscilloscope' | 'spectrum' | 'spectral' | 'phase' | 'modflow'>('oscilloscope');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-switch to modflow if user hovers a modulator and wants to see paths, or provide a prompt
  const activeRoutesForHovered = hoveredModSource
    ? modMatrix.filter((r) => r.enabled && r.source === hoveredModSource)
    : [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let animTime = 0;

    const render = () => {
      animTime += 0.03;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Dark background with faint phosphor glow
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Faint oscilloscope/matrix grid
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (mode === 'modflow') {
        // ==========================================
        // DYNAMIC MODULATION PATH HIGHLIGHTING MODE
        // ==========================================
        const sourceConfigs: { id: ModSource; label: string; color: string }[] = [
          { id: 'lfo1', label: 'LFO 1', color: '#38bdf8' },
          { id: 'lfo2', label: 'LFO 2', color: '#a78bfa' },
          { id: 'env1', label: 'ENV 1', color: '#fbbf24' },
          { id: 'env2', label: 'ENV 2', color: '#34d399' },
        ];

        // Known friendly destination names
        const destLabels: Record<string, string> = {
          cutoff: 'Filter Cutoff',
          resonance: 'Resonance',
          osc1_pos: 'Osc 1 Pos',
          osc1_warp: 'Osc 1 Warp',
          osc2_pos: 'Osc 2 Pos',
          osc2_warp: 'Osc 2 Warp',
          reverb_mix: 'Reverb Mix',
          delay_mix: 'Delay Mix',
          master_vol: 'Master Vol',
          drive: 'Drive',
          pan: 'Stereo Pan',
          chorus_mix: 'Chorus Mix',
        };

        // Determine all active destinations from modMatrix
        const activeDestinations = Array.from(
          new Set(
            modMatrix
              .filter((r) => r.enabled)
              .map((r) => r.destination)
          )
        );

        // Fallback default destinations if matrix is empty
        const destinations =
          activeDestinations.length > 0
            ? activeDestinations
            : ['cutoff', 'osc1_pos', 'reverb_mix'];

        // Compute Y positions
        const srcStartY = 16;
        const srcSpacing = (height - 32) / (sourceConfigs.length - 1 || 1);
        const sourcePositions = new Map<ModSource, { x: number; y: number; color: string; label: string }>();

        sourceConfigs.forEach((src, idx) => {
          sourcePositions.set(src.id, {
            x: 48,
            y: srcStartY + idx * srcSpacing,
            color: src.color,
            label: src.label,
          });
        });

        const destStartY = 16;
        const destSpacing = (height - 32) / (destinations.length - 1 || 1);
        const destPositions = new Map<string, { x: number; y: number; label: string }>();

        destinations.forEach((dest, idx) => {
          destPositions.set(dest, {
            x: width - 64,
            y: destStartY + idx * destSpacing,
            label: destLabels[dest] || dest,
          });
        });

        // Draw connections / modulation paths
        modMatrix
          .filter((r) => r.enabled)
          .forEach((route) => {
            const srcPos = sourcePositions.get(route.source);
            const dstPos = destPositions.get(route.destination);
            if (!srcPos || !dstPos) return;

            const isHovered = hoveredModSource === route.source;
            const hasAnyHover = !!hoveredModSource;

            // Opacity & stroke styling based on hover
            let alpha = 0.6;
            let lineWidth = 1.5;
            let glowBlur = 0;

            if (isHovered) {
              alpha = 1.0;
              lineWidth = 3.0;
              glowBlur = 10;
            } else if (hasAnyHover) {
              alpha = 0.12; // Dim out non-hovered paths
              lineWidth = 1;
            }

            ctx.save();
            ctx.strokeStyle = srcPos.color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = lineWidth;
            if (glowBlur > 0) {
              ctx.shadowColor = srcPos.color;
              ctx.shadowBlur = glowBlur;
            }

            // Draw smooth Bezier curve
            ctx.beginPath();
            ctx.moveTo(srcPos.x, srcPos.y);
            const cp1x = srcPos.x + (dstPos.x - srcPos.x) * 0.45;
            const cp1y = srcPos.y;
            const cp2x = srcPos.x + (dstPos.x - srcPos.x) * 0.55;
            const cp2y = dstPos.y;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dstPos.x, dstPos.y);
            ctx.stroke();

            // Animated traveling energy particle along the curve
            const particleSpeed = (Math.abs(route.amount) * 0.8 + 0.3) * (isHovered ? 1.8 : 1.0);
            const t = (animTime * particleSpeed) % 1;
            // Cubic bezier formula for particle (x, y)
            const u = 1 - t;
            const px = u * u * u * srcPos.x + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * dstPos.x;
            const py = u * u * u * srcPos.y + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * dstPos.y;

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = srcPos.color;
            ctx.shadowBlur = isHovered ? 8 : 4;
            ctx.beginPath();
            ctx.arc(px, py, isHovered ? 3.5 : 2, 0, Math.PI * 2);
            ctx.fill();

            // If hovered, draw routing amount tag along the path
            if (isHovered) {
              const midT = 0.5;
              const mu = 1 - midT;
              const mx = mu * mu * mu * srcPos.x + 3 * mu * mu * midT * cp1x + 3 * mu * midT * midT * cp2x + midT * midT * midT * dstPos.x;
              const my = mu * mu * mu * srcPos.y + 3 * mu * mu * midT * cp1y + 3 * mu * midT * midT * cp2y + midT * midT * midT * dstPos.y;

              const amountText = `${route.amount >= 0 ? '+' : ''}${Math.round(route.amount * 100)}%`;
              ctx.font = 'bold 9px monospace';
              const textWidth = ctx.measureText(amountText).width;

              ctx.fillStyle = 'rgba(9, 9, 11, 0.9)';
              ctx.strokeStyle = srcPos.color;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(mx - textWidth / 2 - 4, my - 7, textWidth + 8, 14, 3);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = srcPos.color;
              ctx.fillText(amountText, mx - textWidth / 2, my + 3.5);
            }

            ctx.restore();
          });

        // Draw Source Nodes (Left)
        sourcePositions.forEach((pos, srcId) => {
          const isHovered = hoveredModSource === srcId;
          const hasAnyHover = !!hoveredModSource;

          ctx.save();
          ctx.globalAlpha = isHovered ? 1.0 : hasAnyHover ? 0.35 : 0.85;

          // Outer halo if hovered
          if (isHovered) {
            const pulse = 1 + Math.sin(animTime * 6) * 0.2;
            ctx.strokeStyle = pos.color;
            ctx.shadowColor = pos.color;
            ctx.shadowBlur = 12;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 9 * pulse, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Node core
          ctx.fillStyle = isHovered ? pos.color : '#18181b';
          ctx.strokeStyle = pos.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, isHovered ? 5.5 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Label
          ctx.fillStyle = isHovered ? '#ffffff' : pos.color;
          ctx.font = isHovered ? 'bold 10px monospace' : '9px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(pos.label, pos.x - 10, pos.y + 3);
          ctx.restore();
        });

        // Draw Destination Nodes (Right)
        destPositions.forEach((pos, destKey) => {
          const isTargetOfHovered =
            hoveredModSource &&
            modMatrix.some(
              (r) => r.enabled && r.source === hoveredModSource && r.destination === destKey
            );
          const hasAnyHover = !!hoveredModSource;

          ctx.save();
          ctx.globalAlpha = isTargetOfHovered ? 1.0 : hasAnyHover ? 0.35 : 0.85;

          if (isTargetOfHovered) {
            ctx.strokeStyle = '#38bdf8';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = isTargetOfHovered ? '#38bdf8' : '#18181b';
          ctx.strokeStyle = isTargetOfHovered ? '#38bdf8' : '#71717a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, isTargetOfHovered ? 5 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Label
          ctx.fillStyle = isTargetOfHovered ? '#38bdf8' : '#a1a1aa';
          ctx.font = isTargetOfHovered ? 'bold 10px monospace' : '9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(pos.label, pos.x + 10, pos.y + 3);
          ctx.restore();
        });

        animId = requestAnimationFrame(render);
        return;
      }

      // Audio analysis modes
      if (!analyser) {
        // Idle flatline
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animId = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const timeData = new Uint8Array(bufferLength);
      const freqData = new Uint8Array(bufferLength);

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      if (mode === 'oscilloscope') {
        // Green/cyan glowing laser oscilloscope
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

      } else if (mode === 'spectrum') {
        // FFT Spectrum bars with gradient
        const barWidth = width / 64 - 1;
        for (let i = 0; i < 64; i++) {
          const binIndex = Math.floor(Math.pow(i / 64, 2.2) * (bufferLength * 0.75));
          const val = freqData[binIndex] / 255.0;
          const barHeight = val * (height - 10);
          const x = i * (barWidth + 1);
          const y = height - barHeight;

          const grad = ctx.createLinearGradient(0, y, 0, height);
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(0.6, '#34d399');
          grad.addColorStop(1, '#059669');

          ctx.fillStyle = grad;
          ctx.fillRect(x, y, barWidth, barHeight);
        }

      } else if (mode === 'phase') {
        // Stereo Phase vector scope
        ctx.beginPath();
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = height * 0.45;

        for (let i = 0; i < bufferLength - 1; i += 2) {
          const s1 = timeData[i] / 128.0 - 1.0;
          const s2 = timeData[i + 1] / 128.0 - 1.0;
          const px = centerX + (s1 - s2) * scale * 0.707;
          const py = centerY - (s1 + s2) * scale * 0.707;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(167, 139, 250, 0.7)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

      } else if (mode === 'spectral') {
        // =========================================================================
        // DUAL SPECTRAL MODE: REAL-TIME FFT SPECTRUM ALONGSIDE TIME-DOMAIN WAVEFORM
        // =========================================================================
        const splitX = Math.floor(width * 0.48);

        // 1. LEFT PANE: TIME-DOMAIN WAVEFORM (OSCILLOSCOPE)
        // Center zero-crossing line
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(splitX - 4, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Waveform plot
        ctx.beginPath();
        const sliceWidth = (splitX - 6) / bufferLength;
        let wx = 3;
        let peakVal = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const dev = Math.abs(timeData[i] - 128);
          if (dev > peakVal) peakVal = dev;

          const wy = (v * (height - 18)) / 2 + 9;
          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
          wx += sliceWidth;
        }

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Left Pane Labels & Peak percentage
        ctx.font = '8px monospace';
        ctx.fillStyle = '#71717a';
        ctx.fillText('WAVEFORM [TIME]', 6, 12);
        const peakNorm = Math.min(1, peakVal / 128.0);
        ctx.fillStyle = peakNorm > 0.85 ? '#f43f5e' : '#38bdf8';
        ctx.fillText(`PK ${(peakNorm * 100).toFixed(0)}%`, splitX - 40, 12);

        // Center vertical divider between dual analytical panes
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(splitX, 3);
        ctx.lineTo(splitX, height - 3);
        ctx.stroke();

        // 2. RIGHT PANE: REAL-TIME FFT FREQUENCY SPECTRUM
        const rightStartX = splitX + 6;
        const rightWidth = width - rightStartX - 4;

        // Frequency Baseline
        ctx.strokeStyle = '#1f1f23';
        ctx.beginPath();
        ctx.moveTo(rightStartX, height - 12);
        ctx.lineTo(width - 4, height - 12);
        ctx.stroke();

        const numBins = 38;
        const barW = Math.max(1, rightWidth / numBins - 1);
        let maxFreqVal = 0;
        let maxFreqIdx = 0;

        for (let i = 0; i < numBins; i++) {
          // Logarithmic scale to highlight musically expressive bass and mids
          const binIndex = Math.floor(Math.pow(i / numBins, 2.1) * (bufferLength * 0.75));
          const val = freqData[binIndex] / 255.0;
          if (val > maxFreqVal) {
            maxFreqVal = val;
            maxFreqIdx = i;
          }

          const barH = val * (height - 24);
          const bx = rightStartX + i * (barW + 1);
          const by = height - 12 - barH;

          // Band gradient: Sub/Bass (sky) -> Mid (emerald) -> High/Air (amber/rose)
          const grad = ctx.createLinearGradient(bx, by, bx, height - 12);
          if (i < 10) {
            grad.addColorStop(0, '#38bdf8');
            grad.addColorStop(1, '#0284c744');
          } else if (i < 24) {
            grad.addColorStop(0, '#34d399');
            grad.addColorStop(1, '#05966944');
          } else {
            grad.addColorStop(0, '#fbbf24');
            grad.addColorStop(1, '#d9770644');
          }

          ctx.fillStyle = grad;
          ctx.fillRect(bx, by, barW, barH);
        }

        // Spectral envelope smooth curve line across peaks
        ctx.beginPath();
        for (let i = 0; i < numBins; i++) {
          const binIndex = Math.floor(Math.pow(i / numBins, 2.1) * (bufferLength * 0.75));
          const val = freqData[binIndex] / 255.0;
          const barH = val * (height - 24);
          const bx = rightStartX + i * (barW + 1) + barW / 2;
          const by = height - 12 - barH;
          if (i === 0) ctx.moveTo(bx, by);
          else ctx.lineTo(bx, by);
        }
        ctx.strokeStyle = '#a7f3d0';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Right Pane Headers & Frequency Markers
        ctx.font = '8px monospace';
        ctx.fillStyle = '#71717a';
        ctx.fillText('FFT SPECTRUM', rightStartX + 2, 12);

        // Frequency ranges
        ctx.fillStyle = '#52525b';
        ctx.fillText('SUB', rightStartX + 2, height - 3);
        ctx.fillText('MID', rightStartX + rightWidth * 0.42, height - 3);
        ctx.fillText('AIR', rightStartX + rightWidth - 18, height - 3);

        // Dominant frequency indicator
        if (maxFreqVal > 0.08) {
          const estHz = Math.round(55 + Math.pow(maxFreqIdx / numBins, 2.1) * 9000);
          ctx.fillStyle = '#34d399';
          ctx.fillText(`${estHz >= 1000 ? (estHz / 1000).toFixed(1) + 'k' : estHz}Hz`, width - 36, 12);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [analyser, mode, hoveredModSource, modMatrix, liveModValues]);

  return (
    <div className="relative w-full h-24 bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden shadow-inner group select-none">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Mode Switcher */}
      <div className="absolute top-1.5 right-2 flex items-center space-x-1 bg-zinc-900/80 backdrop-blur p-0.5 rounded border border-zinc-800 z-10">
        <button
          type="button"
          onClick={() => setMode('oscilloscope')}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 transition-colors ${
            mode === 'oscilloscope'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Oscilloscope Beam"
        >
          <Activity className="w-3 h-3" />
          <span>SCOPE</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('spectrum')}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 transition-colors ${
            mode === 'spectrum'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="FFT Spectrum Analyzer"
        >
          <BarChart2 className="w-3 h-3" />
          <span>FFT</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('spectral')}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 transition-colors ${
            mode === 'spectral'
              ? 'bg-sky-950 text-sky-300 border border-sky-800/60 shadow-sm'
              : 'text-zinc-400 hover:text-sky-300'
          }`}
          title="Dual Spectral Mode: Waveform & FFT Spectrum Side-by-Side"
        >
          <Layers className="w-3 h-3" />
          <span>SPECTRAL</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('phase')}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 transition-colors ${
            mode === 'phase'
              ? 'bg-violet-950 text-violet-300 border border-violet-800/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Stereo Phase Field"
        >
          <Compass className="w-3 h-3" />
          <span>PHASE</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('modflow')}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 transition-colors ${
            mode === 'modflow'
              ? 'bg-amber-950 text-amber-300 border border-amber-800/60 shadow-sm'
              : 'text-zinc-400 hover:text-amber-300'
          }`}
          title="Dynamic Modulation Flow & Path Highlight Mode"
        >
          <GitFork className="w-3 h-3 text-amber-400" />
          <span>MOD FLOW</span>
        </button>
      </div>

      {/* Dynamic Hover Indicator or Audio Out indicator */}
      {hoveredModSource ? (
        <div className="absolute bottom-1 left-2 flex items-center space-x-2 text-[10px] font-mono bg-zinc-900/90 backdrop-blur px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 animate-fadeIn">
          <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
          <span className="font-bold text-amber-300">{hoveredModSource.toUpperCase()}</span>
          <span>➔</span>
          {activeRoutesForHovered.length > 0 ? (
            <span className="text-cyan-300">
              Modulating {activeRoutesForHovered.length} destination{activeRoutesForHovered.length > 1 ? 's' : ''}
              {mode !== 'modflow' && (
                <button
                  type="button"
                  onClick={() => setMode('modflow')}
                  className="ml-2 text-[9px] text-amber-400 underline hover:text-amber-200"
                >
                  [View Paths]
                </button>
              )}
            </span>
          ) : (
            <span className="text-zinc-500">No active matrix routings</span>
          )}
        </div>
      ) : (
        <div className="absolute bottom-1 left-2 flex items-center space-x-2 text-[9px] font-mono text-zinc-500">
          <span>AUDIO OUT</span>
          <span>•</span>
          <span className="text-zinc-400">
            {mode === 'modflow' ? 'MODULATION MATRIX DISPATCH' : '48kHz / 24-bit DSP'}
          </span>
        </div>
      )}
    </div>
  );
};

