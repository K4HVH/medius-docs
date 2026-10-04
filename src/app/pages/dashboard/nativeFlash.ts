/// <reference types="w3c-web-serial" />
import { type Accessor, createSignal } from 'solid-js';
import type { FlashKind, FlashProgress } from '../../../dashboard/flash';
import { flashErrorText } from './session';

export interface NativeFlash {
  flash: (port: SerialPort, image: Uint8Array, kind: FlashKind) => Promise<boolean>;
  progress: Accessor<FlashProgress | null>;
  log: Accessor<string[]>;
  error: Accessor<string | null>;
  running: Accessor<boolean>;
  clear: () => void;
}

export function createNativeFlash(): NativeFlash {
  const [progress, setProgress] = createSignal<FlashProgress | null>(null);
  const [log, setLog] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [running, setRunning] = createSignal(false);

  const flash = async (port: SerialPort, image: Uint8Array, kind: FlashKind): Promise<boolean> => {
    if (running()) return false;
    setError(null);
    setLog([]);
    setProgress({ phase: 'connecting' });
    setRunning(true);
    try {
      const { flashNativePort } = await import('../../../dashboard/flash/flasher');
      await flashNativePort({
        port,
        image,
        kind,
        onProgress: (p) => setProgress(p),
        onLog: (line) => setLog((prev) => [...prev, line].slice(-500)),
      });
      setProgress({ phase: 'done' });
      return true;
    } catch (e) {
      setError(flashErrorText(e));
      return false;
    } finally {
      setRunning(false);
    }
  };

  return { flash, progress, log, error, running, clear: () => setProgress(null) };
}
