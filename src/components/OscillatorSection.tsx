import React, { useState } from 'react';
import { OscillatorParams, SubOscParams, NoiseParams, WavetableId, WarpMode } from '../types/synth';
import { WAVETABLE_DEFINITIONS } from '../audio/wavetables';
import { WavetableVisualizer } from './WavetableVisualizer';
import { Knob } from './Knob';
import { PhaseOffsetDial } from './PhaseOffsetDial';
import { Power, Radio, Volume2, Sparkles } from 'lucide-react';

interface OscillatorSectionProps {
  osc1: OscillatorParams;
  osc2: OscillatorParams;
  sub: SubOscParams;
  noise: NoiseParams;
  osc1PosModOffset: number;
  osc2PosModOffset: number;
  osc1WarpModOffset: number;
  osc2WarpModOffset: number;
  osc1PhaseModOffset?: number;
  osc2PhaseModOffset?: number;
  onOsc1Change: (params: Partial<OscillatorParams>) => void;
  onOsc2Change: (params: Partial<OscillatorParams>) => void;
  onSubChange: (params: Partial<SubOscParams>) => void;
  onNoiseChange: (params: Partial<NoiseParams>) => void;
}

export const OscillatorSection: React.FC<OscillatorSectionProps> = ({
  osc1,
  osc2,
  sub,
  noise,
  osc1PosModOffset,
  osc2PosModOffset,
  osc1WarpModOffset,
  osc2WarpModOffset,
  osc1PhaseModOffset = 0,
  osc2PhaseModOffset = 0,
  onOsc1Change,
  onOsc2Change,
  onSubChange,
  onNoiseChange,
}) => {
  const [activeTab, setActiveTab] = useState<'osc1' | 'osc2'>('osc1');

  const wavetableIds = Object.keys(WAVETABLE_DEFINITIONS) as WavetableId[];
  const warpModes: WarpMode[] = ['none', 'bend', 'pwm', 'wavefold', 'sync', 'fm'];

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-3">
      {/* Top Header & Tab switcher */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center space-x-2">
          <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('osc1')}
              className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded tactile-spring-btn ${
                activeTab === 'osc1'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  osc1.enabled ? 'bg-cyan-400' : 'bg-zinc-600'
                }`}
              />
              <span>OSC 1 (Wavetable)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('osc2')}
              className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded tactile-spring-btn ${
                activeTab === 'osc2'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  osc2.enabled ? 'bg-amber-400' : 'bg-zinc-600'
                }`}
              />
              <span>OSC 2 (Wavetable)</span>
            </button>
          </div>
        </div>

        {/* Global Sub & Noise Toggles */}
        <div className="flex items-center space-x-3 text-xs text-zinc-400">
          <button
            type="button"
            onClick={() => onSubChange({ enabled: !sub.enabled })}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-[11px] font-mono tactile-spring-btn ${
              sub.enabled
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>SUB {sub.enabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNoiseChange({ enabled: !noise.enabled })}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-[11px] font-mono tactile-spring-btn ${
              noise.enabled
                ? 'bg-purple-950/60 text-purple-300 border-purple-800/50'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>NOISE {noise.enabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Active Oscillator Body */}
      {activeTab === 'osc1' ? (
        <div className="space-y-3">
          {/* Wavetable Visualizer */}
          <WavetableVisualizer
            tableId={osc1.tableId}
            position={osc1.position}
            warpMode={osc1.warpMode}
            warpAmount={osc1.warpAmount}
            phase={osc1.phase ?? 0}
            modOffset={osc1PosModOffset}
            color="cyan"
            onPositionChange={(pos) => onOsc1Change({ position: pos })}
          />

          {/* Table Selector, Warp Mode & Phase Offset Indicator Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs items-center">
            {/* Table Dropdown */}
            <div className="md:col-span-5 flex items-center space-x-2 bg-zinc-950/80 p-1.5 rounded border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Table:</span>
              <select
                value={osc1.tableId}
                onChange={(e) => onOsc1Change({ tableId: e.target.value as WavetableId })}
                className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded px-2 py-1 text-xs font-mono w-full focus:outline-none focus:border-cyan-500"
              >
                {wavetableIds.map((id) => (
                  <option key={id} value={id}>
                    {WAVETABLE_DEFINITIONS[id].name} ({WAVETABLE_DEFINITIONS[id].category})
                  </option>
                ))}
              </select>
            </div>

            {/* Warp Selector */}
            <div className="md:col-span-4 flex items-center space-x-2 bg-zinc-950/80 p-1.5 rounded border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Warp:</span>
              <div className="flex space-x-1 flex-1 overflow-x-auto">
                {warpModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onOsc1Change({ warpMode: mode })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tactile-spring-btn ${
                      osc1.warpMode === mode
                        ? 'bg-cyan-900 text-cyan-200 font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase Offset Indicator & Dial */}
            <div className="md:col-span-3">
              <PhaseOffsetDial
                phase={osc1.phase ?? 0}
                modOffset={osc1PhaseModOffset}
                color="cyan"
                label="Phase φ"
                onChange={(val) => onOsc1Change({ phase: val })}
              />
            </div>
          </div>

          {/* Tactile Spring Wavetable Morph Slider for OSC 1 */}
          <div className="bg-zinc-950/70 px-3 py-1.5 rounded border border-zinc-800/90 flex items-center space-x-3 text-xs knob-spring-container">
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-[10px] font-mono font-semibold text-cyan-400 uppercase tracking-wider">
                WT MORPH:
              </span>
              <span className="font-mono text-zinc-200 text-[11px] w-9 text-right font-medium">
                {Math.round(osc1.position * 100)}%
              </span>
            </div>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.005}
                value={osc1.position}
                onChange={(e) => onOsc1Change({ position: parseFloat(e.target.value) })}
                className="tactile-spring-slider"
                title="Tactile spring slider for wavetable position scrubbing"
              />
            </div>
            <span className="text-[9px] font-mono text-zinc-500 uppercase shrink-0 hidden sm:inline">
              FRAME {Math.round(osc1.position * 63) + 1}/64
            </span>
          </div>

          {/* Knobs Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 bg-zinc-950/60 p-2.5 rounded border border-zinc-800/80 items-center justify-items-center">
            <Knob
              label="Position"
              value={osc1.position}
              min={0}
              max={1}
              step={0.01}
              color="cyan"
              modOffset={osc1PosModOffset}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc1Change({ position: val })}
            />
            <Knob
              label="Warp"
              value={osc1.warpAmount}
              min={0}
              max={1}
              step={0.01}
              color="cyan"
              modOffset={osc1WarpModOffset}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc1Change({ warpAmount: val })}
            />
            <Knob
              label="Phase"
              value={osc1.phase ?? 0}
              min={0}
              max={1}
              step={0.005}
              color="cyan"
              modOffset={osc1PhaseModOffset}
              formatValue={(v) => `${Math.round(v * 360)}°`}
              onChange={(val) => onOsc1Change({ phase: val })}
            />
            <Knob
              label="Octave"
              value={osc1.octave}
              min={-3}
              max={3}
              step={1}
              color="cyan"
              formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(val) => onOsc1Change({ octave: val })}
            />
            <Knob
              label="Semi"
              value={osc1.semitone}
              min={-12}
              max={12}
              step={1}
              color="cyan"
              formatValue={(v) => (v > 0 ? `+${v}st` : `${v}st`)}
              onChange={(val) => onOsc1Change({ semitone: val })}
            />
            <Knob
              label="Fine"
              value={osc1.fine}
              min={-100}
              max={100}
              step={1}
              color="cyan"
              unit="c"
              onChange={(val) => onOsc1Change({ fine: val })}
            />
            <Knob
              label="Unison"
              value={osc1.unison}
              min={1}
              max={7}
              step={1}
              color="cyan"
              formatValue={(v) => `${Math.round(v)}v`}
              onChange={(val) => onOsc1Change({ unison: Math.round(val) })}
            />
            <Knob
              label="Detune"
              value={osc1.detune}
              min={0}
              max={1}
              step={0.01}
              color="cyan"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc1Change({ detune: val })}
            />
            <Knob
              label="Level"
              value={osc1.level}
              min={0}
              max={1}
              step={0.01}
              color="cyan"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc1Change({ level: val })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Wavetable Visualizer for OSC 2 */}
          <WavetableVisualizer
            tableId={osc2.tableId}
            position={osc2.position}
            warpMode={osc2.warpMode}
            warpAmount={osc2.warpAmount}
            phase={osc2.phase ?? 0}
            modOffset={osc2PosModOffset}
            color="amber"
            onPositionChange={(pos) => onOsc2Change({ position: pos })}
          />

          {/* Table Selector, Warp Mode & Phase Offset Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs items-center">
            <div className="md:col-span-5 flex items-center space-x-2 bg-zinc-950/80 p-1.5 rounded border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Table:</span>
              <select
                value={osc2.tableId}
                onChange={(e) => onOsc2Change({ tableId: e.target.value as WavetableId })}
                className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded px-2 py-1 text-xs font-mono w-full focus:outline-none focus:border-amber-500"
              >
                {wavetableIds.map((id) => (
                  <option key={id} value={id}>
                    {WAVETABLE_DEFINITIONS[id].name} ({WAVETABLE_DEFINITIONS[id].category})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 flex items-center space-x-2 bg-zinc-950/80 p-1.5 rounded border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Warp:</span>
              <div className="flex space-x-1 flex-1 overflow-x-auto">
                {warpModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onOsc2Change({ warpMode: mode })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tactile-spring-btn ${
                      osc2.warpMode === mode
                        ? 'bg-amber-900 text-amber-200 font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase Offset Indicator & Dial for OSC 2 */}
            <div className="md:col-span-3">
              <PhaseOffsetDial
                phase={osc2.phase ?? 0}
                modOffset={osc2PhaseModOffset}
                color="amber"
                label="Phase φ"
                onChange={(val) => onOsc2Change({ phase: val })}
              />
            </div>
          </div>

          {/* Tactile Spring Wavetable Morph Slider for OSC 2 */}
          <div className="bg-zinc-950/70 px-3 py-1.5 rounded border border-zinc-800/90 flex items-center space-x-3 text-xs knob-spring-container">
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-[10px] font-mono font-semibold text-amber-400 uppercase tracking-wider">
                WT MORPH:
              </span>
              <span className="font-mono text-zinc-200 text-[11px] w-9 text-right font-medium">
                {Math.round(osc2.position * 100)}%
              </span>
            </div>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.005}
                value={osc2.position}
                onChange={(e) => onOsc2Change({ position: parseFloat(e.target.value) })}
                className="tactile-spring-slider slider-amber"
                title="Tactile spring slider for wavetable position scrubbing"
              />
            </div>
            <span className="text-[9px] font-mono text-zinc-500 uppercase shrink-0 hidden sm:inline">
              FRAME {Math.round(osc2.position * 63) + 1}/64
            </span>
          </div>

          {/* Knobs Grid for OSC 2 */}
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 bg-zinc-950/60 p-2.5 rounded border border-zinc-800/80 items-center justify-items-center">
            <Knob
              label="Position"
              value={osc2.position}
              min={0}
              max={1}
              step={0.01}
              color="amber"
              modOffset={osc2PosModOffset}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc2Change({ position: val })}
            />
            <Knob
              label="Warp"
              value={osc2.warpAmount}
              min={0}
              max={1}
              step={0.01}
              color="amber"
              modOffset={osc2WarpModOffset}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc2Change({ warpAmount: val })}
            />
            <Knob
              label="Phase"
              value={osc2.phase ?? 0}
              min={0}
              max={1}
              step={0.005}
              color="amber"
              modOffset={osc2PhaseModOffset}
              formatValue={(v) => `${Math.round(v * 360)}°`}
              onChange={(val) => onOsc2Change({ phase: val })}
            />
            <Knob
              label="Octave"
              value={osc2.octave}
              min={-3}
              max={3}
              step={1}
              color="amber"
              formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(val) => onOsc2Change({ octave: val })}
            />
            <Knob
              label="Semi"
              value={osc2.semitone}
              min={-12}
              max={12}
              step={1}
              color="amber"
              formatValue={(v) => (v > 0 ? `+${v}st` : `${v}st`)}
              onChange={(val) => onOsc2Change({ semitone: val })}
            />
            <Knob
              label="Fine"
              value={osc2.fine}
              min={-100}
              max={100}
              step={1}
              color="amber"
              unit="c"
              onChange={(val) => onOsc2Change({ fine: val })}
            />
            <Knob
              label="Unison"
              value={osc2.unison}
              min={1}
              max={7}
              step={1}
              color="amber"
              formatValue={(v) => `${Math.round(v)}v`}
              onChange={(val) => onOsc2Change({ unison: Math.round(val) })}
            />
            <Knob
              label="Detune"
              value={osc2.detune}
              min={0}
              max={1}
              step={0.01}
              color="amber"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc2Change({ detune: val })}
            />
            <Knob
              label="Level"
              value={osc2.level}
              min={0}
              max={1}
              step={0.01}
              color="amber"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onOsc2Change({ level: val })}
            />
          </div>
        </div>
      )}

      {/* Sub & Noise Mini Controls Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-zinc-800/80">
        {/* Sub Oscillator Mini Panel */}
        <div className="flex items-center justify-between bg-zinc-950/40 p-1.5 rounded border border-zinc-800/60 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] text-emerald-400 font-bold">SUB OSC:</span>
            <div className="flex space-x-1">
              {(['sine', 'triangle', 'square'] as const).map((wf) => (
                <button
                  key={wf}
                  type="button"
                  onClick={() => onSubChange({ waveform: wf })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tactile-spring-btn ${
                    sub.waveform === wf
                      ? 'bg-emerald-900/80 text-emerald-200 font-bold border border-emerald-700/60'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {wf}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onSubChange({ octave: sub.octave === -1 ? -2 : -1 })}
              className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded text-[9px] font-mono tactile-spring-btn"
            >
              {sub.octave} Oct
            </button>
          </div>
          <div className="flex items-center space-x-1">
            <Knob
              label="Sub Vol"
              value={sub.level}
              min={0}
              max={1}
              size="sm"
              color="emerald"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onSubChange({ level: val })}
            />
          </div>
        </div>

        {/* Noise Mini Panel */}
        <div className="flex items-center justify-between bg-zinc-950/40 p-1.5 rounded border border-zinc-800/60 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] text-purple-400 font-bold">NOISE GEN:</span>
            <div className="flex space-x-1">
              {(['white', 'pink', 'cosmic'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onNoiseChange({ type })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tactile-spring-btn ${
                    noise.type === type
                      ? 'bg-purple-900/80 text-purple-200 font-bold border border-purple-700/60'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Knob
              label="Noise Vol"
              value={noise.level}
              min={0}
              max={1}
              size="sm"
              color="violet"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => onNoiseChange({ level: val })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
