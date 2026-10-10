/// <reference types="w3c-web-serial" />
import { type Accessor, createEffect, createRoot, createSignal, untrack } from 'solid-js';
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
  isCloned,
  macHex,
  versionString,
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
import { type FlashProgress, imageVersion } from '../../../dashboard/flash';
import type { FlashSource, StatsReport, StatsSink } from '../../../dashboard/stats';
import { type Poller, createPoller } from './poll';
import { flashErrorText } from './flashText';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'lost' | 'flashing' | 'error';

// A CATCH event and its box sequence, shared across all three frame types, so any gap is a drop.
export interface InputEventEntry {
  seq: number;
  ev: CatchEvent;
}

export interface UpdateRun {
  device: boolean;
  host: boolean;
  // The page that started the run, and the only one that shows its result.
  page: 'update' | 'advanced';
  outcome: 'running' | 'verified' | 'sent' | 'failed';
  // Per chip sent, once verified: whether it decided on the other slot. A revert lands back on the slot
  // it ran, whatever the versions say.
  landed?: { device?: boolean; host?: boolean };
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
  present: Accessor<boolean>;
  // Connected and not disconnected since: it reconnects whenever it is found.
  held: Accessor<boolean>;
  probe: Accessor<Probe | null>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  // Disconnect, and drop what this browser keeps about the box.
  forget: () => Promise<void>;
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
  updateOverControl: (
    images: { device?: Uint8Array; host?: Uint8Array },
    page: UpdateRun['page'],
    source?: FlashSource,
  ) => Promise<'verified' | 'sent' | 'failed'>;
  deviceLog: Accessor<string[]>;
  // Every line ever added, so a view of a log at its cap still knows which lines are new.
  deviceLogAdded: Accessor<number>;
  clearDeviceLog: () => void;
  inputEvents: Accessor<InputEventEntry[]>;
  inputEventsAdded: Accessor<number>;
  clearInputEvents: () => void;
  // A raw catch-stream tap for a consumer that buffers events itself; returns an unsubscribe.
  subscribeEvents: (fn: (ev: CatchEvent, seq: number) => void) => () => void;
}

export interface SessionHooks {
  supported: boolean;
  secure: boolean;
  nativeFlashing: Accessor<boolean>;
  makeLink?: (port: SerialPort, events: SerialLinkEvents) => SerialLink;
  // The chooser, for a session with no port.
  acquire?: () => Promise<ConnectVerdict | null>;
  exclusive?: <T>(port: SerialPort, fn: () => Promise<T>) => Promise<T>;
  // Null while another tab holds the box; call the result to release it.
  claim?: (mac: string) => Promise<(() => void) | null>;
  seen?: (port: SerialPort, probe: Probe) => boolean;
  held?: (mac: string, name: string) => void;
  released?: (mac: string) => void;
  forgotten?: (mac: string) => void;
  report?: StatsSink;
}

export interface SessionControl {
  port: Accessor<SerialPort | null>;
  mac: Accessor<string | null>;
  setPort: (port: SerialPort | null) => void;
  setProbe: (probe: Probe | null) => void;
  attach: () => Promise<Version>;
  settled: () => Promise<void>;
  dispose: () => void;
}

export const LOST_AFTER_MISSES = 3;
// The stats' DEVICE_INFO interval, when no card reads it faster.
export const DEVICE_REPORT_MS = 5000;
export const REATTACH_MS = 1000;
export const IDENTIFY_MS = 3000;

function formatLogLine(line: LogLine): string {
  return `[${LogLevel[line.level]}] ${line.text}`;
}

export { flashErrorText };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 'host': the main chip came back and decided, and the mouse-side chip never did.
type Verdict = 'ok' | 'gone' | 'host';

// An image marked invalid is about to reboot into the other one, so it is no verdict either.
const decided = (c: ChipFirmware) =>
  c.state !== ImageState.PendingVerify && c.state !== ImageState.Invalid && c.state !== ImageState.Aborted;

class AttachCancelled extends Error {}
class ForeignBoxError extends Error {
  constructor() {
    super('Another box answered on this port.');
  }
}

const versionOf = (p: Probe | null): Version | null => (p && 'version' in p ? p.version : null);

const chipVersion = (c: ChipFirmware | null | undefined) => (c ? `${c.major}.${c.minor}.${c.patch}` : null);

// A run's length for the stats, on a clock no system time change moves.
const elapsed = (since: number) => Math.min(3_600_000, Math.max(0, Math.round(performance.now() - since)));

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
    // A list and its count of everything added change together, in one signal.
    const [log, setLog] = createSignal<{ lines: string[]; added: number }>({ lines: [], added: 0 });
    const deviceLog = () => log().lines;
    const deviceLogAdded = () => log().added;
    const setDeviceLog = (lines: string[]) => setLog((l) => ({ lines, added: l.added }));
    const [events, setEvents] = createSignal<{ list: InputEventEntry[]; added: number }>({ list: [], added: 0 });
    const inputEvents = () => events().list;
    const inputEventsAdded = () => events().added;
    const setInputEvents = (list: InputEventEntry[]) => setEvents((e) => ({ list, added: e.added }));
    const [seenName, setSeenName] = createSignal<string | null>(versionOf(init.probe ?? null)?.name ?? null);
    const eventTaps = new Set<(ev: CatchEvent, seq: number) => void>();

    // An update waiting for its verdict reattaches without a connect, and owns the status until it ends.
    let updating = false;
    let disposed = false;
    let lastBaud = init.probe?.kind === 'box' ? init.probe.baud : undefined;
    // Bumped to stop a running reattach loop.
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
    const report = (r: StatsReport) => {
      try {
        hooks.report?.(r);
      } catch {
        /* counting must not break a connect or a flash */
      }
    };
    const reportBox = (v: Version, info: FirmwareInfo | null) => {
      const id = boxId(v);
      if (id) report({ type: 'box', mac: id, fw: versionString(v), hostFw: chipVersion(info?.host), proto: v.protoVer });
    };
    // The mouse-side chip's version comes from one FIRMWARE read.
    const announce = (l: SerialLink, v: Version) => {
      if (!hooks.report) return;
      void l
        .queryFirmware()
        .catch(() => null)
        .then((info) => reportBox(v, info));
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

    // Fed a derived link so an update, or a chip in ROM download, silences every readback.
    const poller = createPoller(() => (status() === 'flashing' || hooks.nativeFlashing() ? null : link()), {
      onKeepalive,
      keepalive: () => {
        const v = version();
        return v && !speaksCurrentWire(v) ? 'version' : 'health';
      },
    });
    // The keepalive polls health on the current wire; this only reads it.
    const health = poller.peek('health');
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
        onLog: (ln) => setLog((l) => ({ lines: [...l.lines, formatLogLine(ln)].slice(-500), added: l.added + 1 })),
        onEvent: (ev, seq) => {
          setEvents((e) => ({ list: [...e.list, { seq, ev }].slice(-200), added: e.added + 1 }));
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

    // Another MAC on this port is another box; this session drops the port.
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
          announce(found.nl, found.v);
          return;
        } catch (e) {
          // A box back on firmware too old to update won't answer differently next time.
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
          announce(nl, v);
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

    const connect = async () => {
      const s = status();
      if (s === 'connecting' || s === 'connected' || s === 'flashing' || s === 'lost') return;
      if (hooks.nativeFlashing()) return;
      if (!port()) {
        if (!hooks.acquire) return;
        setError(null);
        setVerdict(null);
        setStatus('connecting');
        let v: ConnectVerdict | null;
        try {
          v = await hooks.acquire();
        } catch (e) {
          // Nothing may escape, or the page sticks on "Connecting..." until a reload.
          v = classifyConnectError(e);
        }
        if (status() === 'connecting') setStatus('disconnected');
        setVerdict(v);
        return;
      }
      try {
        await attach();
      } catch (e) {
        // A port handed to another box's entry says nothing about this box.
        if (!(e instanceof AttachCancelled) && !(e instanceof ForeignBoxError)) setVerdict(classifyConnectError(e));
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

    const forget = async () => {
      const m = mac();
      await disconnect();
      if (m) hooks.forgotten?.(m);
    };

    const identify = (): Promise<void> => {
      const l = link();
      if (identifyRun || !l || status() !== 'connected') return identifyRun ?? Promise.resolve();
      setIdentifying(true);
      // A refused blink rejects for the caller to show; the restore can fail on a box already gone.
      const run = (async () => {
        await l.led(LedTarget.Both, LedMode.Blink, 255);
        await sleep(IDENTIFY_MS);
        if (link() === l) await l.led(LedTarget.Both, LedMode.Auto, 0).catch(() => undefined);
      })()
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
    const updateOverControl = async (
      images: { device?: Uint8Array; host?: Uint8Array },
      page: UpdateRun['page'],
      source: FlashSource = 'release',
    ): Promise<'verified' | 'sent' | 'failed'> => {
      // One run at a time: a second would interleave sessions on the box and overwrite the first's result.
      if (updating || status() === 'flashing') return 'failed';
      const l = link();
      if (!l) {
        setError('Connect to the box first.');
        return 'failed';
      }
      if (!images.device && !images.host) return 'failed';
      const run = { device: images.device !== undefined, host: images.host !== undefined, page };
      const started = performance.now();
      // Where each chip runs now: one that lands decides on the other slot.
      let before: FirmwareInfo | null = null;
      const finish = <O extends 'verified' | 'sent' | 'failed'>(outcome: O, landed?: UpdateRun['landed']): O => {
        setUpdate({ ...run, outcome, ...(landed ? { landed } : {}) });
        report({
          type: 'flash',
          mac: mac(),
          page,
          route: 'usb2',
          chips: run.device && run.host ? 'both' : run.device ? 'device' : 'host',
          source,
          kind: null,
          to: { device: imageVersion(images.device, 'app'), host: imageVersion(images.host, 'app') },
          from: { device: chipVersion(before?.device), host: chipVersion(before?.host) },
          result: landed && Object.values(landed).includes(false) ? 'reverted' : outcome,
          ms: elapsed(started),
        });
        return outcome;
      };
      setError(null);
      setUpdate({ ...run, outcome: 'running' });
      setStatus('flashing');
      const ctrlPort = l.serialPort;
      const read = () => l.queryFirmware().catch(() => null);
      before = (await read()) ?? (await read());
      if (!before) {
        setError("The box didn't answer. Check USB2, then try again.");
        setStatus('error');
        return finish('failed');
      }
      try {
        // Host first: the device chip's running firmware relays its image.
        if (images.host) {
          setUpdateProgress({ phase: 'writing', chip: 'host', written: 0, total: images.host.length });
          await l.stageFirmware(OTA_TGT_HOST, images.host, (written, total) =>
            setUpdateProgress({ phase: 'writing', chip: 'host', written, total }),
          );
        }
        if (images.device) {
          setUpdateProgress({ phase: 'writing', chip: 'device', written: 0, total: images.device.length });
          await l.stageFirmware(OTA_TGT_DEVICE, images.device, (written, total) =>
            setUpdateProgress({ phase: 'writing', chip: 'device', written, total }),
          );
        }
        // A mouse-side chip that answered before the activate has to answer after it, whatever was sent.
        const hostBefore = ((await read()) ?? (await read()))?.host != null;
        setUpdateProgress({ phase: 'restarting' });
        updating = true;
        await l.activateFirmware();
        // The link is reopened either way; the main chip reboots unless only the mouse-side chip was sent.
        resetView();
        await l.close().catch(() => undefined);
        const hostExpected = images.host !== undefined || hostBefore;
        const back = await tryReconnect(ctrlPort);
        if (back) setUpdateProgress({ phase: 'verifying' });
        const result = back ? await awaitVerdict(ctrlPort, hostExpected) : 'gone';
        setUpdateProgress({ phase: 'done' });
        if (result !== 'ok') {
          // Shared, not page-local, so it survives a tab change; Device, Control and Update show it.
          setError(
            result === 'host'
              ? "The update was sent, but the mouse-side chip isn't answering. Replug the box, then connect. If it still isn't answering, open Set up."
              : 'The update was sent, but the box did not come back. Replug it, then connect.',
          );
          if (result === 'gone') setProbe({ kind: 'silent' });
          setStatus('disconnected');
          return finish('sent');
        }
        setStatus('connected');
        // The decided read the verdict ended on.
        const after = firmwareInfo();
        // A chip that answered only after the run has no slot to compare: it landed if it runs the image.
        const moved = (a: ChipFirmware | null | undefined, b: ChipFirmware | null | undefined, image?: Uint8Array) =>
          !!b && (a ? a.slot !== b.slot : chipVersion(b) === imageVersion(image, 'app'));
        const done = finish('verified', {
          ...(images.device ? { device: moved(before.device, after?.device, images.device) } : {}),
          ...(images.host ? { host: moved(before.host, after?.host, images.host) } : {}),
        });
        const v = version();
        if (v) reportBox(v, after);
        return done;
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
            /* the activate's error is the one to report */
          }
        }
        setError(flashErrorText(e));
        // A port back before this settled has already started a fresh connect, which owns the status.
        if (status() !== 'connecting' && status() !== 'connected') setStatus('error');
        return finish('failed');
      } finally {
        updating = false;
      }
    };

    const updateOnly = () => {
      const v = version();
      return status() === 'connected' && v !== null && !speaksCurrentWire(v);
    };

    // A box connected only to be updated may not know DEVICE_INFO.
    if (hooks.report) {
      createEffect(() => {
        const id = mac();
        if (status() !== 'connected' || updateOnly() || !id) return;
        // Untracked: a subscribe's first read follows the poller's link, and a ROM download elsewhere moves it.
        const device = untrack(() => poller.subscribe('deviceInfo', DEVICE_REPORT_MS));
        let last = '';
        createEffect(() => {
          const d = device();
          if (!d || !isCloned(d) || `${d.vid}:${d.pid}` === last) return;
          last = `${d.vid}:${d.pid}`;
          report({ type: 'device', mac: id, vid: d.vid, pid: d.pid, kind: d.kind, product: d.product || null });
        });
      });
    }

    const setPort = (p: SerialPort | null) => {
      if (p === port()) return;
      setPortSig(p);
      // A lost session's loop finds the new port by itself; one whose update died with the port reconnects here.
      if (p && held() && (status() === 'disconnected' || status() === 'error')) void connect();
    };

    const api: BoxSession = {
      supported: hooks.supported,
      secure: hooks.secure,
      status,
      version,
      updateOnly,
      health,
      error,
      verdict: () => verdict() ?? (status() === 'disconnected' && !held() ? probeVerdict(probe()) : null),
      link,
      name: seenName,
      present: () => port() !== null,
      held,
      probe,
      connect,
      disconnect,
      forget,
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
      deviceLogAdded,
      clearDeviceLog,
      inputEvents,
      inputEventsAdded,
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
