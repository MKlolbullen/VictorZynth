import { WavetableId, WarpMode } from '../types/synth';

export interface WavetableDef {
  id: WavetableId;
  name: string;
  category: string;
  slices: Float32Array[]; // Array of single-cycle waveform samples (typically 256 samples each)
}

const TABLE_SIZE = 256;
const NUM_SLICES = 16;

// Utility to generate smooth mathematical slices
function generateSlices(generator: (sliceIndex: number, normIndex: number, phase: number) => number): Float32Array[] {
  const slices: Float32Array[] = [];
  for (let s = 0; s < NUM_SLICES; s++) {
    const normSlice = s / (NUM_SLICES - 1); // 0 to 1
    const buffer = new Float32Array(TABLE_SIZE);
    for (let i = 0; i < TABLE_SIZE; i++) {
      const phase = (i / TABLE_SIZE) * Math.PI * 2; // 0 to 2PI
      buffer[i] = generator(s, normSlice, phase);
    }
    // Normalize slice
    let max = 0.0001;
    for (let i = 0; i < TABLE_SIZE; i++) {
      if (Math.abs(buffer[i]) > max) max = Math.abs(buffer[i]);
    }
    for (let i = 0; i < TABLE_SIZE; i++) {
      buffer[i] = buffer[i] / max;
    }
    slices.push(buffer);
  }
  return slices;
}

// 1. Analog Warmth: Sine -> Triangle -> Saw -> Pulse/Square
const analogWarmthSlices = generateSlices((_, norm, phase) => {
  if (norm < 0.33) {
    const t = norm / 0.33;
    const sin = Math.sin(phase);
    // Triangle approx
    const tri = (Math.asin(Math.sin(phase)) * 2) / Math.PI;
    return sin * (1 - t) + tri * t;
  } else if (norm < 0.66) {
    const t = (norm - 0.33) / 0.33;
    const tri = (Math.asin(Math.sin(phase)) * 2) / Math.PI;
    // Saw approx
    let saw = 0;
    for (let h = 1; h <= 12; h++) {
      saw += (Math.sin(h * phase) / h) * (h % 2 === 0 ? -1 : 1);
    }
    saw *= 0.6;
    return tri * (1 - t) + saw * t;
  } else {
    const t = (norm - 0.66) / 0.34;
    let saw = 0;
    for (let h = 1; h <= 12; h++) {
      saw += (Math.sin(h * phase) / h) * (h % 2 === 0 ? -1 : 1);
    }
    saw *= 0.6;
    // Pulse with narrowing width
    const pw = 0.5 - t * 0.35;
    const pulse = (phase % (Math.PI * 2)) / (Math.PI * 2) < pw ? 1.0 : -1.0;
    return saw * (1 - t) + pulse * t;
  }
});

// 2. Spectral Void: Cosmic drone, hollow odd harmonics, deep sub, resonant cold comb
const spectralVoidSlices = generateSlices((_, norm, phase) => {
  let val = 0;
  const oddHarmonics = [1, 3, 5, 7, 9, 11, 15, 21];
  for (let i = 0; i < oddHarmonics.length; i++) {
    const h = oddHarmonics[i];
    const weight = Math.pow(1 / (i + 1), 1.2 - norm * 0.8) * Math.cos(norm * Math.PI * (i + 1) * 0.5);
    val += Math.sin(h * phase) * weight;
  }
  // Add slow sub resonant fold
  val += Math.sin(phase * 0.5) * (1 - norm) * 0.5;
  // Non-linear dispersion
  val = Math.tanh(val * (1.2 + norm * 2.0));
  return val;
});

// 3. Celestial Drone: Shimmering glassy partials, celestial organelle, choral sparkle
const celestialDroneSlices = generateSlices((_, norm, phase) => {
  let val = 0;
  const partials = [1, 2, 4, 5, 7, 8, 12, 16, 24];
  for (let i = 0; i < partials.length; i++) {
    const p = partials[i];
    // Dynamic spectral tilt scanning across frequencies
    const center = 1 + norm * 15;
    const dist = Math.abs(p - center);
    const amp = Math.exp(-dist * 0.3);
    val += Math.sin(p * phase + norm * p * 0.3) * amp;
  }
  // Soft high shimmer ring
  val += Math.sin(phase * 9 + Math.cos(phase * 3) * norm) * 0.25 * norm;
  return val;
});

// 4. Vocal Formants: Ah -> Eh -> Ee -> Oh -> Oo vowel transitions
const vocalFormantSlices = generateSlices((_, norm, phase) => {
  // Formant formant peaks shifting with norm
  const f1 = 3 + norm * 4; // First formant
  const f2 = 8 + (1 - norm) * 10; // Second formant
  const f3 = 18 + Math.sin(norm * Math.PI) * 6; // Third formant
  
  let val = Math.sin(phase);
  val += Math.sin(f1 * phase) * 0.7;
  val += Math.sin(f2 * phase) * 0.5;
  val += Math.sin(f3 * phase) * 0.25 * (norm + 0.2);
  // Asymmetry for human glottal pulse
  return Math.sin(phase) > 0 ? val : val * 0.6;
});

// 5. Cyber Wavefold: West-coast style folded wave, aggressive sync distortion
const cyberWavefoldSlices = generateSlices((_, norm, phase) => {
  let base = Math.sin(phase);
  // Wavefolding math
  const foldDrive = 1.0 + norm * 6.0;
  let folded = Math.sin(base * foldDrive);
  if (Math.abs(folded) > 0.8) {
    folded = Math.sign(folded) * (1.6 - Math.abs(folded));
  }
  // Hard sync harmonics
  const syncMult = 1.0 + norm * 3.5;
  const syncPhase = (phase * syncMult) % (Math.PI * 2);
  const syncComponent = (1 - (syncPhase / (Math.PI * 2))) * 2 - 1;
  return folded * 0.7 + syncComponent * norm * 0.5;
});

// 6. Metallic Bell: Inharmonic partials, struck chime, metallic resonances
const metallicBellSlices = generateSlices((_, norm, phase) => {
  // Chladni plate inharmonic ratios: 1, 1.593, 2.135, 2.296, 2.917, 3.598, 4.15
  const inharmonics = [1.0, 1.593, 2.135, 2.756, 3.598, 4.812, 6.24];
  let val = 0;
  for (let i = 0; i < inharmonics.length; i++) {
    const ratio = inharmonics[i];
    const decayWeight = Math.pow(0.75, i * (1.5 - norm));
    val += Math.sin(phase * ratio + norm * 1.5) * decayWeight;
  }
  return val;
});

export const WAVETABLE_DEFINITIONS: Record<WavetableId, WavetableDef> = {
  'analog-warmth': {
    id: 'analog-warmth',
    name: 'Analog Warmth',
    category: 'Analog',
    slices: analogWarmthSlices,
  },
  'spectral-void': {
    id: 'spectral-void',
    name: 'Spectral Void',
    category: 'Drone',
    slices: spectralVoidSlices,
  },
  'celestial-drone': {
    id: 'celestial-drone',
    name: 'Celestial Drone',
    category: 'Ambient',
    slices: celestialDroneSlices,
  },
  'vocal-formants': {
    id: 'vocal-formants',
    name: 'Vocal Formants',
    category: 'Formant',
    slices: vocalFormantSlices,
  },
  'cyber-wavefold': {
    id: 'cyber-wavefold',
    name: 'Cyber Wavefold',
    category: 'Digital',
    slices: cyberWavefoldSlices,
  },
  'metallic-bell': {
    id: 'metallic-bell',
    name: 'Metallic Bell',
    category: 'Inharmonic',
    slices: metallicBellSlices,
  },
};

/**
 * Interpolates between two wavetable slices given a position from 0.0 to 1.0
 */
export function getInterpolatedWave(
  tableId: WavetableId,
  position: number,
  warpMode: WarpMode = 'none',
  warpAmount: number = 0.0,
  phase: number = 0.0
): Float32Array {
  const def = WAVETABLE_DEFINITIONS[tableId] || WAVETABLE_DEFINITIONS['analog-warmth'];
  const clampedPos = Math.max(0, Math.min(1, position));
  const slicePos = clampedPos * (NUM_SLICES - 1);
  const idxA = Math.floor(slicePos);
  const idxB = Math.min(NUM_SLICES - 1, idxA + 1);
  const frac = slicePos - idxA;

  const sliceA = def.slices[idxA];
  const sliceB = def.slices[idxB];
  const out = new Float32Array(TABLE_SIZE);

  for (let i = 0; i < TABLE_SIZE; i++) {
    // Linear morph between slice A and slice B
    let sample = sliceA[i] * (1 - frac) + sliceB[i] * frac;

    // Apply Warp modes
    if (warpAmount > 0.001) {
      const normI = i / TABLE_SIZE; // 0 to 1
      if (warpMode === 'bend') {
        // Bend time warping: compresses phase towards center or edge
        const bentI = Math.pow(normI, Math.pow(2, (warpAmount - 0.5) * 4));
        const sampleIndex = Math.floor(bentI * TABLE_SIZE) % TABLE_SIZE;
        sample = sliceA[sampleIndex] * (1 - frac) + sliceB[sampleIndex] * frac;
      } else if (warpMode === 'pwm') {
        // Asymmetric phase compression
        const pw = 0.5 + (warpAmount - 0.5) * 0.8;
        const warpedNorm = normI < pw ? (normI / pw) * 0.5 : 0.5 + ((normI - pw) / (1 - pw)) * 0.5;
        const sampleIndex = Math.floor(warpedNorm * TABLE_SIZE) % TABLE_SIZE;
        sample = sliceA[sampleIndex] * (1 - frac) + sliceB[sampleIndex] * frac;
      } else if (warpMode === 'wavefold') {
        // Dynamic fold distortion
        const drive = 1 + warpAmount * 5;
        sample = Math.sin(sample * drive);
      } else if (warpMode === 'sync') {
        // Windowed sync multiplier
        const syncFactor = 1 + warpAmount * 3;
        const syncedI = Math.floor((normI * syncFactor) % 1.0 * TABLE_SIZE);
        sample = (sliceA[syncedI] * (1 - frac) + sliceB[syncedI] * frac) * (1 - normI * 0.3);
      } else if (warpMode === 'fm') {
        // Self-phase modulation
        const fmMod = Math.sin(normI * Math.PI * 4) * warpAmount * 0.25;
        let modI = (normI + fmMod + 1.0) % 1.0;
        const sampleIndex = Math.floor(modI * TABLE_SIZE) % TABLE_SIZE;
        sample = sliceA[sampleIndex] * (1 - frac) + sliceB[sampleIndex] * frac;
      }
    }

    out[i] = sample;
  }

  // Apply phase offset to shift the cycle starting point
  const normalizedPhase = ((phase % 1.0) + 1.0) % 1.0;
  if (normalizedPhase > 0.001) {
    const shift = Math.floor(normalizedPhase * TABLE_SIZE);
    if (shift > 0) {
      const rotated = new Float32Array(TABLE_SIZE);
      for (let i = 0; i < TABLE_SIZE; i++) {
        rotated[i] = out[(i + shift) % TABLE_SIZE];
      }
      return rotated;
    }
  }

  return out;
}

/**
 * Converts a 256-sample single-cycle buffer into Web Audio PeriodicWave Fourier coefficients
 */
export function bufferToFourier(buffer: Float32Array, numHarmonics = 64): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(numHarmonics);
  const imag = new Float32Array(numHarmonics);
  const N = buffer.length;

  for (let k = 1; k < numHarmonics; k++) {
    let r = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      r += buffer[n] * Math.cos(angle);
      im += -buffer[n] * Math.sin(angle);
    }
    real[k] = (2 * r) / N;
    imag[k] = (2 * im) / N;
  }

  return { real, imag };
}
