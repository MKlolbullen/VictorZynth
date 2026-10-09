import React, { useEffect, useRef, useState } from 'react';
import { Download, Play, Square } from 'lucide-react';
import { MELODIES, ROOTS, SOUNDS, type MelodyId } from '../midi/catalog';
import { parseMidi, transposeClip } from '../midi/parse';

interface MelodyLibraryProps {
  onEnsureAudio: () => Promise<void>;
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
}

export const MelodyLibrary: React.FC<MelodyLibraryProps> = ({ onEnsureAudio, onNoteOn, onNoteOff }) => {
  const [melody, setMelody] = useState<MelodyId>('sunrise');
  const [root, setRoot] = useState(0);
  const [bpm, setBpm] = useState(96);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('Five lines, looped through the synth.');
  const stopRef = useRef<(() => void) | null>(null);
  const playingRef = useRef(false);
  const run = useRef(0);
  const sampleCtx = useRef<AudioContext | null>(null);
  const selection = useRef({ melody, root, bpm });
  selection.current = { melody, root, bpm };

  useEffect(
    () => () => {
      run.current += 1;
      stopRef.current?.();
    },
    [],
  );

  const halt = () => {
    run.current += 1;
    stopRef.current?.();
  };

  const start = async () => {
    halt();
    const mine = run.current;
    const chosen = selection.current;
    const meta = MELODIES.find((item) => item.id === chosen.melody);
    if (!meta) return;
    try {
      await onEnsureAudio();
      if (run.current !== mine) return;
      const response = await fetch(`/midi/${chosen.melody}.mid`);
      if (!response.ok) throw new Error('missing midi');
      const clip = transposeClip(parseMidi(new Uint8Array(await response.arrayBuffer())), meta.root, chosen.root);
      if (run.current !== mine) return;
      if (clip.notes.length === 0) throw new Error('empty midi');
      const notes = clip.notes;
      const span = Math.max(clip.beats, 0.001);
      const origin = performance.now();
      const spb = 60 / chosen.bpm;
      let index = 0;
      let loopStart = 0;
      const offs: { midi: number; beat: number }[] = [];
      const held = new Set<number>();
      let alive = true;
      const release = (midi: number) => {
        if (!held.has(midi)) return;
        held.delete(midi);
        onNoteOff(midi);
      };
      const timer = window.setInterval(() => {
        if (!alive) return;
        const abs = (performance.now() - origin) / 1000 / spb;
        while (offs.length > 0 && offs[0].beat <= abs) {
          const off = offs.shift();
          if (off) release(off.midi);
        }
        while (index < notes.length && loopStart + notes[index].beat <= abs + 0.03) {
          const note = notes[index];
          index += 1;
          held.add(note.midi);
          onNoteOn(note.midi, note.vel);
          offs.push({ midi: note.midi, beat: loopStart + note.beat + Math.max(0.05, note.dur) });
          offs.sort((a, b) => a.beat - b.beat);
        }
        if (index >= notes.length && abs + 0.02 >= loopStart + span) {
          loopStart += span;
          index = 0;
        }
      }, 25);
      if (run.current !== mine) {
        window.clearInterval(timer);
        return;
      }
      playingRef.current = true;
      setPlaying(true);
      setStatus(meta.hint);
      stopRef.current = () => {
        if (!alive) return;
        alive = false;
        window.clearInterval(timer);
        held.forEach((midi) => onNoteOff(midi));
        held.clear();
        playingRef.current = false;
        setPlaying(false);
        stopRef.current = null;
      };
    } catch {
      if (run.current !== mine) return;
      playingRef.current = false;
      setPlaying(false);
      setStatus('Could not read that MIDI file.');
    }
  };

  useEffect(() => {
    if (!playingRef.current) return;
    void start();
    // Restart the loop when the line, key, or tempo changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [melody, root, bpm]);

  const previewSound = async (file: string) => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!sampleCtx.current) sampleCtx.current = new Ctx();
    const audio = sampleCtx.current;
    if (audio.state !== 'running') await audio.resume();
    const response = await fetch(file);
    if (!response.ok) return;
    const buffer = await audio.decodeAudioData((await response.arrayBuffer()).slice(0));
    const src = audio.createBufferSource();
    src.buffer = buffer;
    src.connect(audio.destination);
    src.start();
  };

  const current = MELODIES.find((item) => item.id === melody);

  return (
    <section className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-lg flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-zinc-500">MELODY LIBRARY</h2>
          <p className="text-xs text-zinc-400 mt-1">{playing ? status : current?.hint}</p>
        </div>
        <a
          href={`/midi/${melody}.mid`}
          download={`${melody}.mid`}
          className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:text-cyan-300"
        >
          <Download className="size-3" aria-hidden="true" />
          MIDI
        </a>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MELODIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={melody === item.id}
            onClick={() => setMelody(item.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              melody === item.id
                ? 'border-cyan-400 bg-cyan-400 text-zinc-950'
                : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-zinc-100'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={playing ? 'Stop melody' : 'Play melody'}
          onClick={() => {
            if (playingRef.current) halt();
            else void start();
          }}
          className="inline-flex items-center gap-1 rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold text-zinc-950"
        >
          {playing ? <Square className="size-3" /> : <Play className="size-3" />}
          {playing ? 'Stop' : 'Play'}
        </button>
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          Key
          <select
            aria-label="Melody key"
            value={root}
            onChange={(event) => setRoot(Number(event.target.value))}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
          >
            {ROOTS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-36 flex-1 items-center gap-2 text-[11px] text-zinc-400">
          <span className="tabular-nums">{bpm}</span>
          <input
            aria-label="Melody tempo"
            type="range"
            min={40}
            max={200}
            step={1}
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            className="w-full accent-cyan-400"
          />
        </label>
      </div>

      <div>
        <h3 className="mb-2 text-[10px] font-bold tracking-[0.2em] text-zinc-500">SOUNDS</h3>
        <div className="flex flex-wrap gap-1.5">
          {SOUNDS.map((sound) => (
            <button
              key={sound.id}
              type="button"
              onClick={() => void previewSound(sound.file)}
              className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 hover:text-cyan-300"
            >
              {sound.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
