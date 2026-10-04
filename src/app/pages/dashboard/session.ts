/// <reference types="w3c-web-serial" />
// One box: its link, keepalive, log, catch stream and update, in a reactive root of its own.

import { type Accessor, createEffect, createRoot, createSignal } from 'solid-js';
import {
  type CatchEvent,
  type ChipFirmware,
  type FirmwareInfo,
  type Health,
  type LogLine,
  type Version,
  ImageState,
  LedMode,
  LedTarget,
  LogLevel,
  OTA_TGT_DEVICE,
  OTA_TGT_HOST,
  macHex,
} from '../../../dashboard/protocol';
import {
  CONFIRM_TIMEOUT_MS,
  type ConnectVerdict,
  type Probe,
  SerialLink,
  type SerialLinkEvents,
  BadProtoVerError,
  attachLink,
  bauds,
  classifyConnectError,
  probeFromError,
  probeVerdict,
  speaksCurrentWire,
} from '../../../dashboard/serial';
import type { FlashProgress } from '../../../dashboard/flash';
import { type Poller, createPoller } from './poll';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'lost' | 'flashing' | 'error';

// A CATCH event and its box sequence, shared across all three frame types, so any gap is a drop.
export interface InputEventEntry {
  seq: number;
  ev: CatchEvent;
}

export interface UpdateRun {
  device: boolean;
  host: boolean;
  outcome: 'running' | 'verified' | 'sent' | 'failed';
}

export interface BoxSession {
  supported: boolean;
  secure: boolean;
  status: Accessor<ConnectionStatus>;
  version: Accessor<Version | null>;
  // A box on an older protocol connects only to be updated.
  updateOnly: Accessor<boolean>;
  health: Accessor<Health | null>;
  error: Accessor<string | null>;
  // Why the last connect failed; null before any attempt and after a success.
  verdict: Accessor<ConnectVerdict | null>;
  link: Accessor<SerialLink | null>;
  name: Accessor<string | null>;
  // The box's port is plugged in.
  present: Accessor<boolean>;
  // Connected and not disconnected since, so it reconnects whenever it is found.
  held: Accessor<boolean>;
  // What the port answered the last time this page opened it.
  probe: Accessor<Probe | null>;
  // `force` asks for another port instead of this one.
  connect: (force?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  identify: () => Promise<void>;
  identifying: Accessor<boolean>;
  // Subscribe a card to a readback while mounted; cards share one query per value.
  poll: Poller['subscribe'];
  // True when a readback's layout doesn't decode.
  pollUnreadable: Poller['unreadable'];
  // Re-read now; call after a write.
  refreshPoll: Poller['refresh'];
  updateProgress: Accessor<FlashProgress | null>;
  update: Accessor<UpdateRun | null>;
  clearUpdate: () => void;
  firmwareInfo: Accessor<FirmwareInfo | null>;
  readFirmwareInfo: () => Promise<FirmwareInfo | null>;
  // 'verified' only when the box came back and replied; 'sent' means transfer and activate succeeded
  // but nothing confirmed the running version.
  updateOverControl: (images: { device?: Uint8Array; host?: Uint8Array }) => Promise<'verified' | 'sent' | 'failed'>;
  deviceLog: Accessor<string[]>;
  clearDeviceLog: () => void;
  inputEvents: Accessor<InputEventEntry[]>;
  clearInputEvents: () => void;
  // A raw catch-stream tap for a consumer keeping its own buffer; returns an unsubscribe.
  subscribeEvents: (fn: (ev: CatchEvent, seq: number) => void) => () => void;
}

export interface SessionHooks {
  supported: boolean;
  secure: boolean;
  nativeFlashing: Accessor<boolean>;
  makeLink?: (port: SerialPort, events: SerialLinkEvents) => SerialLink;
  // Opens the chooser for a session with no port, or a forced connect; null once a port is picked.
  acquire?: () => Promise<ConnectVerdict | null>;
  // Runs `fn` alone on `port`: nothing else in this page opens it meanwhile.
  exclusive?: <T>(port: SerialPort, fn: () => Promise<T>) => Promise<T>;
  // Claims a box for this tab; null while another tab holds it. Call the result to let go.
  claim?: (mac: string) => Promise<(() => void) | null>;
  // What a port answered; false when the box on it belongs to another entry.
  seen?: (port: SerialPort, probe: Probe) => boolean;
  held?: (mac: string, name: string) => void;
  released?: (mac: string) => void;
}

export interface SessionControl {
  port: Accessor<SerialPort | null>;
  mac: Accessor<string | null>;
  setPort: (port: SerialPort | null) => void;
  setProbe: (probe: Probe | null) => void;
  // Connected on return; throws what the attach threw.
  attach: () => Promise<Version>;
  // Settles when a connect in flight ends.
  settled: () => Promise<void>;
  dispose: () => void;
}

export const LOST_AFTER_MISSES = 3;
export const REATTACH_MS = 1000;
export const IDENTIFY_MS = 3000;
const IDENTIFY_KEEPALIVE_MS = 400;

function formatLogLine(line: LogLine): string {
  return `[${LogLevel[line.level]}] ${line.text}`;
}

// Flash and update failures only: a failed CONNECT is a verdict, not a string.
export function flashErrorText(e: unknown): string {
  if (e instanceof Error) {
    // Web Serial's wording says nothing about what to do.
    if (/already open/i.test(e.message)) {
      return 'That port is still held by an earlier session. Reload the page, or replug the control cable.';
    }
    if (/[Ff]ailed to open|Access denied|NetworkError/.test(e.message)) {
      return 'Could not open that port. Close anything else using it, then replug the control cable.';
    }
    return e.message;
  }
  return String(e);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 'host': the main chip came back and decided, and the mouse-side chip never did.
type Verdict = 'ok' | 'gone' | 'host';

// An image marked invalid is about to reboot into the other one, so it is no verdict either.
const decided = (c: ChipFirmware) =>
  c.state !== ImageState.PendingVerify && c.state !== ImageState.Invalid && c.state !== ImageState.Aborted;

// A connect given up because Disconnect came first, or because another box answered on the port.
class AttachCancelled extends Error {}
class ForeignBoxError extends Error {
  constructor() {
    super('Another box answered on this port.');
  }
}

const versionOf = (p: Probe | null): Version | null => (p && 'version' in p ? p.version : null);

// The MAC hex a box is known by, or null for a reply that carries none.
export const boxId = (v: Version | null): string | null =>
  v && v.mac.length === 6 && v.mac.some((b) => b !== 0) ? macHex(v) : null;

export function createBoxSession(
  init: { port: SerialPort | null; probe?: Probe | null },
  hooks: SessionHooks,
): { api: BoxSession; ctl: SessionControl } {
  return createRoot((disposeRoot) => {
    const build = hooks.makeLink ?? ((p: SerialPort, ev: SerialLinkEvents) => new SerialLink(p, ev));
    const [status, setStatus] = createSignal<ConnectionStatus>('disconnected');
    const [version, setVersion] = createSignal<Version | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [verdict, setVerdict] = createSignal<ConnectVerdict | null>(null);
    const [link, setLink] = createSignal<SerialLink | null>(null);
    const [port, setPortSig] = createSignal<SerialPort | null>(init.port);
    const [probe, setProbe] = createSignal<Probe | null>(init.probe ?? null);
    const [mac, setMac] = createSignal<string | null>(boxId(versionOf(init.probe ?? null)));
    const [held, setHeld] = createSignal(false);
    const [identifying, setIdentifying] = createSignal(false);
    const [updateProgress, setUpdateProgress] = createSignal<FlashProgress | null>(null);
    const [update, setUpdate] = createSignal<UpdateRun | null>(null);
    const [firmwareInfo, setFirmwareInfo] = createSignal<FirmwareInfo | null>(null);
    const [deviceLog, setDeviceLog] = createSignal<string[]>([]);
    const [inputEvents, setInputEvents] = createSignal<InputEventEntry[]>([]);
    const [seenName, setSeenName] = createSignal<string | null>(versionOf(init.probe ?? null)?.name ?? null);
    const eventTaps = new Set<(ev: CatchEvent, seq: number) => void>();

    // An update waiting for its verdict reattaches on its own, and owns the status until it ends.
    let updating = false;
    let disposed = false;
    let lastBaud = init.probe?.kind === 'box' ? init.probe.baud : undefined;
    // Bumped to strand a reattach loop.
    let lostGen = 0;
    let misses = 0;
    let mark = 0;
    let identifyRun: Promise<void> | null = null;
    let attachRun: Promise<unknown> | null = null;
    let releaseClaim: (() => void) | null = null;
    const exclusive = <T,>(p: SerialPort, fn: () => Promise<T>) => (hooks.exclusive ? hooks.exclusive(p, fn) : fn());
    const letGo = () => {
      releaseClaim?.();
      releaseClaim = null;
    };

    const onKeepalive = (answered: boolean) => {
      if (answered) {
        misses = 0;
        return;
      }
      const l = link();
      if (!l || updating || status() !== 'connected') return;
      // Any frame since the first miss means the box is there and only lost a reply.
      if (misses === 0 || l.lastRxAt !== mark) {
        misses = 1;
        mark = l.lastRxAt;
        return;
      }
      if (++misses >= LOST_AFTER_MISSES) {
        misses = 0;
        void goLost();
      }
    };

    // Fed a derived link so an update, or a chip flashed over its own USB, silences every readback.
    const poller = createPoller(() => (status() === 'flashing' || hooks.nativeFlashing() ? null : link()), {
      onKeepalive,
    });
    // The poller already polls health as the keepalive; this only reads it.
    const health = poller.subscribe('health');
    const polledVersion = poller.peek('version');

    createEffect(() => {
      const n = polledVersion()?.name ?? version()?.name ?? versionOf(probe())?.name;
      if (n) setSeenName(n);
    });
    createEffect(() => {
      const m = mac();
      const n = seenName();
      if (held() && m && n) hooks.held?.(m, n);
    });

    const resetView = () => {
      setVersion(null);
      setFirmwareInfo(null);
      setLink(null);
      poller.reset();
    };

    const makeLink = (p: SerialPort): SerialLink => {
      const nl: SerialLink = build(p, {
        onLog: (ln) => setDeviceLog((prev) => [...prev, formatLogLine(ln)].slice(-500)),
        onEvent: (ev, seq) => {
          setInputEvents((prev) => [...prev, { seq, ev }].slice(-200));
          eventTaps.forEach((fn) => fn(ev, seq));
        },
        onClose: () => {
          // Only the stored link: another may already own this port.
          if (link() !== nl) return;
          if (!updating && held() && status() === 'connected') {
            void goLost();
            return;
          }
          if (!updating) {
            setStatus('disconnected');
            setVersion(null);
            setFirmwareInfo(null);
            setError(null);
          }
          setLink(null);
          poller.reset();
          // The port is still open with its writer locked; otherwise the next connect can't get a writer.
          void nl.close().catch(() => undefined);
        },
      });
      return nl;
    };

    // The box on a port is ours only if its MAC is the one this session knows, and the registry
    // agrees; a different box keeps the port and this session lets it go.
    const claim = (p: SerialPort, pr: Probe & { version: Version }): boolean => {
      const known = mac();
      const id = boxId(pr.version);
      const accepted = hooks.seen?.(p, pr) ?? true;
      if (known !== null && id !== null && known !== id) {
        if (port() === p) setPortSig(null);
        return false;
      }
      return accepted;
    };

    const goLost = async () => {
      const l = link();
      setStatus('lost');
      setLink(null);
      setFirmwareInfo(null);
      poller.reset();
      await l?.close().catch(() => undefined);
      void reattach(++lostGen);
    };

    const reattach = async (gen: number) => {
      for (;;) {
        await sleep(REATTACH_MS);
        if (disposed || gen !== lostGen || status() !== 'lost') return;
        const p = port();
        // Nothing writes to a box whose chip may be in ROM download.
        if (!p || hooks.nativeFlashing()) continue;
        try {
          const found = await exclusive(p, async () => {
            const { link: nl, version: v, baud } = await attachLink(p, makeLink, bauds(lastBaud));
            if (disposed || gen !== lostGen || status() !== 'lost' || !claim(p, { kind: 'box', version: v, device: null, baud })) {
              await nl.close().catch(() => undefined);
              return null;
            }
            return { nl, v, baud };
          });
          if (!found) {
            if (disposed || gen !== lostGen || status() !== 'lost') return;
            continue;
          }
          lastBaud = found.baud;
          setVersion(found.v);
          setLink(found.nl);
          poller.reset();
          setStatus('connected');
          return;
        } catch (e) {
          // A box back on a protocol this page can't speak won't answer differently next time.
          if (e instanceof BadProtoVerError) {
            setProbe(probeFromError(e));
            setVerdict(classifyConnectError(e));
            setStatus('disconnected');
            return;
          }
        }
      }
    };

    const attach = async (): Promise<Version> => {
      const p = port();
      if (!p) throw new DOMException('No port selected.', 'NotFoundError');
      ++lostGen;
      setError(null);
      setVerdict(null);
      setUpdateProgress(null);
      setStatus('connecting');
      const run = (async () => {
        if (identifyRun) await identifyRun;
        // A failed update's link still holds the writer lock, and a second link over it throws
        // unrecoverably.
        const stale = link();
        if (stale) {
          resetView();
          await stale.close().catch(() => undefined);
        }
        setDeviceLog([]);
        setInputEvents([]);
        try {
          const { nl, v, baud } = await exclusive(p, async () => {
            const a = await attachLink(p, makeLink, bauds(lastBaud));
            return { nl: a.link, v: a.version, baud: a.baud };
          });
          const prev = probe();
          const found: Probe = { kind: 'box', version: v, device: prev?.kind === 'box' ? prev.device : null, baud };
          if (disposed || status() !== 'connecting') {
            await nl.close().catch(() => undefined);
            throw new AttachCancelled();
          }
          if (!claim(p, found)) {
            await nl.close().catch(() => undefined);
            throw new ForeignBoxError();
          }
          const id = boxId(v);
          if (id && !releaseClaim && hooks.claim) {
            releaseClaim = await hooks.claim(id);
            if (!releaseClaim) {
              await nl.close().catch(() => undefined);
              throw new DOMException('Another tab has this box open.', 'InvalidStateError');
            }
          }
          lastBaud = baud;
          setMac(id ?? mac());
          setProbe(found);
          setVersion(v);
          setLink(nl);
          // Reset before the cards mount, so each slot is queried once.
          poller.reset();
          setStatus('connected');
          setHeld(true);
          return v;
        } catch (e) {
          if (!(e instanceof AttachCancelled) && !(e instanceof ForeignBoxError)) {
            const found = probeFromError(e);
            setProbe(found);
            if ('version' in found) hooks.seen?.(p, found);
          }
          if (status() === 'connecting') setStatus('disconnected');
          throw e;
        }
      })();
      attachRun = run;
      try {
        return await run;
      } finally {
        if (attachRun === run) attachRun = null;
      }
    };

    const connect = async (force = false) => {
      const s = status();
      if (s === 'connecting' || s === 'connected' || s === 'flashing' || s === 'lost') return;
      if (hooks.nativeFlashing()) return;
      if (force || !port()) {
        if (!hooks.acquire) return;
        const blank = !port();
        if (blank) {
          setError(null);
          setVerdict(null);
          setStatus('connecting');
        }
        let v: ConnectVerdict | null;
        try {
          v = await hooks.acquire();
        } catch (e) {
          // Nothing may escape, or the page sticks on "Connecting..." until a reload.
          v = classifyConnectError(e);
        }
        if (blank) {
          if (status() === 'connecting') setStatus('disconnected');
          setVerdict(v);
        } else if (v && v.kind !== 'no-port') {
          // A chooser closed without a pick says nothing new about this box.
          setVerdict(v);
        }
        return;
      }
      try {
        await attach();
      } catch (e) {
        if (!(e instanceof AttachCancelled)) setVerdict(classifyConnectError(e));
      }
    };

    const disconnect = async () => {
      ++lostGen;
      const l = link();
      const m = mac();
      // Status first: the cards unmount on it and release their holds over the still-open link.
      setStatus('disconnected');
      resetView();
      setError(null);
      setVerdict(null);
      setUpdateProgress(null);
      setUpdate(null);
      setHeld(false);
      letGo();
      if (m) hooks.released?.(m);
      if (l) await l.close().catch(() => undefined);
    };

    const identify = (): Promise<void> => {
      if (identifyRun) return identifyRun;
      if (hooks.nativeFlashing()) return Promise.resolve();
      const p = port();
      const l = link();
      const heldLink = status() === 'connected' ? l : null;
      if (!heldLink && (held() || !p || status() !== 'disconnected' || probe()?.kind !== 'box')) return Promise.resolve();
      setIdentifying(true);
      const run = (async () => {
        if (heldLink) {
          await heldLink.led(LedTarget.Both, LedMode.Blink, 255);
          await sleep(IDENTIFY_MS);
          if (link() === heldLink) await heldLink.led(LedTarget.Both, LedMode.Auto, 0);
          return;
        }
        // Held only for the blink; the box returns the light to its status after 1 s of silence.
        await exclusive(p!, async () => {
          const { link: tl } = await attachLink(p!, (pp) => build(pp, {}), bauds(lastBaud));
          try {
            await tl.led(LedTarget.Both, LedMode.Blink, 255);
            const end = Date.now() + IDENTIFY_MS;
            for (let left = IDENTIFY_MS; left > 0; left = end - Date.now()) {
              await sleep(Math.min(IDENTIFY_KEEPALIVE_MS, left));
              await tl.queryHealth().catch(() => undefined);
            }
          } finally {
            await tl.close().catch(() => undefined);
          }
        });
      })()
        .catch(() => undefined)
        .finally(() => {
          identifyRun = null;
          setIdentifying(false);
        });
      identifyRun = run;
      return run;
    };

    const clearDeviceLog = () => setDeviceLog([]);
    const clearInputEvents = () => setInputEvents([]);
    const subscribeEvents = (fn: (ev: CatchEvent, seq: number) => void) => {
      eventTaps.add(fn);
      return () => eventTaps.delete(fn);
    };

    const readFirmwareInfo = async (): Promise<FirmwareInfo | null> => {
      const l = link();
      if (!l) return null;
      try {
        const info = await l.queryFirmware();
        setFirmwareInfo(info);
        return info;
      } catch {
        return null;
      }
    };

    // Reopens after an activate at whichever rate the box answers; false if it never came back. The
    // status stays the caller's.
    const tryReconnect = async (p: SerialPort): Promise<boolean> => {
      await sleep(2000);
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const { link: nl, version: v, baud } = await exclusive(p, () => attachLink(p, makeLink));
          lastBaud = baud;
          setVersion(v);
          setLink(nl);
          poller.reset();
          return true;
        } catch {
          await sleep(1000);
        }
      }
      return false;
    };

    // Reattaches whenever the box stops answering: a revert reboots the main chip, maybe onto the other
    // control rate. No verdict by the deadline is no verification.
    const awaitVerdict = async (p: SerialPort, hostExpected: boolean): Promise<Verdict> => {
      const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
      const drop = async () => {
        const l = link();
        setLink(null);
        poller.reset();
        await l?.close().catch(() => undefined);
      };
      const fail = async (why: Verdict) => {
        await drop();
        setVersion(null);
        setFirmwareInfo(null);
        return why;
      };
      // The handshake's version can predate a revert that kept the rate; the read that decided cannot.
      const settle = async (info: FirmwareInfo): Promise<Verdict> => {
        const query = () => link()?.queryVersion().catch(() => undefined);
        const v = (await query()) ?? (await query()) ?? version();
        if (v) setVersion({ ...v, fwMajor: info.device.major, fwMinor: info.device.minor, fwPatch: info.device.patch });
        return 'ok';
      };
      let last: FirmwareInfo | null = null;
      for (;;) {
        // A second read before abandoning the link: one lost reply is not a reboot.
        const info = link() ? ((await readFirmwareInfo()) ?? (await readFirmwareInfo())) : null;
        if (info && decided(info.device) && (!hostExpected || (info.host && decided(info.host)))) return settle(info);
        last = info ?? last;
        if (Date.now() >= deadline) return fail(last && decided(last.device) ? 'host' : 'gone');
        if (info) {
          await sleep(500);
          continue;
        }
        await drop();
        if (!(await tryReconnect(p))) return fail('gone');
      }
    };

    // Each chip writes its spare slot and the box reverts anything that won't boot. The host image is
    // relayed over the inter-chip link.
    const updateOverControl = async (images: {
      device?: Uint8Array;
      host?: Uint8Array;
    }): Promise<'verified' | 'sent' | 'failed'> => {
      const l = link();
      if (!l) {
        setError('Connect to the box first.');
        return 'failed';
      }
      if (!images.device && !images.host) return 'failed';
      const run = { device: images.device !== undefined, host: images.host !== undefined };
      const finish = <O extends 'verified' | 'sent' | 'failed'>(outcome: O): O => {
        setUpdate({ ...run, outcome });
        return outcome;
      };
      setError(null);
      setUpdate({ ...run, outcome: 'running' });
      setStatus('flashing');
      const ctrlPort = l.serialPort;
      try {
        // Host first: the device chip's running firmware relays its image.
        if (images.host) {
          setUpdateProgress({ phase: 'writing', written: 0, total: images.host.length });
          await l.stageFirmware(OTA_TGT_HOST, images.host, (written, total) =>
            setUpdateProgress({ phase: 'writing', written, total }),
          );
        }
        if (images.device) {
          setUpdateProgress({ phase: 'writing', written: 0, total: images.device.length });
          await l.stageFirmware(OTA_TGT_DEVICE, images.device, (written, total) =>
            setUpdateProgress({ phase: 'writing', written, total }),
          );
        }
        // A mouse-side chip that answered before the activate has to answer after it, whatever was sent.
        const read = () => l.queryFirmware().catch(() => null);
        const hostBefore = ((await read()) ?? (await read()))?.host != null;
        setUpdateProgress({ phase: 'connecting' });
        updating = true;
        await l.activateFirmware();
        // The link is reopened either way; the main chip reboots unless only the mouse-side chip was sent.
        resetView();
        await l.close().catch(() => undefined);
        const hostExpected = images.host !== undefined || hostBefore;
        const result = (await tryReconnect(ctrlPort)) ? await awaitVerdict(ctrlPort, hostExpected) : 'gone';
        setUpdateProgress({ phase: 'done' });
        if (result !== 'ok') {
          // Shared, not page-local, so it survives a tab change; Device, Control and Update show it.
          setError(
            result === 'host'
              ? "The update was sent, but the mouse-side chip isn't answering. Replug the box, then connect. If it still isn't answering, open Set up."
              : 'The update was sent, but the box did not come back on its own. Replug it, then connect.',
          );
          if (result === 'gone') setProbe({ kind: 'silent' });
          setStatus('disconnected');
          return finish('sent');
        }
        setStatus('connected');
        return finish('verified');
      } catch (e) {
        // Disarm what is staged, host first, or the next activate commits it alone and splits the chips'
        // versions. One try per target, on a short timeout: an answering box replies at once.
        const staged: number[] = [];
        if (images.host) staged.push(OTA_TGT_HOST);
        if (images.device) staged.push(OTA_TGT_DEVICE);
        for (const t of staged) {
          try {
            await l.abortUpdate(t, 3000);
          } catch {
            /* the activate's own error is the one worth reporting */
          }
        }
        setError(flashErrorText(e));
        setStatus('error');
        return finish('failed');
      } finally {
        updating = false;
      }
    };

    const updateOnly = () => {
      const v = version();
      return status() === 'connected' && v !== null && !speaksCurrentWire(v);
    };

    const setPort = (p: SerialPort | null) => {
      if (p === port()) return;
      setPortSig(p);
      // A lost session's loop finds the new port by itself.
      if (p && held() && status() === 'disconnected') void connect();
    };

    const api: BoxSession = {
      supported: hooks.supported,
      secure: hooks.secure,
      status,
      version,
      updateOnly,
      health,
      error,
      // A port nobody holds is explained by what it last answered.
      verdict: () => verdict() ?? (status() === 'disconnected' && !held() ? probeVerdict(probe()) : null),
      link,
      name: seenName,
      present: () => port() !== null,
      held,
      probe,
      connect,
      disconnect,
      identify,
      identifying,
      poll: poller.subscribe,
      pollUnreadable: poller.unreadable,
      refreshPoll: poller.refresh,
      updateProgress,
      update,
      clearUpdate: () => setUpdate(null),
      firmwareInfo,
      readFirmwareInfo,
      updateOverControl,
      deviceLog,
      clearDeviceLog,
      inputEvents,
      clearInputEvents,
      subscribeEvents,
    };

    const ctl: SessionControl = {
      port,
      mac,
      setPort,
      setProbe: (p) => {
        setProbe(p);
        setVerdict(null);
        if (p?.kind === 'box') lastBaud = p.baud;
        if (mac() === null) setMac(boxId(versionOf(p)));
      },
      attach,
      settled: async () => {
        await attachRun?.catch(() => undefined);
      },
      dispose: () => {
        disposed = true;
        ++lostGen;
        letGo();
        // Never close the port mid-update; the box would time the session out with a half-written slot.
        if (status() !== 'flashing') void link()?.close().catch(() => undefined);
        disposeRoot();
      },
    };

    return { api, ctl };
  });
}
