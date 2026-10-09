export type MelodyId = 'sunrise' | 'river' | 'spark' | 'hymn' | 'lantern';

export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const MELODIES: {
  id: MelodyId;
  name: string;
  family: 'major' | 'minor';
  root: number;
  hint: string;
}[] = [
  { id: 'sunrise', name: 'Sunrise', family: 'major', root: 0, hint: 'Rising hook, written in C.' },
  { id: 'river', name: 'River', family: 'major', root: 0, hint: 'Stepwise line that turns back.' },
  { id: 'spark', name: 'Spark', family: 'major', root: 0, hint: 'Eighth-note figure.' },
  { id: 'hymn', name: 'Hymn', family: 'major', root: 0, hint: 'Slow held tones.' },
  { id: 'lantern', name: 'Lantern', family: 'minor', root: 9, hint: 'Natural minor line, written in A.' },
];

export const SOUNDS: { id: string; file: string; label: string }[] = [
  { id: 'piano-c3', file: '/sounds/piano-c3.wav', label: 'Piano C3' },
  { id: 'piano-c4', file: '/sounds/piano-c4.wav', label: 'Piano C4' },
  { id: 'piano-c5', file: '/sounds/piano-c5.wav', label: 'Piano C5' },
  { id: 'bass-e1', file: '/sounds/bass-e1.wav', label: 'Bass E1' },
  { id: 'bass-e2', file: '/sounds/bass-e2.wav', label: 'Bass E2' },
  { id: 'pad-c4', file: '/sounds/pad-c4.wav', label: 'Pad C4' },
];
