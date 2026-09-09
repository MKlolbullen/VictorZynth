import assert from 'node:assert/strict';
import { test } from 'node:test';

// Loading the actual JUCE package creates its ordinary-browser mock.
Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
const { isNativePluginHost, getNativeParameterSnapshot } = await import('../src/native/bridge');

test('JUCE browser mock is not mistaken for an AetherWave native host', async () => {
  assert.ok(window.__JUCE__);
  assert.equal(isNativePluginHost(), false);
  assert.equal(await getNativeParameterSnapshot(), null);
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
