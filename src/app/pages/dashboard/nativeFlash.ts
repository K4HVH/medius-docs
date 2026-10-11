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
  // MAKCU's stock firmware onto one chip: its package and that chip's bootloader.
  flashStock: (port: SerialPort, chip: FlashChip, pkg: Uint8Array, boot: Uint8Array, page: RomFlashMeta['page']) => Promise<boolean>;
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

  // One write over ROM download, with its progress, log and error kept here, and counted.
  const run = async (
    write: (hooks: { onProgress: (p: FlashProgress) => void; onLog: (line: string) => void; onMac: (m: string | null) => void }) => Promise<void>,
    count: ((mac: string | null, ok: boolean, ms: number) => void) | null,
  ): Promise<boolean> => {
    if (running()) return false;
    setError(null);
    setLog([]);
    setProgress({ phase: 'connecting' });
    setRunning(true);
    const started = performance.now();
    let mac: string | null = null;
    let ok = false;
    try {
      await write({ onProgress: (p) => setProgress(p), onLog: (line) => setLog((prev) => [...prev, line].slice(-500)), onMac: (m) => (mac = m) });
      setProgress({ phase: 'done' });
      ok = true;
    } catch (e) {
      setError(flashErrorText(e));
    } finally {
      setRunning(false);
    }
    try {
      count?.(mac, ok, Math.min(3_600_000, Math.max(0, Math.round(performance.now() - started))));
    } catch {
      /* counting must not break a connect or a flash */
    }
    return ok;
  };

  const flashStock = (port: SerialPort, chip: FlashChip, pkg: Uint8Array, boot: Uint8Array, page: RomFlashMeta['page']) =>
    run(
      async (hooks) => {
        const { flashStock: write } = await import('../../../dashboard/flash/flasher');
        await write({ port, chip, pkg, boot, ...hooks });
      },
      report
        ? (mac, ok, ms) =>
            report({
              type: 'flash',
              mac: chip === 'device' ? mac : null,
              page,
              route: 'rom',
              chips: chip,
              source: 'stock',
              kind: 'factory',
              to: { device: null, host: null },
              from: { device: null, host: null },
              result: ok ? 'written' : 'failed',
              ms,
            })
        : null,
    );

  const flash = (port: SerialPort, image: Uint8Array, kind: FlashKind, meta?: RomFlashMeta) =>
    run(
      async (hooks) => {
        const { flashNativePort } = await import('../../../dashboard/flash/flasher');
        await flashNativePort({ port, image, kind, ...hooks });
      },
      meta && report
        ? (mac, ok, ms) => {
            const version = imageVersion(image, kind);
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
              ms,
            });
          }
        : null,
    );

  return { flash, flashStock, progress, log, error, running, clear: () => setProgress(null) };
}
