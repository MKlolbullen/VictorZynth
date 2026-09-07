import React from 'react';
import { EffectsParams } from '../types/synth';
import { Knob } from './Knob';
import { Sparkles, Repeat, Radio, Gauge } from 'lucide-react';

interface EffectsSectionProps {
  effects: EffectsParams;
  reverbMixModOffset: number;
  delayMixModOffset: number;
  onEffectsChange: (params: Partial<EffectsParams>) => void;
}

export const EffectsSection: React.FC<EffectsSectionProps> = ({
  effects,
  reverbMixModOffset,
  delayMixModOffset,
  onEffectsChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {/* 1. Shimmer Reverb */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-zinc-200 tracking-wider">
              SHIMMER REVERB
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onEffectsChange({
                reverb: { ...effects.reverb, enabled: !effects.reverb.enabled },
              })
            }
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
              effects.reverb.enabled
                ? 'bg-cyan-950 text-cyan-300 border-cyan-800/60'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
            }`}
          >
            {effects.reverb.enabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-zinc-950/60 p-2 rounded border border-zinc-800/80 items-center justify-items-center">
          <Knob
            label="Decay"
            value={effects.reverb.decay}
            min={0.5}
            max={15.0}
            step={0.1}
            size="sm"
            color="cyan"
            unit="s"
            onChange={(val) =>
              onEffectsChange({ reverb: { ...effects.reverb, decay: val } })
            }
          />
          <Knob
            label="Shimmer"
            value={effects.reverb.shimmer}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            color="cyan"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ reverb: { ...effects.reverb, shimmer: val } })
            }
          />
          <Knob
            label="Mix"
            value={effects.reverb.mix}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            color="cyan"
            modOffset={reverbMixModOffset}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ reverb: { ...effects.reverb, mix: val } })
            }
          />
        </div>
      </div>

      {/* 2. Stereo Tape / Ping-Pong Delay */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <Repeat className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-200 tracking-wider">
              TAPE DELAY
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onEffectsChange({
                delay: { ...effects.delay, enabled: !effects.delay.enabled },
              })
            }
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
              effects.delay.enabled
                ? 'bg-amber-950 text-amber-300 border-amber-800/60'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
            }`}
          >
            {effects.delay.enabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-zinc-950/60 p-2 rounded border border-zinc-800/80 items-center justify-items-center">
          <Knob
            label="Time"
            value={effects.delay.time}
            min={0.05}
            max={1.5}
            step={0.01}
            size="sm"
            color="amber"
            unit="s"
            onChange={(val) =>
              onEffectsChange({ delay: { ...effects.delay, time: val } })
            }
          />
          <Knob
            label="Fdbk"
            value={effects.delay.feedback}
            min={0}
            max={0.9}
            step={0.01}
            size="sm"
            color="amber"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ delay: { ...effects.delay, feedback: val } })
            }
          />
          <Knob
            label="Mix"
            value={effects.delay.mix}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            color="amber"
            modOffset={delayMixModOffset}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ delay: { ...effects.delay, mix: val } })
            }
          />
        </div>
      </div>

      {/* 3. Stereo Chorus */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-200 tracking-wider">
              STEREO CHORUS
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onEffectsChange({
                chorus: { ...effects.chorus, enabled: !effects.chorus.enabled },
              })
            }
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
              effects.chorus.enabled
                ? 'bg-violet-950 text-violet-300 border-violet-800/60'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
            }`}
          >
            {effects.chorus.enabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-zinc-950/60 p-2 rounded border border-zinc-800/80 items-center justify-items-center">
          <Knob
            label="Rate"
            value={effects.chorus.rate}
            min={0.1}
            max={5.0}
            step={0.05}
            size="sm"
            color="violet"
            unit="Hz"
            onChange={(val) =>
              onEffectsChange({ chorus: { ...effects.chorus, rate: val } })
            }
          />
          <Knob
            label="Depth"
            value={effects.chorus.depth}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            color="violet"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ chorus: { ...effects.chorus, depth: val } })
            }
          />
          <Knob
            label="Mix"
            value={effects.chorus.mix}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            color="violet"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ chorus: { ...effects.chorus, mix: val } })
            }
          />
        </div>
      </div>

      {/* 4. Master Saturation & Limiter */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <Gauge className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-xs font-semibold text-zinc-200 tracking-wider">
              MASTER OUTPUT
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">LIMITER ON</span>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-2 rounded border border-zinc-800/80 items-center justify-items-center">
          <Knob
            label="Warmth Drive"
            value={effects.master.drive}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            color="rose"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ master: { ...effects.master, drive: val } })
            }
          />
          <Knob
            label="Master Vol"
            value={effects.master.volume}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            color="emerald"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(val) =>
              onEffectsChange({ master: { ...effects.master, volume: val } })
            }
          />
        </div>
      </div>
    </div>
  );
};
