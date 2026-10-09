export type MidiNote = {
  beat: number;
  dur: number;
  midi: number;
  vel: number;
};

export type MidiClip = {
  division: number;
  notes: MidiNote[];
  beats: number;
};

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readVlq(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let next = offset;
  for (let i = 0; i < 4; i += 1) {
    const byte = bytes[next] ?? 0;
    next += 1;
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
  }
  return { value, next };
}

export function parseMidi(bytes: Uint8Array): MidiClip {
  if (bytes.length < 22 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "MThd") {
    return { division: 480, notes: [], beats: 0 };
  }
  const division = readU16(bytes, 12) || 480;
  let offset = 14;
  const pending = new Map<number, { beat: number; vel: number }>();
  const notes: MidiNote[] = [];
  let status = 0;
  while (offset + 8 <= bytes.length) {
    if (String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]) !== "MTrk") break;
    const length = readU32(bytes, offset + 4);
    const end = offset + 8 + length;
    let cursor = offset + 8;
    let tick = 0;
    status = 0;
    while (cursor < end) {
      const delta = readVlq(bytes, cursor);
      cursor = delta.next;
      tick += delta.value;
      let byte = bytes[cursor] ?? 0;
      if (byte < 0x80) {
        if (status === 0) break;
        byte = status;
      } else {
        status = byte;
        cursor += 1;
      }
      const kind = byte & 0xf0;
      if (kind === 0x90 || kind === 0x80) {
        const note = bytes[cursor] ?? 0;
        const vel = bytes[cursor + 1] ?? 0;
        cursor += 2;
        const beat = tick / division;
        const sounding = kind === 0x90 && vel > 0;
        if (sounding) {
          pending.set(note, { beat, vel: vel / 127 });
        } else {
          const start = pending.get(note);
          pending.delete(note);
          if (start) {
            notes.push({ beat: start.beat, dur: Math.max(0.05, beat - start.beat), midi: note, vel: start.vel });
          }
        }
      } else if (kind === 0xc0 || kind === 0xd0) {
        cursor += 1;
      } else if (kind === 0xf0 || byte === 0xff) {
        status = 0;
        const metaLen = readVlq(bytes, cursor + (byte === 0xff ? 1 : 0));
        cursor = metaLen.next + metaLen.value;
        if (byte === 0xff && bytes[cursor - metaLen.value - 1] === 0x2f) break;
      } else {
        cursor += 2;
      }
    }
    offset = end;
  }
  notes.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  const beats = notes.reduce((max, note) => Math.max(max, note.beat + note.dur), 0);
  return { division, notes, beats };
}

export function transposeClip(clip: MidiClip, fromPc: number, toPc: number): MidiClip {
  let shift = ((toPc - fromPc) % 12 + 12) % 12;
  if (shift > 6) shift -= 12;
  if (shift === 0) return clip;
  return {
    ...clip,
    notes: clip.notes.map((note) => ({ ...note, midi: note.midi + shift })),
  };
}
