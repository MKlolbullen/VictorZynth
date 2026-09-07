import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SynthState,
  Preset,
  ReaperHostState,
  OscillatorParams,
  SubOscParams,
  NoiseParams,
  FilterParams,
  EnvelopeParams,
  LFOParams,
  EffectsParams,
  ModRouting,
  ModSource,
} from './types/synth';
import { INITIAL_SYNTH_STATE, PRESET_LIBRARY, getLocalUserPresets } from './audio/presets';
import { SynthAudioEngine, LiveModValues } from './audio/engine';
import { ReaperHostBar } from './components/ReaperHostBar';
import { OscillatorSection } from './components/OscillatorSection';
import { FilterSection } from './components/FilterSection';
import { ModulationSection } from './components/ModulationSection';
import { ModulationMatrix } from './components/ModulationMatrix';
import { EffectsSection } from './components/EffectsSection';
import { VisualizerSection } from './components/VisualizerSection';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { ReaperExportModal } from './components/ReaperExportModal';

export default function App() {
  const [synthState, setSynthState] = useState<SynthState>(INITIAL_SYNTH_STATE);
  const [currentPreset, setCurrentPreset] = useState<Preset>(PRESET_LIBRARY[0]);
  const [userPresets, setUserPresets] = useState<Preset[]>(() => getLocalUserPresets());
  const [hoveredModSource, setHoveredModSource] = useState<ModSource | null>(null);
  const [isAudioRunning, setIsAudioRunning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const [hostState, setHostState] = useState<ReaperHostState>({
    tempo: 120,
    isPlaying: false,
    timeSignature: [4, 4],
    sampleRate: 48000,
    bufferSize: 128,
    activeTrack: 1,
    trackName: 'AetherWave VSTi',
    midiConnected: false,
    midiDeviceName: '',
    cpuLoad: 1.4,
  });

  const [liveModValues, setLiveModValues] = useState<LiveModValues>({
    sources: {
      lfo1: 0,
      lfo2: 0,
      env1: 0,
      env2: 0,
      macro1: 0,
      macro2: 0,
      macro3: 0,
      macro4: 0,
      modWheel: 0,
      pitchBend: 0,
      velocity: 0,
      chaos: 0,
    },
    destinations: {
      osc1_pitch: 0,
      osc1_pos: 0,
      osc1_warp: 0,
      osc1_level: 0,
      osc2_pitch: 0,
      osc2_pos: 0,
      osc2_warp: 0,
      osc2_level: 0,
      filter_cutoff: 0,
      filter_res: 0,
      filter_drive: 0,
      reverb_mix: 0,
      delay_mix: 0,
      delay_time: 0,
      chorus_mix: 0,
      lfo1_rate: 0,
      lfo2_rate: 0,
      pan: 0,
    },
  });

  const engineRef = useRef<SynthAudioEngine | null>(null);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new SynthAudioEngine(INITIAL_SYNTH_STATE);
    engineRef.current = engine;

    // Polling live modulation metrics to feed UI dials & patch cords
    const interval = setInterval(() => {
      if (engineRef.current) {
        setLiveModValues({
          sources: { ...engineRef.current.liveModValues.sources },
          destinations: { ...engineRef.current.liveModValues.destinations },
          envStages: engineRef.current.liveModValues.envStages
            ? { ...engineRef.current.liveModValues.envStages }
            : undefined,
        });
      }
    }, 35); // ~30 fps UI refresh

    return () => {
      clearInterval(interval);
      engine.dispose();
    };
  }, []);

  // Web MIDI API integration
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
      (navigator as unknown as { requestMIDIAccess: () => Promise<{ inputs: Iterable<{ name?: string; onmidimessage: ((msg: { data: Uint8Array }) => void) | null }> }> })
        .requestMIDIAccess()
        .then((midiAccess) => {
          let deviceName = '';
          for (const input of midiAccess.inputs) {
            deviceName = input.name || 'MIDI Controller';
            input.onmidimessage = (msg) => {
              const [status, data1, data2] = msg.data;
              const cmd = status >> 4;
              if (cmd === 9 && data2 > 0) {
                // Note on
                engineRef.current?.noteOn(data1, data2 / 127);
              } else if (cmd === 8 || (cmd === 9 && data2 === 0)) {
                // Note off
                engineRef.current?.noteOff(data1);
              } else if (cmd === 11 && data1 === 1) {
                // CC 1 Mod Wheel
                engineRef.current?.setModWheel(data2 / 127);
              } else if (cmd === 14) {
                // Pitch bend
                const val = (data2 * 128 + data1 - 8192) / 8192;
                engineRef.current?.setPitchBend(val);
              }
            };
          }

          if (deviceName) {
            setHostState((prev) => ({
              ...prev,
              midiConnected: true,
              midiDeviceName: deviceName,
            }));
          }
        })
        .catch(() => {
          // MIDI not available or permission declined, fallback safely to virtual keyboard
        });
    }
  }, []);

  const handleStartAudio = async () => {
    if (engineRef.current) {
      await engineRef.current.initAudio();
      setAnalyser(engineRef.current.getAnalyser());
      setIsAudioRunning(true);
    }
  };

  // State update helpers
  const updateSynth = useCallback((partial: Partial<SynthState>) => {
    setSynthState((prev) => {
      const updated = { ...prev, ...partial };
      engineRef.current?.updateState(updated);
      return updated;
    });
  }, []);

  const handlePresetSelect = (preset: Preset) => {
    setCurrentPreset(preset);
    setSynthState(preset.state);
    engineRef.current?.updateState(preset.state);
  };

  const handleMacroChange = (index: 0 | 1 | 2 | 3, val: number) => {
    const updatedMacros: [number, number, number, number] = [
      synthState.macros[0],
      synthState.macros[1],
      synthState.macros[2],
      synthState.macros[3],
    ];
    updatedMacros[index] = val;
    updateSynth({ macros: updatedMacros });
    engineRef.current?.setMacro(index, val);
  };

  const handleMacroRename = (index: 0 | 1 | 2 | 3, newName: string) => {
    const updatedNames: [string, string, string, string] = [
      synthState.macroNames[0],
      synthState.macroNames[1],
      synthState.macroNames[2],
      synthState.macroNames[3],
    ];
    updatedNames[index] = newName.trim() || `Macro ${index + 1}`;
    updateSynth({ macroNames: updatedNames });
  };

  // Soundscape Demo Sequence Toggle
  const handleTogglePlay = async () => {
    if (!isAudioRunning) {
      await handleStartAudio();
    }

    if (hostState.isPlaying) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      engineRef.current?.allNotesOff();
      setHostState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      setHostState((prev) => ({ ...prev, isPlaying: true }));
      // Evolving ambient chord progression
      const chords = [
        [48, 55, 62, 67], // C min9
        [44, 51, 58, 63], // Ab maj7
        [46, 53, 60, 65], // Bb add9
        [41, 48, 55, 60], // F min9
      ];
      let chordIdx = 0;

      const playChord = () => {
        engineRef.current?.allNotesOff();
        const currentChord = chords[chordIdx];
        currentChord.forEach((note) => {
          engineRef.current?.noteOn(note, 0.75);
        });
        chordIdx = (chordIdx + 1) % chords.length;
      };

      playChord();
      demoIntervalRef.current = setInterval(playChord, 5000); // 5 seconds per chord
    }
  };

  // Record to WAV
  const handleToggleRecord = async () => {
    if (!engineRef.current) return;
    if (!isAudioRunning) {
      await handleStartAudio();
    }

    if (!isRecording) {
      const started = engineRef.current.startRecording();
      if (started) setIsRecording(true);
    } else {
      const blob = engineRef.current.stopRecording();
      setIsRecording(false);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aetherwave_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    }
  };

  // Modulation Matrix CRUD
  const handleAddRouting = () => {
    const newRoute: ModRouting = {
      id: `m_${Date.now()}`,
      source: 'lfo1',
      destination: 'filter_cutoff',
      amount: 0.5,
      bipolar: true,
      enabled: true,
    };
    updateSynth({ modMatrix: [...synthState.modMatrix, newRoute] });
  };

  const handleRemoveRouting = (id: string) => {
    updateSynth({ modMatrix: synthState.modMatrix.filter((r) => r.id !== id) });
  };

  const handleUpdateRouting = (id: string, updates: Partial<ModRouting>) => {
    updateSynth({
      modMatrix: synthState.modMatrix.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    });
  };

  const combinedPresets = useMemo(() => {
    return [...PRESET_LIBRARY, ...userPresets];
  }, [userPresets]);

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black"
      onMouseDown={() => {
        if (!isAudioRunning) handleStartAudio();
      }}
    >
      {/* Reaper DAW Host Bar */}
      <ReaperHostBar
        hostState={hostState}
        currentPreset={currentPreset}
        allPresets={combinedPresets}
        isAudioRunning={isAudioRunning}
        isRecording={isRecording}
        masterVolume={synthState.effects.master.volume}
        onPresetSelect={handlePresetSelect}
        onTogglePlay={handleTogglePlay}
        onToggleRecord={handleToggleRecord}
        onTempoChange={(bpm) => setHostState((prev) => ({ ...prev, tempo: bpm }))}
        onMasterVolumeChange={(vol) =>
          updateSynth({ effects: { ...synthState.effects, master: { ...synthState.effects.master, volume: vol } } })
        }
        onOpenReaperExport={() => setIsExportModalOpen(true)}
        onStartAudio={handleStartAudio}
      />

      {/* Main Synthesizer Workspace */}
      <main className="flex-1 p-3 max-w-[1600px] w-full mx-auto space-y-3">
        {/* Top Grid: Dual Wavetable Oscillators & Multi-Mode Filter + Master Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Left: Dual Wavetable Oscillators (7 cols) */}
          <div className="lg:col-span-7">
            <OscillatorSection
              osc1={synthState.osc1}
              osc2={synthState.osc2}
              sub={synthState.sub}
              noise={synthState.noise}
              osc1PosModOffset={liveModValues.destinations.osc1_pos}
              osc2PosModOffset={liveModValues.destinations.osc2_pos}
              osc1WarpModOffset={liveModValues.destinations.osc1_warp}
              osc2WarpModOffset={liveModValues.destinations.osc2_warp}
              osc1PhaseModOffset={liveModValues.destinations.osc1_phase}
              osc2PhaseModOffset={liveModValues.destinations.osc2_phase}
              onOsc1Change={(params) =>
                updateSynth({ osc1: { ...synthState.osc1, ...params } })
              }
              onOsc2Change={(params) =>
                updateSynth({ osc2: { ...synthState.osc2, ...params } })
              }
              onSubChange={(params) =>
                updateSynth({ sub: { ...synthState.sub, ...params } })
              }
              onNoiseChange={(params) =>
                updateSynth({ noise: { ...synthState.noise, ...params } })
              }
            />
          </div>

          {/* Right: Filter & Real-time Visualizer (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <FilterSection
              filter={synthState.filter}
              cutoffModOffset={liveModValues.destinations.filter_cutoff}
              resModOffset={liveModValues.destinations.filter_res}
              onFilterChange={(params) =>
                updateSynth({ filter: { ...synthState.filter, ...params } })
              }
            />

            <VisualizerSection
              analyser={analyser}
              hoveredModSource={hoveredModSource}
              modMatrix={synthState.modMatrix}
              liveModValues={liveModValues}
              osc1={synthState.osc1}
              osc2={synthState.osc2}
            />
          </div>
        </div>

        {/* Middle: LFOs, Envelopes, and Macro Morphing */}
        <ModulationSection
          lfo1={synthState.lfo1}
          lfo2={synthState.lfo2}
          env1={synthState.env1}
          env2={synthState.env2}
          macros={synthState.macros}
          macroNames={synthState.macroNames}
          liveSourceValues={liveModValues.sources}
          envStages={liveModValues.envStages}
          hoveredModSource={hoveredModSource}
          onHoverModSource={setHoveredModSource}
          onLfo1Change={(params) =>
            updateSynth({ lfo1: { ...synthState.lfo1, ...params } })
          }
          onLfo2Change={(params) =>
            updateSynth({ lfo2: { ...synthState.lfo2, ...params } })
          }
          onEnv1Change={(params) =>
            updateSynth({ env1: { ...synthState.env1, ...params } })
          }
          onEnv2Change={(params) =>
            updateSynth({ env2: { ...synthState.env2, ...params } })
          }
          onMacroChange={handleMacroChange}
          onMacroRename={handleMacroRename}
        />

        {/* Modular Modulation Matrix: Dynamic Patchboard & Routing Grid */}
        <ModulationMatrix
          routings={synthState.modMatrix}
          liveModValues={liveModValues}
          macroNames={synthState.macroNames}
          onAddRouting={handleAddRouting}
          onRemoveRouting={handleRemoveRouting}
          onUpdateRouting={handleUpdateRouting}
        />

        {/* Ambient Soundscape Effects Chain */}
        <EffectsSection
          effects={synthState.effects}
          reverbMixModOffset={liveModValues.destinations.reverb_mix}
          delayMixModOffset={liveModValues.destinations.delay_mix}
          onEffectsChange={(params) =>
            updateSynth({ effects: { ...synthState.effects, ...params } })
          }
        />

        {/* Interactive Virtual Keyboard & Drone Mode */}
        <VirtualKeyboard
          octave={synthState.octave}
          droneMode={synthState.droneMode}
          midiDeviceName={hostState.midiDeviceName}
          onOctaveChange={(oct) => updateSynth({ octave: oct })}
          onDroneToggle={() => {
            const nextMode = !synthState.droneMode;
            updateSynth({ droneMode: nextMode });
            if (!nextMode) {
              engineRef.current?.allNotesOff();
            }
          }}
          onNoteOn={async (note, vel) => {
            if (!isAudioRunning) {
              await handleStartAudio();
            }
            engineRef.current?.noteOn(note, vel);
          }}
          onNoteOff={(note) => engineRef.current?.noteOff(note)}
          onPitchBend={(val) => engineRef.current?.setPitchBend(val)}
          onModWheel={(val) => engineRef.current?.setModWheel(val)}
        />
      </main>

      {/* Reaper Export & Integration Modal */}
      <ReaperExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentState={synthState}
        currentPreset={currentPreset}
        userPresets={userPresets}
        onSaveUserPreset={(savedPreset) => {
          const refreshed = getLocalUserPresets();
          setUserPresets(refreshed);
          setCurrentPreset(savedPreset);
        }}
        onDeleteUserPreset={(id) => {
          const refreshed = getLocalUserPresets();
          setUserPresets(refreshed);
          if (currentPreset.id === id) {
            handlePresetSelect(PRESET_LIBRARY[0]);
          }
        }}
        onLoadPreset={(preset) => {
          handlePresetSelect(preset);
        }}
      />
    </div>
  );
}
