import React, { useState, useEffect, useCallback } from 'react';
import { Volume2, Radio, Music, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';

interface VirtualKeyboardProps {
  octave: number;
  droneMode: boolean;
  onOctaveChange: (oct: number) => void;
  onDroneToggle: () => void;
  onNoteOn: (midiNote: number, velocity?: number) => void;
  onNoteOff: (midiNote: number) => void;
  onPitchBend: (val: number) => void;
  onModWheel: (val: number) => void;
  midiDeviceName?: string;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  octave,
  droneMode,
  onOctaveChange,
  onDroneToggle,
  onNoteOn,
  onNoteOff,
  onPitchBend,
  onModWheel,
  midiDeviceName,
}) => {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [pitchBendVal, setPitchBendVal] = useState(0); // -1 to 1
  const [modWheelVal, setModWheelVal] = useState(0); // 0 to 1

  // Key map for computer keyboard
  const computerKeyMap: Record<string, number> = {
    a: 0, // C
    w: 1, // C#
    s: 2, // D
    e: 3, // D#
    d: 4, // E
    f: 5, // F
    t: 6, // F#
    g: 7, // G
    y: 8, // G#
    h: 9, // A
    u: 10, // A#
    j: 11, // B
    k: 12, // C+1
    o: 13, // C#+1
    l: 14, // D+1
    p: 15, // D#+1
    ';': 16, // E+1
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      if (key === 'z') {
        onOctaveChange(Math.max(-2, octave - 1));
        return;
      }
      if (key === 'x') {
        onOctaveChange(Math.min(2, octave + 1));
        return;
      }
      if (key === ' ') {
        onDroneToggle();
        return;
      }

      if (key in computerKeyMap) {
        const note = 60 + octave * 12 + computerKeyMap[key];
        setActiveNotes((prev) => new Set(prev).add(note));
        onNoteOn(note, 0.85);
      }
    },
    [octave, onOctaveChange, onDroneToggle, onNoteOn]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if (key in computerKeyMap) {
        const note = 60 + octave * 12 + computerKeyMap[key];
        if (!droneMode) {
          setActiveNotes((prev) => {
            const next = new Set(prev);
            next.delete(note);
            return next;
          });
          onNoteOff(note);
        }
      }
    },
    [octave, droneMode, onNoteOff]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Handle Note Trigger on Click
  const handleKeyMouseDown = (midiNote: number) => {
    if (droneMode && activeNotes.has(midiNote)) {
      // Toggle off in drone mode
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
      onNoteOff(midiNote);
      return;
    }

    setActiveNotes((prev) => new Set(prev).add(midiNote));
    onNoteOn(midiNote, 0.85);
  };

  const handleKeyMouseUp = (midiNote: number) => {
    if (!droneMode) {
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
      onNoteOff(midiNote);
    }
  };

  // Keyboard rendering (2 octaves: 24 notes starting from C3 + octave*12)
  const baseNote = 48 + (octave + 1) * 12; // C3 + octave
  const whiteKeyOffsets = [0, 2, 4, 5, 7, 9, 11];
  const blackKeyOffsets = [
    { offset: 1, leftPct: 6.5 },
    { offset: 3, leftPct: 13.5 },
    { offset: 6, leftPct: 27.8 },
    { offset: 8, leftPct: 35.0 },
    { offset: 10, leftPct: 42.0 },
    { offset: 13, leftPct: 56.5 },
    { offset: 15, leftPct: 63.5 },
    { offset: 18, leftPct: 77.8 },
    { offset: 20, leftPct: 85.0 },
    { offset: 22, leftPct: 92.0 },
  ];

  // 14 white keys across 2 octaves
  const whiteKeys: number[] = [];
  for (let o = 0; o < 2; o++) {
    whiteKeyOffsets.forEach((off) => {
      whiteKeys.push(baseNote + o * 12 + off);
    });
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-2">
      {/* Top Bar with Drone Toggle & Octave Controls */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center space-x-3">
          {/* Drone Hold Switch */}
          <button
            type="button"
            onClick={onDroneToggle}
            className={`flex items-center space-x-2 px-3 py-1 rounded text-xs font-bold font-mono transition-all ${
              droneMode
                ? 'bg-rose-950 text-rose-300 border border-rose-600 shadow-sm animate-pulse'
                : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>DRONE HOLD: {droneMode ? 'ACTIVE' : 'OFF'}</span>
          </button>

          {/* Octave Shift */}
          <div className="flex items-center space-x-1 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500 mr-1">OCT:</span>
            <button
              type="button"
              onClick={() => onOctaveChange(Math.max(-2, octave - 1))}
              disabled={octave <= -2}
              className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
            <span className="font-bold text-cyan-400 w-5 text-center">
              {octave > 0 ? `+${octave}` : octave}
            </span>
            <button
              type="button"
              onClick={() => onOctaveChange(Math.min(2, octave + 1))}
              disabled={octave >= 2}
              className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-500">
            Keyboard: [A-K] keys • [Z/X] Octave • [Space] Drone
          </span>
        </div>

        {/* MIDI Connection Status */}
        <div className="flex items-center space-x-1.5 text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              midiDeviceName ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'
            }`}
          />
          <span className="text-zinc-400">
            MIDI: {midiDeviceName || 'Ready (Web MIDI)'}
          </span>
        </div>
      </div>

      {/* Piano Keyboard & Pitch/Mod Wheels */}
      <div className="flex items-stretch gap-2.5 h-24">
        {/* Pitch Bend & Mod Wheel Wheels */}
        <div className="flex space-x-2 bg-zinc-950 p-1.5 rounded border border-zinc-800">
          {/* Pitch Bend Wheel */}
          <div className="flex flex-col items-center justify-between w-6">
            <span className="text-[9px] font-mono text-zinc-500">PITCH</span>
            <div
              className="w-4 h-14 bg-zinc-900 border border-zinc-700 rounded relative cursor-ns-resize overflow-hidden"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const update = (clientY: number) => {
                  const norm = (clientY - rect.top) / rect.height;
                  const val = Math.max(-1, Math.min(1, (0.5 - norm) * 2));
                  setPitchBendVal(val);
                  onPitchBend(val);
                };
                update(e.clientY);
                const onMove = (ev: MouseEvent) => update(ev.clientY);
                const onUp = () => {
                  setPitchBendVal(0);
                  onPitchBend(0); // Snap back to center
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              <div
                className="absolute left-0 right-0 h-2 bg-cyan-400 rounded-sm shadow-sm"
                style={{ top: `${(1 - (pitchBendVal + 1) / 2) * 85}%` }}
              />
            </div>
            <span className="text-[8px] font-mono text-cyan-400">
              {pitchBendVal > 0 ? `+${pitchBendVal.toFixed(1)}` : pitchBendVal.toFixed(1)}
            </span>
          </div>

          {/* Mod Wheel */}
          <div className="flex flex-col items-center justify-between w-6">
            <span className="text-[9px] font-mono text-zinc-500">MOD</span>
            <div
              className="w-4 h-14 bg-zinc-900 border border-zinc-700 rounded relative cursor-ns-resize overflow-hidden"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const update = (clientY: number) => {
                  const norm = (clientY - rect.top) / rect.height;
                  const val = Math.max(0, Math.min(1, 1 - norm));
                  setModWheelVal(val);
                  onModWheel(val);
                };
                update(e.clientY);
                const onMove = (ev: MouseEvent) => update(ev.clientY);
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              <div
                className="absolute left-0 right-0 h-2 bg-violet-400 rounded-sm shadow-sm"
                style={{ top: `${(1 - modWheelVal) * 85}%` }}
              />
            </div>
            <span className="text-[8px] font-mono text-violet-400">
              {Math.round(modWheelVal * 100)}%
            </span>
          </div>
        </div>

        {/* Piano Keys Container */}
        <div className="relative flex-1 bg-zinc-950 rounded border border-zinc-800 p-0.5 overflow-hidden select-none">
          {/* White Keys */}
          <div className="flex w-full h-full">
            {whiteKeys.map((note) => {
              const isActive = activeNotes.has(note);
              return (
                <button
                  key={note}
                  type="button"
                  onMouseDown={() => handleKeyMouseDown(note)}
                  onMouseUp={() => handleKeyMouseUp(note)}
                  onMouseLeave={() => handleKeyMouseUp(note)}
                  className={`flex-1 h-full rounded-b border-x border-zinc-300/20 transition-colors flex flex-col justify-end items-center pb-1 text-[9px] font-mono ${
                    isActive
                      ? 'bg-cyan-400 text-zinc-950 font-bold shadow-inner'
                      : 'bg-zinc-200 hover:bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {note % 12 === 0 ? `C${Math.floor(note / 12) - 1}` : ''}
                </button>
              );
            })}
          </div>

          {/* Black Keys */}
          {blackKeyOffsets.map(({ offset, leftPct }) => {
            const note = baseNote + offset;
            const isActive = activeNotes.has(note);
            return (
              <button
                key={note}
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleKeyMouseDown(note);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  handleKeyMouseUp(note);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  handleKeyMouseUp(note);
                }}
                style={{ left: `${leftPct}%`, width: '4.8%' }}
                className={`absolute top-0 h-[62%] rounded-b shadow-md z-10 transition-colors ${
                  isActive
                    ? 'bg-cyan-400 border border-cyan-300 shadow-cyan-500/50'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-x border-b border-zinc-700'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
