import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {getNativeParameterSnapshot, isNativePluginHost} from './native/bridge';

function NativeUiHandshake() {
  useEffect(() => {
    if (!isNativePluginHost()) return;
    void getNativeParameterSnapshot().then(snapshot => {
      if (snapshot && Object.keys(snapshot).length > 0) {
        (window as Window & {__AETHERWAVE_NATIVE_READY__?: boolean}).__AETHERWAVE_NATIVE_READY__ = true;
      }
    });
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NativeUiHandshake />
    <App />
  </StrictMode>,
);
