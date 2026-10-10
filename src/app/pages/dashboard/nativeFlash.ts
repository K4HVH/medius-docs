/// <reference types="w3c-web-serial" />
import { type Accessor, createSignal } from 'solid-js';
import { type FlashChip, type FlashKind, type FlashProgress, imageVersion } from '../../../dashboard/flash';
import type { FlashPage, FlashSource, StatsSink } from '../../../dashboard/stats';
import { flashErrorText } from './flashText';

export interface RomFlashMeta {
  page: Exclude<FlashPage, 'update'>;
  chip: FlashChip;
  source: FlashSource;
}

export interface NativeFlash {
  flash: (port: SerialPort, image: Uint8Array, kind: FlashKind, meta?: RomFlashMeta) => Promise<boolean>;
  progress: Accessor<FlashProgress | null>;
  log: Accessor<string[]>;
  error: Accessor<string | null>;
  running: Accessor<boolean>;
  clear: () => void;
}

export function createNativeFlash(report?: StatsSink): NativeFlash {
  const [progress, setProgress] = createSignal<FlashProgress | null>(null);
  const [log, setLog] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [running, setRunning] = createSignal(false);

  const flash = async (port: SerialPort, image: Uint8Array, kind: FlashKind, meta?: RomFlashMeta): Promise<boolean> => {
    if (running()) return false;
    setError(null);
    setLog([]);
    setProgress({ phase: 'connecting' });
    setRunning(true);
    const started = performance.now();
    let mac: string | null = null;
    let ok = false;
    try {
      const { flashNativePort } = await import('../../../dashboard/flash/flasher');
      await flashNativePort({
        port,
        image,
        kind,
        onProgress: (p) => setProgress(p),
        onLog: (line) => setLog((prev) => [...prev, line].slice(-500)),
        onMac: (m) => (mac = m),
      });
      setProgress({ phase: 'done' });
      ok = true;
    } catch (e) {
      setError(flashErrorText(e));
    } finally {
      setRunning(false);
    }
    if (meta && report) {
      const version = imageVersion(image, kind);
      try {
        // A box is known by its main chip's MAC.
        report({
          type: 'flash',
          mac: meta.chip === 'device' ? mac : null,
          page: meta.page,
          route: 'rom',
          chips: meta.chip,
          source: meta.source,
          kind,
          to: { device: meta.chip === 'device' ? version : null, host: meta.chip === 'host' ? version : null },
          from: { device: null, host: null },
          result: ok ? 'written' : 'failed',
          ms: Math.min(3_600_000, Math.max(0, Math.round(performance.now() - started))),
        });
      } catch {
        /* counting must not break a connect or a flash */
      }
    }
    return ok;
  };

  return { flash, progress, log, error, running, clear: () => setProgress(null) };
}
