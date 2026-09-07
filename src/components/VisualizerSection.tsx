import React, { useRef, useEffect, useState } from 'react';
import { Activity, BarChart2, Compass, GitFork, Zap, Layers, Disc } from 'lucide-react';
import { ModRouting, ModSource, ModDestination, OscillatorParams } from '../types/synth';
import { LiveModValues } from '../audio/engine';

interface VisualizerSectionProps {
  analyser: AnalyserNode | null;
  hoveredModSource?: ModSource | null;
  modMatrix?: ModRouting[];
  liveModValues?: LiveModValues;
  osc1?: OscillatorParams;
  osc2?: OscillatorParams;
}

const DEST_LABELS: Record<string, string> = {
  osc1_pitch: 'Osc 1 Pitch',
  osc1_pos: 'Osc 1 Pos',
  osc1_warp: 'Osc 1 Warp',
  osc1_phase: 'Osc 1 Phase',
  osc1_level: 'Osc 1 Level',
  osc2_pitch: 'Osc 2 Pitch',
  osc2_pos: 'Osc 2 Pos',
  osc2_warp: 'Osc 2 Warp',
  osc2_phase: 'Osc 2 Phase',
  osc2_level: 'Osc 2 Level',
  filter_cutoff: 'Filter Cutoff',
  filter_res: 'Filter Res',
  filter_drive: 'Filter Drive',
  reverb_mix: 'Reverb Mix',
  delay_mix: 'Delay Mix',
  delay_time: 'Delay Time',
  chorus_mix: 'Chorus Mix',
  lfo1_rate: 'LFO 1 Rate',
  lfo2_rate: 'LFO 2 Rate',
  pan: 'Stereo Pan',
};

const SOURCE_CONFIGS: Record<ModSource, { label: string; type: string; color: string; glow: string }> = {
  lfo1: { label: 'LFO 1', type: 'LOW-FREQ OSCILLATOR', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.8)' },
  lfo2: { label: 'LFO 2', type: 'LOW-FREQ OSCILLATOR', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.8)' },
  env1: { label: 'ENV 1 (AMP)', type: 'ADSR ENVELOPE', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.8)' },
  env2: { label: 'ENV 2 (MOD)', type: 'ADSR ENVELOPE', color: '#34d399', glow: 'rgba(52, 211, 153, 0.8)' },
  macro1: { label: 'MACRO 1', type: 'MORPH CONTROL', color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.8)' },
  macro2: { label: 'MACRO 2', type: 'MORPH CONTROL', color: '#ec4899', glow: 'rgba(236, 72, 153, 0.8)' },
  macro3: { label: 'MACRO 3', type: 'MORPH CONTROL', color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.8)' },
  macro4: { label: 'MACRO 4', type: 'MORPH CONTROL', color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.8)' },
  modWheel: { label: 'MOD WHEEL', type: 'MIDI CC #1', color: '#10b981', glow: 'rgba(16, 185, 129, 0.8)' },
  pitchBend: { label: 'PITCH BEND', type: 'MIDI BEND', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.8)' },
  velocity: { label: 'VELOCITY', type: 'KEY DYNAMICS', color: '#6366f1', glow: 'rgba(99, 102, 241, 0.8)' },
  chaos: { label: 'CHAOS / NOISE', type: 'STOCHASTIC', color: '#e11d48', glow: 'rgba(225, 29, 72, 0.8)' },
};

export const VisualizerSection: React.FC<VisualizerSectionProps> = ({
  analyser,
  hoveredModSource,
  modMatrix = [],
  liveModValues,
  osc1,
  osc2,
}) => {
  const [mode, setMode] = useState<'oscilloscope' | 'spectrum' | 'spectral' | 'phase' | 'modflow'>('oscilloscope');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active routes for the currently hovered modulator
  const activeRoutesForHovered = hoveredModSource
    ? modMatrix.filter((r) => r.enabled && r.source === hoveredModSource)
    : [];

  const osc1Phase = ((osc1?.phase ?? 0) % 1 + 1) % 1;
  const osc2Phase = ((osc2?.phase ?? 0) % 1 + 1) % 1;
  const osc2Enabled = osc2?.enabled ?? true;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let animTime = 0;

    const render = () => {
      animTime += 0.035;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 1. Dark Background with subtle grid
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

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

      // 2. CHECK IF A MODULATOR IS HOVERED OR IN 'modflow' MODE
      // If a specific LFO or Envelope is hovered, we render the glowing routing feedback system!
      const showHoverRouting = !!hoveredModSource;
      const isModFlowMode = mode === 'modflow';

      if (showHoverRouting || isModFlowMode) {
        // =========================================================================
        // VISUAL FEEDBACK SYSTEM: GLOWING LINES FROM SOURCE BLOCKS TO DESTINATIONS
        // =========================================================================
        const currentSource = hoveredModSource || 'lfo1';
        const srcConf = SOURCE_CONFIGS[currentSource] || {
          label: currentSource.toUpperCase(),
          type: 'MOD SOURCE',
          color: '#38bdf8',
          glow: 'rgba(56, 189, 248, 0.8)',
        };

        const currentLiveVal = liveModValues?.sources[currentSource] ?? 0;
        const routes = modMatrix.filter((r) => r.enabled && r.source === currentSource);

        // Semi-transparent ambient backdrop overlay to make glowing cables pop
        ctx.fillStyle = 'rgba(9, 9, 12, 0.90)';
        ctx.fillRect(0, 0, width, height);

        // Header watermark tag
        ctx.font = '8px monospace';
        ctx.fillStyle = '#52525b';
        ctx.textAlign = 'left';
        ctx.fillText('DYNAMIC MODULATION ROUTING BUS', 8, 11);

        // A. SOURCE BLOCK (LEFT)
        const srcCardW = 110;
        const srcCardH = 46;
        const srcCardX = 10;
        const srcCardY = (height - srcCardH) / 2;
        const srcSocketX = srcCardX + srcCardW;
        const srcSocketY = height / 2;

        ctx.save();
        // Pulsing ambient aura around source block
        const auraPulse = 12 + Math.sin(animTime * 5) * 4;
        ctx.shadowColor = srcConf.color;
        ctx.shadowBlur = auraPulse;
        ctx.fillStyle = '#111116';
        ctx.strokeStyle = srcConf.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(srcCardX, srcCardY, srcCardW, srcCardH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Source Card Content
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(srcConf.label, srcCardX + 10, srcCardY + 16);

        ctx.font = '7.5px monospace';
        ctx.fillStyle = srcConf.color;
        ctx.fillText(srcConf.type, srcCardX + 10, srcCardY + 28);

        // Live modulation value readout
        ctx.font = 'bold 8.5px monospace';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`OUT: ${currentLiveVal >= 0 ? '+' : ''}${currentLiveVal.toFixed(2)}`, srcCardX + 10, srcCardY + 40);

        // Source Jack / Output Socket
        ctx.shadowColor = srcConf.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#09090b';
        ctx.strokeStyle = srcConf.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(srcSocketX, srcSocketY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(srcSocketX, srcSocketY, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // B. DESTINATION CONTROLS (RIGHT)
        if (routes.length > 0) {
          const numDests = routes.length;
          const dstCardW = Math.min(130, Math.max(100, width * 0.28));
          const dstCardH = 34;
          const dstCardX = width - dstCardW - 10;

          // Calculate vertical distribution for destination controls
          const spacing =
            numDests === 1
              ? 0
              : (height - 24 - dstCardH) / (numDests - 1);

          routes.forEach((route, idx) => {
            const dstCardY = numDests === 1 ? (height - dstCardH) / 2 : 12 + idx * spacing;
            const dstSocketX = dstCardX;
            const dstSocketY = dstCardY + dstCardH / 2;

            // 1. Destination Card Block
            ctx.save();
            ctx.fillStyle = '#111116';
            ctx.strokeStyle = '#27272a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(dstCardX, dstCardY, dstCardW, dstCardH, 5);
            ctx.fill();
            ctx.stroke();

            const destLabel = DEST_LABELS[route.destination] || route.destination.replace('_', ' ').toUpperCase();
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#e4e4e7';
            ctx.textAlign = 'left';
            ctx.fillText(destLabel, dstCardX + 12, dstCardY + 14);

            const depthPct = `${route.amount >= 0 ? '+' : ''}${Math.round(route.amount * 100)}%`;
            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = srcConf.color;
            ctx.fillText(`${depthPct} ${route.bipolar ? 'BIP' : 'UNI'}`, dstCardX + 12, dstCardY + 26);

            // Input Jack Socket on Destination Card
            ctx.shadowColor = srcConf.color;
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#09090b';
            ctx.strokeStyle = '#52525b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(dstSocketX, dstSocketY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = srcConf.color;
            ctx.beginPath();
            ctx.arc(dstSocketX, dstSocketY, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 2. GLOWING LINES CONNECTING SOURCE TO DESTINATION
            const cp1x = srcSocketX + (dstSocketX - srcSocketX) * 0.42;
            const cp1y = srcSocketY;
            const cp2x = srcSocketX + (dstSocketX - srcSocketX) * 0.58;
            const cp2y = dstSocketY;

            // Layer 1: Ambient Bloom Diffuse Glow
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(srcSocketX, srcSocketY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dstSocketX, dstSocketY);
            ctx.strokeStyle = srcConf.color;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 8;
            ctx.shadowColor = srcConf.color;
            ctx.shadowBlur = 18;
            ctx.stroke();

            // Layer 2: High-Energy Neon Conduit
            ctx.beginPath();
            ctx.moveTo(srcSocketX, srcSocketY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dstSocketX, dstSocketY);
            ctx.strokeStyle = srcConf.color;
            ctx.globalAlpha = 0.95;
            ctx.lineWidth = 2.8;
            ctx.shadowColor = srcConf.color;
            ctx.shadowBlur = 8;
            ctx.stroke();

            // Layer 3: Laser Core
            ctx.beginPath();
            ctx.moveTo(srcSocketX, srcSocketY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dstSocketX, dstSocketY);
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = 0.95;
            ctx.lineWidth = 1.1;
            ctx.shadowBlur = 0;
            ctx.stroke();
            ctx.restore();

            // 3. ANIMATED TRAVELING PHOTONS / ENERGY PARTICLES
            const particleSpeed = Math.max(0.35, Math.abs(route.amount) * 1.5);
            for (let p = 0; p < 3; p++) {
              const t = (animTime * particleSpeed + p / 3) % 1;
              const u = 1 - t;
              const px = u * u * u * srcSocketX + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * dstSocketX;
              const py = u * u * u * srcSocketY + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * dstSocketY;

              ctx.save();
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = srcConf.color;
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.arc(px, py, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // 4. MIDPOINT ROUTING AMOUNT BADGE PILL
            const midT = 0.5;
            const mu = 1 - midT;
            const mx = mu * mu * mu * srcSocketX + 3 * mu * mu * midT * cp1x + 3 * mu * midT * midT * cp2x + midT * midT * midT * dstSocketX;
            const my = mu * mu * mu * srcSocketY + 3 * mu * mu * midT * cp1y + 3 * mu * midT * midT * cp2y + midT * midT * midT * dstSocketY;

            const pillText = `${route.amount >= 0 ? '+' : ''}${Math.round(route.amount * 100)}%`;
            ctx.save();
            ctx.font = 'bold 8.5px monospace';
            const tw = ctx.measureText(pillText).width;
            ctx.fillStyle = '#09090b';
            ctx.strokeStyle = srcConf.color;
            ctx.lineWidth = 1;
            ctx.shadowColor = srcConf.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.roundRect(mx - tw / 2 - 5, my - 7, tw + 10, 14, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(pillText, mx, my + 3.5);
            ctx.restore();
          });
        } else {
          // NO ACTIVE ROUTES FOR THIS HOVERED SOURCE: Show Holographic Status Card
          const midX = (srcSocketX + width) / 2;
          ctx.save();
          ctx.textAlign = 'center';

          // Faint guide paths
          const sampleDests = [
            { label: 'Filter Cutoff', y: height * 0.25 },
            { label: 'Osc 1 Pos', y: height * 0.5 },
            { label: 'Reverb Mix', y: height * 0.75 },
          ];

          sampleDests.forEach((sd) => {
            const dstX = width - 110;
            ctx.strokeStyle = '#27272a';
            ctx.setLineDash([3, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(srcSocketX, srcSocketY);
            ctx.bezierCurveTo(srcSocketX + 50, srcSocketY, dstX - 50, sd.y, dstX, sd.y);
            ctx.stroke();

            ctx.fillStyle = '#111116';
            ctx.beginPath();
            ctx.roundRect(dstX, sd.y - 12, 100, 24, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#52525b';
            ctx.font = '8.5px monospace';
            ctx.fillText(sd.label, dstX + 50, sd.y + 3);
          });
          ctx.setLineDash([]);

          // Center guidance badge
          ctx.font = 'bold 10.5px monospace';
          ctx.fillStyle = srcConf.color;
          ctx.shadowColor = srcConf.color;
          ctx.shadowBlur = 8;
          ctx.fillText(`⚡ ${srcConf.label} READY • NO ACTIVE MATRIX DESTINATIONS`, midX, height / 2 - 6);

          ctx.font = '8.5px monospace';
          ctx.fillStyle = '#71717a';
          ctx.shadowBlur = 0;
          ctx.fillText('Assign routes in Modulation Matrix below to route modulation', midX, height / 2 + 10);
          ctx.restore();
        }

        animId = requestAnimationFrame(render);
        return;
      }

      // =========================================================================
      // STANDARD AUDIO ANALYZER MODES (OSCILLOSCOPE, SPECTRAL, SPECTRUM, PHASE)
      // Including Initial Cycle Starting Point Relative to Phase Setting
      // =========================================================================
      if (!analyser) {
        // Idle line when audio engine has not started
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
        // -----------------------------------------------------------------------
        // OSCILLOSCOPE BEAM
        // -----------------------------------------------------------------------
        // Center zero-crossing line
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Waveform plot
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

        // INITIAL CYCLE STARTING POINT INDICATOR RELATIVE TO PHASE SETTING
        // OSC 1 Phase Starting Point
        const osc1Idx = Math.min(bufferLength - 1, Math.floor(osc1Phase * bufferLength));
        const osc1Y = (timeData[osc1Idx] / 128.0 * height) / 2;
        const osc1X = osc1Phase * width;

        ctx.save();
        // Glowing vertical phase marker
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(osc1X, 0);
        ctx.lineTo(osc1X, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Glowing Cycle Starting Point Node
        ctx.fillStyle = '#09090b';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(osc1X, osc1Y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(osc1X, osc1Y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Tag label
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.textAlign = osc1X > width - 50 ? 'right' : 'left';
        ctx.fillText(`φ1: ${Math.round(osc1Phase * 360)}°`, osc1X + (osc1X > width - 50 ? -8 : 8), Math.max(14, Math.min(height - 10, osc1Y - 8)));
        ctx.restore();

        // OSC 2 Phase Starting Point (if enabled)
        if (osc2Enabled) {
          const osc2Idx = Math.min(bufferLength - 1, Math.floor(osc2Phase * bufferLength));
          const osc2Y = (timeData[osc2Idx] / 128.0 * height) / 2;
          const osc2X = osc2Phase * width;

          ctx.save();
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(osc2X, 0);
          ctx.lineTo(osc2X, height);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#09090b';
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(osc2X, osc2Y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(osc2X, osc2Y, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = osc2X > width - 50 ? 'right' : 'left';
          ctx.fillText(`φ2: ${Math.round(osc2Phase * 360)}°`, osc2X + (osc2X > width - 50 ? -8 : 8), Math.max(14, Math.min(height - 10, osc2Y + 12)));
          ctx.restore();
        }

      } else if (mode === 'spectrum') {
        // -----------------------------------------------------------------------
        // FFT SPECTRUM BARS
        // -----------------------------------------------------------------------
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
        // -----------------------------------------------------------------------
        // STEREO PHASE FIELD & PHASE STARTING POINT VECTORS
        // -----------------------------------------------------------------------
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = height * 0.44;

        // Polar grid circles
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, scale * 0.5, 0, Math.PI * 2);
        ctx.arc(centerX, centerY, scale, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
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

        // Phase Angle Starting Vectors relative to phase setting
        // OSC 1 Phase Vector (Cyan)
        const rad1 = osc1Phase * 2 * Math.PI - Math.PI / 2;
        const rx1 = centerX + Math.cos(rad1) * scale * 0.95;
        const ry1 = centerY + Math.sin(rad1) * scale * 0.95;

        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(rx1, ry1);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rx1, ry1, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(`OSC 1 φ ${Math.round(osc1Phase * 360)}°`, rx1 + (rx1 > centerX ? 6 : -60), ry1 + (ry1 > centerY ? 10 : -4));
        ctx.restore();

        // OSC 2 Phase Vector (Amber)
        if (osc2Enabled) {
          const rad2 = osc2Phase * 2 * Math.PI - Math.PI / 2;
          const rx2 = centerX + Math.cos(rad2) * scale * 0.95;
          const ry2 = centerY + Math.sin(rad2) * scale * 0.95;

          ctx.save();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(rx2, ry2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(rx2, ry2, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`OSC 2 φ ${Math.round(osc2Phase * 360)}°`, rx2 + (rx2 > centerX ? 6 : -60), ry2 + (ry2 > centerY ? 10 : -4));
          ctx.restore();
        }

      } else if (mode === 'spectral') {
        // -----------------------------------------------------------------------
        // DUAL SPECTRAL MODE: WAVEFORM + FFT SIDE-BY-SIDE
        // -----------------------------------------------------------------------
        const splitX = Math.floor(width * 0.48);

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

        // Phase starting markers in the waveform pane
        const osc1WX = 3 + osc1Phase * (splitX - 6);
        const osc1WIdx = Math.min(bufferLength - 1, Math.floor(osc1Phase * bufferLength));
        const osc1WY = (timeData[osc1WIdx] / 128.0 * (height - 18)) / 2 + 9;

        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(osc1WX, 3);
        ctx.lineTo(osc1WX, height - 3);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(osc1WX, osc1WY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (osc2Enabled) {
          const osc2WX = 3 + osc2Phase * (splitX - 6);
          const osc2WIdx = Math.min(bufferLength - 1, Math.floor(osc2Phase * bufferLength));
          const osc2WY = (timeData[osc2WIdx] / 128.0 * (height - 18)) / 2 + 9;

          ctx.save();
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(osc2WX, 3);
          ctx.lineTo(osc2WX, height - 3);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(osc2WX, osc2WY, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Left Pane Labels & Peak percentage
        ctx.font = '8px monospace';
        ctx.fillStyle = '#71717a';
        ctx.fillText('WAVEFORM [TIME]', 6, 12);

        // Center vertical divider
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(splitX, 3);
        ctx.lineTo(splitX, height - 3);
        ctx.stroke();

        // Right Pane: FFT Frequency Spectrum
        const rightStartX = splitX + 6;
        const rightWidth = width - rightStartX - 4;
        const numBins = 38;
        const barW = Math.max(1, rightWidth / numBins - 1);
        let maxFreqVal = 0;
        let maxFreqIdx = 0;

        for (let i = 0; i < numBins; i++) {
          const binIndex = Math.floor(Math.pow(i / numBins, 2.1) * (bufferLength * 0.75));
          const val = freqData[binIndex] / 255.0;
          if (val > maxFreqVal) {
            maxFreqVal = val;
            maxFreqIdx = i;
          }

          const barH = val * (height - 24);
          const bx = rightStartX + i * (barW + 1);
          const by = height - 12 - barH;

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

        // Right Pane Header
        ctx.font = '8px monospace';
        ctx.fillStyle = '#71717a';
        ctx.fillText('FFT SPECTRUM', rightStartX + 2, 12);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [analyser, mode, hoveredModSource, modMatrix, liveModValues, osc1Phase, osc2Phase, osc2Enabled]);

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
          title="Oscilloscope Beam with Phase Starting Point Markers"
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
          title="Stereo Phase Field & Angle Vectors"
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

      {/* Dynamic Hover Indicator, Routing Paths status, or Phase Readout */}
      {hoveredModSource ? (
        <div className="absolute bottom-1 left-2 flex items-center space-x-2 text-[10px] font-mono bg-zinc-900/95 backdrop-blur px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 shadow-md">
          <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
          <span className="font-bold text-amber-300">{hoveredModSource.toUpperCase()}</span>
          <span>➔</span>
          {activeRoutesForHovered.length > 0 ? (
            <span className="text-cyan-300">
              Active Routing to {activeRoutesForHovered.length} destination{activeRoutesForHovered.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-zinc-400">Ready • No destinations routed in matrix</span>
          )}
        </div>
      ) : (
        <div className="absolute bottom-1 left-2 flex items-center space-x-2 text-[9px] font-mono text-zinc-400 bg-zinc-900/70 backdrop-blur px-1.5 py-0.5 rounded border border-zinc-800/50">
          <Disc className="w-2.5 h-2.5 text-cyan-400" />
          <span>φ START:</span>
          <span className="text-cyan-300">OSC1 {Math.round(osc1Phase * 360)}°</span>
          {osc2Enabled && (
            <>
              <span className="text-zinc-600">|</span>
              <span className="text-amber-300">OSC2 {Math.round(osc2Phase * 360)}°</span>
            </>
          )}
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500">48kHz DSP</span>
        </div>
      )}
    </div>
  );
};
