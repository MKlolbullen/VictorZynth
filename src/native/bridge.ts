import { getNativeFunction } from '@juce-framework/webview';

import type { LiveModValues } from '../audio/engine';
import type { ReaperHostState } from '../types/synth';

export interface StudioTelemetry {
  inLevelDb: number;
  outLevelDb: number;
  gainReductionDb: number;
  lufs: number;
  spectrumDb: number[];
}

export interface NativeAISettings {
  useAnthropic: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface NativeGeneratedNote {
  pitch: number;
  startBeats: number;
  lengthBeats: number;
  velocity: number;
}

export interface NativeGeneratedTrack {
  name: string;
  instrument: string;
  gmProgram: number;
  isDrums: boolean;
  notes: NativeGeneratedNote[];
}

export interface NativeMidiGeneratorResult {
  success: boolean;
  message: string;
  tempoBpm: number;
  path: string;
  notes?: NativeGeneratedNote[];
  tracks?: NativeGeneratedTrack[];
}

export interface NativeMidiGeneratorState {
  busy: boolean;
  result: NativeMidiGeneratorResult | null;
}

export interface NativeMidiLibraryItem {
  name: string;
  path: string;
  size: number;
  modifiedMs: number;
}

export const isNativePluginHost = (): boolean =>
  typeof window !== 'undefined' && typeof window.__JUCE__ !== 'undefined';

async function callNative<T>(name: string, ...args: unknown[]): Promise<T | null> {
  if (!isNativePluginHost()) return null;
  const fn = getNativeFunction(name);
  return (await fn(...args)) as T;
}

export async function getNativeParameter(id: string): Promise<number | null> {
  const value = await callNative<unknown>('getParameter', id);
  return typeof value === 'number' ? value : null;
}

export async function getNativeParameterSnapshot(): Promise<Record<string, number> | null> {
  const value = await callNative<Record<string, unknown>>('getParameterSnapshot');
  if (!value || typeof value !== 'object') return null;

  const snapshot: Record<string, number> = {};
  for (const [id, candidate] of Object.entries(value)) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      snapshot[id] = candidate;
    }
  }
  return snapshot;
}

export async function setNativeParameter(id: string, value: number): Promise<boolean> {
  return Boolean(await callNative<boolean>('setParameter', id, value));
}

export async function beginNativeParameterGesture(id: string): Promise<void> {
  await callNative('beginParameterGesture', id);
}

export async function endNativeParameterGesture(id: string): Promise<void> {
  await callNative('endParameterGesture', id);
}

export async function performNativeParameterGesture(
  id: string,
  update: () => Promise<void> | void,
): Promise<void> {
  if (!isNativePluginHost()) {
    await update();
    return;
  }

  await beginNativeParameterGesture(id);
  try {
    await update();
  } finally {
    await endNativeParameterGesture(id);
  }
}

export async function sendNativeNoteOn(note: number, velocity: number): Promise<void> {
  await callNative('noteOn', note, velocity);
}

export async function sendNativeNoteOff(note: number): Promise<void> {
  await callNative('noteOff', note);
}

export async function sendNativeAllNotesOff(): Promise<void> {
  await callNative('allNotesOff');
}

export async function sendNativePitchBend(value: number): Promise<void> {
  await callNative('setPitchBend', value);
}

export async function sendNativeModWheel(value: number): Promise<void> {
  await callNative('setModWheel', value);
}

export async function setNativeModMatrix(json: string): Promise<void> {
  await callNative('setModMatrix', json);
}

export async function setNativeAuxState(json: string): Promise<void> {
  await callNative('setAuxState', json);
}

export async function getNativeTelemetry(): Promise<LiveModValues | null> {
  return await callNative<LiveModValues>('getTelemetry');
}

export async function getNativeStudioTelemetry(): Promise<StudioTelemetry | null> {
  return await callNative<StudioTelemetry>('getStudioTelemetry');
}

export async function getNativeHostInfo(): Promise<Partial<ReaperHostState> | null> {
  return await callNative<Partial<ReaperHostState>>('getHostInfo');
}

export async function getNativeAISettings(): Promise<NativeAISettings | null> {
  return await callNative<NativeAISettings>('getAISettings');
}

export async function setNativeAISettings(settings: NativeAISettings): Promise<void> {
  await callNative('setAISettings', settings);
}

export async function startNativeMidiGeneration(request: NativeAISettings & {
  prompt: string;
  multiTrack: boolean;
}): Promise<boolean> {
  return Boolean(await callNative<boolean>('startMidiGeneration', request));
}

export async function getNativeMidiGeneratorState(): Promise<NativeMidiGeneratorState | null> {
  return await callNative<NativeMidiGeneratorState>('getMidiGeneratorState');
}

export async function listNativeMidiLibrary(): Promise<NativeMidiLibraryItem[]> {
  return (await callNative<NativeMidiLibraryItem[]>('listMidiLibrary')) ?? [];
}

export async function revealNativeMidiLibrary(): Promise<void> {
  await callNative('revealMidiLibrary');
}
