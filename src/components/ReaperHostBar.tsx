import React from 'react';
import { Preset, ReaperHostState } from '../types/synth';
import { PRESET_LIBRARY } from '../audio/presets';
import {
  Play,
  Square,
  Circle,
  ChevronLeft,
  ChevronRight,
  AudioWaveform,
  FileCode,
  Filter,
  Bookmark,
} from 'lucide-react';

interface ReaperHostBarProps {
  hostState: ReaperHostState;
  currentPreset: Preset;
  allPresets?: Preset[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  isAudioRunning: boolean;
  isRecording: boolean;
  masterVolume: number;
  onPresetSelect: (preset: Preset) => void;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onTempoChange: (bpm: number) => void;
  onMasterVolumeChange: (vol: number) => void;
  onOpenReaperExport: () => void;
  onStartAudio: () => void;
}

export const ReaperHostBar: React.FC<ReaperHostBarProps> = ({
  hostState,
  currentPreset,
  allPresets = PRESET_LIBRARY,
  selectedCategory = 'All',
  onCategoryChange,
  isAudioRunning,
  isRecording,
  masterVolume: _masterVolume,
  onPresetSelect,
  onTogglePlay,
  onToggleRecord,
  onTempoChange,
  onMasterVolumeChange: _onMasterVolumeChange,
  onOpenReaperExport,
  onStartAudio,
}) => {
  // Categories list
  const categories = [
    'All',
    'Pads',
    'Leads',
    'Bass',
    'FX',
    'Atmospheres',
    'Ambient Drones',
    'Cinematic',
    'User',
  ];

  // Filter presets based on category
  const filteredPresets = allPresets.filter((p) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'User') return p.isUserPreset;
    return p.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const activePresets = filteredPresets.length > 0 ? filteredPresets : allPresets;
  const currentIndex = activePresets.findIndex((p) => p.id === currentPreset.id);

  const handlePrevPreset = () => {
    if (activePresets.length === 0) return;
    const nextIdx = (currentIndex <= 0 ? activePresets.length - 1 : currentIndex - 1);
    onPresetSelect(activePresets[nextIdx]);
  };

  const handleNextPreset = () => {
    if (activePresets.length === 0) return;
    const nextIdx = (currentIndex < 0 || currentIndex >= activePresets.length - 1 ? 0 : currentIndex + 1);
    onPresetSelect(activePresets[nextIdx]);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'pads':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60';
      case 'leads':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
      case 'bass':
        return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
      case 'fx':
        return 'text-violet-400 bg-violet-950/60 border-violet-800/60';
      case 'user':
        return 'text-yellow-400 bg-yellow-950/60 border-yellow-800/60';
      case 'atmospheres':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
      default:
        return 'text-zinc-400 bg-zinc-900 border-zinc-700/60';
    }
  };

  return (
    <div className="bg-zinc-950 border-b border-zinc-800 px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
      {/* 1. Reaper VSTi Window Banner */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5 px-2 py-1 bg-zinc-900 border border-zinc-700/70 rounded">
          <AudioWaveform className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100 tracking-wide">
            Track 1: <span className="text-cyan-400 font-mono">VSTi: AetherWave</span>
          </span>
          <span className="text-[9px] px-1 py-0.2 bg-zinc-800 text-zinc-400 rounded font-mono">
            JSFX/VST3
          </span>
        </div>

        {/* Audio Engine Initializer button if suspended */}
        {!isAudioRunning && (
          <button
            type="button"
            onClick={onStartAudio}
            className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-md animate-pulse transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Enable Audio Engine</span>
          </button>
        )}
      </div>

      {/* 2. Preset Navigator with Category Filter */}
      <div className="flex items-center flex-wrap gap-1.5 bg-zinc-900/90 px-2.5 py-1 rounded border border-zinc-800 shadow-sm">
        {/* Category Filter Selector */}
        <div className="flex items-center space-x-1 border-r border-zinc-800 pr-2">
          <Filter className="w-3 h-3 text-zinc-400" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase hidden sm:inline">Type:</span>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange?.(e.target.value)}
            className="bg-zinc-950 text-zinc-200 border border-zinc-700 rounded px-1.5 py-0.5 text-xs font-mono font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
            title="Filter Presets by Category (Pads, Leads, Bass, FX, etc.)"
          >
            {categories.map((cat) => {
              const count = allPresets.filter((p) => {
                if (cat === 'All') return true;
                if (cat === 'User') return p.isUserPreset;
                return p.category.toLowerCase() === cat.toLowerCase();
              }).length;
              return (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center space-x-1">
          <span className="text-[10px] font-mono text-zinc-400 uppercase mr-0.5">Patch:</span>
          <button
            type="button"
            onClick={handlePrevPreset}
            className="p-1 text-zinc-400 hover:text-cyan-300 transition-colors"
            title="Previous Preset"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <select
            value={currentPreset.id}
            onChange={(e) => {
              const found = allPresets.find((p) => p.id === e.target.value);
              if (found) onPresetSelect(found);
            }}
            className="bg-zinc-950 text-cyan-300 border border-zinc-700 rounded px-2 py-0.5 text-xs font-mono font-medium focus:outline-none focus:border-cyan-500 max-w-[210px] cursor-pointer"
          >
            {activePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.isUserPreset ? '★ ' : ''}
                {preset.name} [{preset.category}]
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleNextPreset}
            className="p-1 text-zinc-400 hover:text-cyan-300 transition-colors"
            title="Next Preset"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Current Category Badge */}
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ml-1 hidden md:inline-block ${getCategoryColor(
              currentPreset.category
            )}`}
          >
            {currentPreset.isUserPreset && '★ '}
            {currentPreset.category}
          </span>
        </div>
      </div>

      {/* 3. Reaper Host Transport & DAW Sync */}
      <div className="flex items-center space-x-2 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
        {/* Play / Stop Demo Soundscape */}
        <button
          type="button"
          onClick={onTogglePlay}
          className={`p-1.5 rounded transition-colors ${
            hostState.isPlaying
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
          }`}
          title={hostState.isPlaying ? 'Stop Soundscape' : 'Play Soundscape Audition'}
        >
          {hostState.isPlaying ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
        </button>

        {/* Record to WAV Audio File */}
        <button
          type="button"
          onClick={onToggleRecord}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
            isRecording
              ? 'bg-rose-600 text-white animate-pulse'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
          }`}
          title={isRecording ? 'Stop and Download WAV Audio' : 'Record Live Soundscape to WAV'}
        >
          <Circle
            className={`w-3 h-3 ${isRecording ? 'fill-current text-white' : 'text-rose-500 fill-rose-500'}`}
          />
          <span>{isRecording ? 'REC 0:14' : 'REC WAV'}</span>
        </button>

        {/* BPM Selector */}
        <div className="flex items-center space-x-1 border-l border-zinc-700 pl-2 text-xs font-mono">
          <span className="text-zinc-500">BPM:</span>
          <input
            type="number"
            min={40}
            max={240}
            value={hostState.tempo}
            onChange={(e) => onTempoChange(Number(e.target.value))}
            className="w-12 bg-zinc-950 text-amber-400 border border-zinc-700 px-1 py-0.5 rounded text-center text-xs font-mono font-bold"
          />
        </div>

        {/* Reaper DSP Status */}
        <div className="hidden lg:flex items-center space-x-2 border-l border-zinc-700 pl-2 text-[10px] font-mono text-zinc-500">
          <span>48kHz</span>
          <span>•</span>
          <span>128 spls</span>
          <span>•</span>
          <span className="text-emerald-400">DSP 1.4%</span>
        </div>
      </div>

      {/* 4. Reaper Export & Integration Button */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={onOpenReaperExport}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-cyan-800/70 hover:border-cyan-600 rounded text-xs font-medium transition-colors shadow-sm"
        >
          <Bookmark className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">User Presets &</span>
          <span>JSFX Export</span>
        </button>
      </div>
    </div>
  );
};

