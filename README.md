# AetherWave VSTi — Modular Wavetable Synthesizer

> A modular wavetable synthesizer and ambient soundscape engine with real-time audio visualization, dynamic 8-slot modulation matrix, and native REAPER DAW integration.

---

## Overview

**AetherWave VSTi** is an interactive, browser-native wavetable synthesizer designed for ambient sound design, cinematic soundscapes, and digital audio workstation (DAW) workflows. Built with modern Web Audio DSP, Web MIDI API, and React/TypeScript, it offers high-precision sound generation alongside visual diagnostics and export utilities for Cockos REAPER.

---

## Key Features

### Dual Wavetable Oscillators
- **64-Frame Morphing Tables**: Multiple hand-crafted wavetables (Basic Shapes, Analog Warmth, Harmonic Spectrum, Spectral Bell, Vocal Formants, Metallic Dirt, Digilog Crunch, Cyber Drone, etc.).
- **Tactile Morph Scrubbers**: Spring-animated position sliders with frame-accurate morphing.
- **Warp Processors**: Multiple warp modes including Bend, Sync, PWM, Mirror, and Drive.
- **Unison & Stereo Spread**: Up to 8 unison voices with adjustable detune and stereo spread.
- **Phase Offset Dials**: Continuous starting phase angle ($0^\circ–360^\circ$) with tactile quadrant snap indicators ($0^\circ, 90^\circ, 180^\circ, 270^\circ$).

### Sub-Oscillator & Noise Generator
- Dedicated sub-oscillator with sine, triangle, and square waveforms, octave transposition (-1 or -2 octaves), and independent volume control.
- Multi-flavor noise generator supporting white, pink, and cosmic noise.

### Multi-Mode Analog-Style Filter
- Selectable filter topologies: 24 dB/oct Lowpass, 12 dB/oct Lowpass, Bandpass, Highpass, Comb, and Notch.
- Real-time frequency response visualization canvas.
- Dual control surface: continuous rotary resonance/cutoff knobs plus a logarithmic tactile cutoff slider ($20\text{ Hz}–20\text{ kHz}$).
- Nonlinear saturation drive and keyboard pitch tracking.

### Dynamic 8-Slot Modulation Matrix
- Flexible source-to-destination routing:
  - **Sources**: LFO 1, LFO 2, Envelope 1 (Amp), Envelope 2 (Filter/Mod), Mod Wheel (CC #1), Key Tracking, Note Velocity, and Macros 1–4.
  - **Destinations**: Pitch, Wavetable Position, Warp Amount, Filter Cutoff, Resonance, Drive, Volume, Stereo Pan, LFO Rates, and FX Mixes.
- Bipolar and unipolar modulation depth scaling with live visual modulation indicators.

### Low-Frequency Oscillators & Envelopes
- Dual tempo-syncable LFOs with sine, triangle, saw, square, and sample & hold waveforms.
- Dual high-precision ADSR envelopes with interactive curve manipulation.

### Studio Effects Chain
- **Stereo Chorus / Flanger**: Dimensional spatial thickening.
- **Ping-Pong Delay**: Tempo-synchronized stereo echo with feedback damping.
- **Lush Algorithmic Reverb**: High-density room and hall diffusion with dampening control.
- **Soft-Clipping Drive**: Analog-style harmonic warm saturation.

### Real-Time Visualizer Engine
- **Oscilloscope Mode**: Real-time waveform tracing with phase-locked zero-crossing detection.
- **Spectrum Mode**: High-resolution FFT frequency spectrum.
- **Spectral Overlay Mode**: Simultaneous dual-channel display of both time-domain waveform and frequency-domain FFT.
- **Phase Mode**: Lissajous stereo field vectorscope for monitoring phase coherence.
- **Mod Flow Mode**: Live telemetry view of active modulation signals.

### REAPER DAW Integration & Export Hub
- **Native REAPER JSFX Script Export**: Complete, drop-in Jesusonic DSP script ready to copy directly into REAPER's `Effects/` directory for zero-latency internal playback.
- **Searchable MIDI Map & CC Cheat Sheet**: Filterable table of all standardized MIDI CC mappings (CC #1 through #119) with active matrix status tags and REAPER parameter learn names.
- **Preset Management**: In-browser local storage preset banks, factory preset library, and `.aetherpreset` JSON import/export.
- **Hardware Web MIDI**: Direct plug-and-play support for external USB/MIDI keyboard controllers.

---

## Frequently Asked Questions

### Do we need to use JUCE 9?

**No, absolutely not.**

1. **JUCE 9 does not exist**: The PACE Anti-Piracy / JUCE development team's current major production release is **JUCE 8** (released in 2024). There is no released or active "JUCE 9" platform.
2. **AetherWave does not require JUCE to run**:
   - The application is a self-contained Web Audio and Web MIDI synthesizer running in standard web environments.
   - For REAPER users, AetherWave exports a **100% native REAPER JSFX script** that compiles directly inside REAPER's built-in Jesusonic audio engine—no C++ compilation, external libraries, or JUCE needed.
3. **Packaging as a native VST3/AU/CLAP plugin**:
   - If you choose to compile AetherWave into a native desktop plugin binary (`.vst3`, `.clap`, or `.component`), you would use **JUCE 8** (specifically JUCE 8's Web View integration via `juce_gui_extra`), or an embedded WebView framework (such as Tauri, Electron, or C++ WebView). You do not need JUCE 9.

---

## Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/aetherwave-vsti.git
cd aetherwave-vsti

# Install dependencies
npm install
```

### Development Server

Start the local development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Production Build

Compile the application for production:

```bash
npm run build
```

The optimized static assets will be output to the `dist/` directory.

### Code Linting

Run TypeScript type-checking:

```bash
npm run lint
```

---

## Using AetherWave with REAPER DAW

### Method 1: Native REAPER JSFX Plugin (Recommended)
1. In AetherWave, open the **REAPER Integration & Export** modal.
2. Select the **Native REAPER JSFX Script** tab and click **Copy JSFX**.
3. In REAPER, navigate to **Options** &rarr; **Show REAPER resource path in explorer/finder**.
4. Open the `Effects` folder and create a new file named `AetherWave` (without extension).
5. Paste the copied code into this file and save.
6. In REAPER, add a new track, click **FX**, and search for `AetherWave` to load the instrument natively.

### Method 2: Live Web Instrument with Web MIDI
1. Connect your USB MIDI keyboard to your computer.
2. Open AetherWave in any Chromium-based browser (Chrome, Edge, Brave, Opera) supporting Web MIDI.
3. Click **Enable Audio** on the top navigation bar.
4. Select your connected keyboard from the MIDI input dropdown or play via the on-screen keyboard.

### Method 3: MIDI CC Automation & Hardware Mapping
1. Open the **MIDI Map** tab in the export modal to see all assigned CC channels (e.g., CC #74 for Filter Cutoff, CC #20 for Macro 1).
2. In REAPER, open the FX window and select **Param** &rarr; **FX parameter list** &rarr; **Parameter modulation/MIDI link** to bind any parameter to track automation lanes or external hardware sliders.

---

## Project Structure

```
├── public/                 # Static assets and icons
├── src/
│   ├── components/         # Modular React UI components
│   │   ├── OscillatorSection.tsx   # Wavetable oscillators & scrubbers
│   │   ├── FilterSection.tsx       # Multi-mode filter & cutoff slider
│   │   ├── ModMatrixSection.tsx    # 8-slot modulation routing matrix
│   │   ├── VisualizerSection.tsx   # Oscilloscope, spectrum & vectorscope
│   │   ├── ReaperExportModal.tsx   # JSFX export, MIDI map & preset hub
│   │   ├── WavetableVisualizer.tsx # 2D/3D wavetable ribbon visualizer
│   │   ├── PhaseOffsetDial.tsx     # Tactile phase angle dial
│   │   ├── Knob.tsx                # Spring-physics rotary control
│   │   └── ...
│   ├── audio/              # Web Audio API synthesis engine & DSP nodes
│   ├── types/              # TypeScript definitions & sound design schemas
│   ├── index.css           # Tailwind CSS directives & spring animation classes
│   ├── App.tsx             # Main synthesizer interface
│   └── main.tsx            # Application entry point
├── package.json            # Project dependencies and npm scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
└── README.md               # Documentation and usage guide
```

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
