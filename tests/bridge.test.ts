import assert from 'node:assert/strict';
import { test } from 'node:test';

// Loading the actual JUCE package creates its ordinary-browser mock.
Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
const { isNativePluginHost, getNativeParameterSnapshot } = await import('../src/native/bridge');
const { applyNativeParameters, flattenState, SynthAudioEngine } = await import('../src/audio/runtime');
const { INITIAL_SYNTH_STATE } = await import('../src/audio/presets');

test('JUCE browser mock is not mistaken for an AetherWave native host', async () => {
  assert.ok(window.__JUCE__);
  assert.equal(isNativePluginHost(), false);
  assert.equal(await getNativeParameterSnapshot(), null);
});

test('all mapped parameters round-trip from host state without changing the template', () => {
  const state = structuredClone(INITIAL_SYNTH_STATE);
  state.osc1.tableId = 'metallic-bell';
  state.polyphony = 'legato';
  state.effects.master.volume = 0.23;
  state.effects.master.limiter = false;
  state.macros[2] = 0.77;
  state.lfo1.syncDivision = '1/8';
  const restored = applyNativeParameters(INITIAL_SYNTH_STATE, flattenState(state));
  assert.deepEqual(flattenState(restored), flattenState(state));
  assert.notEqual(INITIAL_SYNTH_STATE.effects.master.volume, 0.23);
});

test('opening an editor or changing one knob never writes default auxiliary patch state', () => {
  const original = window.__JUCE__.initialisationData.__juce__functions;
  const postMessage = window.__JUCE__.postMessage;
  const called: string[] = [];
  window.__JUCE__.initialisationData.__juce__functions = [
    'getParameterSnapshot', 'setParameter', 'noteOn', 'getTelemetry',
    'getHostInfo', 'getAuxiliaryState', 'setAuxState', 'setModMatrix', 'allNotesOff',
  ];
  window.__JUCE__.postMessage = (message: string) => { called.push(JSON.parse(message).payload.name); };
  const engine = new SynthAudioEngine(INITIAL_SYNTH_STATE);
  try {
    engine.updateState({ osc1: { ...INITIAL_SYNTH_STATE.osc1, level: 0.42 } });
    assert.ok(called.includes('setParameter'));
    assert.equal(called.includes('setAuxState'), false);
    assert.equal(called.includes('setModMatrix'), false);
  } finally {
    engine.dispose();
    window.__JUCE__.initialisationData.__juce__functions = original;
    window.__JUCE__.postMessage = postMessage;
  }
});

test('registered AetherWave functions identify the native host', () => {
  const functions = window.__JUCE__.initialisationData.__juce__functions;
  window.__JUCE__.initialisationData.__juce__functions = ['getParameterSnapshot', 'setParameter', 'noteOn'];
  try {
    assert.equal(isNativePluginHost(), true);
  } finally {
    window.__JUCE__.initialisationData.__juce__functions = functions;
  }
});
