import { getNativeFunction } from '@juce-framework/webview';

declare global {
  interface Window {
    __JUCE__?: unknown;
  }
}

const nativeGetParameter = getNativeFunction('getParameter');
const nativeSetParameter = getNativeFunction('setParameter');
const nativeBeginGesture = getNativeFunction('beginParameterGesture');
const nativeEndGesture = getNativeFunction('endParameterGesture');

export const isNativePluginHost = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.__JUCE__);

export async function getNativeParameter(id: string): Promise<number | null> {
  if (!isNativePluginHost()) return null;
  const value = await nativeGetParameter(id);
  return typeof value === 'number' ? value : null;
}

export async function setNativeParameter(id: string, value: number): Promise<boolean> {
  if (!isNativePluginHost()) return false;
  return Boolean(await nativeSetParameter(id, value));
}

export async function beginNativeParameterGesture(id: string): Promise<void> {
  if (!isNativePluginHost()) return;
  await nativeBeginGesture(id);
}

export async function endNativeParameterGesture(id: string): Promise<void> {
  if (!isNativePluginHost()) return;
  await nativeEndGesture(id);
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
