/// <reference types="w3c-web-serial" />
import { type Accessor, createSignal } from 'solid-js';
import { CHIP_NAME, type FlashChip, type FlashKind, type FlashProgress, NotTheBox, WrongChipError, imageVersion } from '../../../dashboard/flash';
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
  flashStock: (
    port: SerialPort,
    chip: FlashChip,
    pkg: Uint8Array,
    boot: Uint8Array,
    page: RomFlashMeta['page'],
    opts?: { anyway?: boolean; knownMain?: (mac: string) => boolean },
  ) => Promise<boolean>;
  // The chip the last stock flash found plugged in, when it wasn't the one picked.
  wrongChip: Accessor<{ found: FlashChip; sure: boolean } | null>;
  progress: Accessor<FlashProgress | null>;
  error: Accessor<string | null>;
  running: Accessor<boolean>;
  clear: () => void;
}

// The flasher's code loads on first use. If its chunk won't load (a deploy since the page opened), nothing
// reached a chip.
class FlasherNotLoaded extends Error {
  constructor() {
    super("The flasher didn't load. Reload the page, then try again.");
  }
}
const flasher = () =>
  import('../../../dashboard/flash/flasher').catch(() => {
    throw new FlasherNotLoaded();
  });

export function createNativeFlash(report?: StatsSink): NativeFlash {
  const [progress, setProgress] = createSignal<FlashProgress | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [running, setRunning] = createSignal(false);
  const [wrongChip, setWrongChip] = createSignal<{ found: FlashChip; sure: boolean } | null>(null);

  // One write over ROM download, counted, with its progress and error kept here. A failure after the erase or
  // the write began leaves the chip with no firmware that starts, until either firmware is flashed.
  const run = async (
    chip: FlashChip | null,
    write: (hooks: { onProgress: (p: FlashProgress) => void; onMac: (m: string | null) => void }) => Promise<void>,
    count: ((mac: string | null, ok: boolean, ms: number) => void) | null,
  ): Promise<boolean> => {
    if (running()) return false;
    setError(null);
    setWrongChip(null);
    setProgress({ phase: 'connecting' });
    setRunning(true);
    const started = performance.now();
    let mac: string | null = null;
    let ok = false;
    // A chip refused before anything was written is no flash to count.
    let refused = false;
    try {
      await write({ onProgress: (p) => setProgress(p), onMac: (m) => (mac = m) });
      setProgress({ phase: 'done' });
      ok = true;
    } catch (e) {
      const touched = ['erasing', 'writing'].includes(progress()?.phase ?? '');
      setError(
        e instanceof WrongChipError || e instanceof NotTheBox || e instanceof FlasherNotLoaded
          ? e.message
          : [
              flashErrorText(e),
              touched ? `The ${chip ? CHIP_NAME[chip] : 'chip'} may not start until it's flashed again.` : '',
              'Replug it with the button held, then try again.',
            ]
              .filter(Boolean)
              .join(' '),
      );
      if (e instanceof WrongChipError) {
        refused = true;
        setWrongChip({ found: e.found, sure: e.sure });
      }
    } finally {
      setRunning(false);
    }
    if (refused) return false;
    try {
      count?.(mac, ok, Math.min(3_600_000, Math.max(0, Math.round(performance.now() - started))));
    } catch {
      /* counting must not break a connect or a flash */
    }
    return ok;
  };

  const flashStock = (
    port: SerialPort,
    chip: FlashChip,
    pkg: Uint8Array,
    boot: Uint8Array,
    page: RomFlashMeta['page'],
    opts: { anyway?: boolean; knownMain?: (mac: string) => boolean } = {},
  ) =>
    run(
      chip,
      async (hooks) => {
        const { flashStock: write } = await flasher();
        await write({ port, chip, pkg, boot, ...opts, ...hooks });
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
      meta?.chip ?? null,
      async (hooks) => {
        const { flashNativePort } = await flasher();
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

  return { flash, flashStock, wrongChip, progress, error, running, clear: () => setProgress(null) };
}
