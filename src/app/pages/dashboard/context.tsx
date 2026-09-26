/// <reference types="w3c-web-serial" />
import {
  type Accessor,
  type ParentComponent,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  useContext,
} from 'solid-js';
import {
  type CatchEvent,
  type Health,
  type LogLine,
  type Version,
  LogLevel,
  type ChipFirmware,
  type FirmwareInfo,
  ImageState,
  OTA_TGT_DEVICE,
  OTA_TGT_HOST,
} from '../../../dashboard/protocol';
import {
  CONFIRM_TIMEOUT_MS,
  type ConnectVerdict,
  SerialLink,
  attachLink,
  attemptConnect,
  classifyConnectError,
  grantedMediusPorts,
  isSecureContextOk,
  isWebSerialSupported,
  speaksCurrentWire,
  requestMediusPort,
} from '../../../dashboard/serial';
import type { FlashKind, FlashProgress } from '../../../dashboard/flash';
import { type Poller, createPoller } from './poll';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'flashing';

export type { ConnectVerdict };

// A CATCH event and its box sequence, shared across all three frame types, so any gap is a drop.
export interface InputEventEntry {
  seq: number;
  ev: CatchEvent;
}

export interface DashboardContextValue {
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
  // `force` skips remembered ports and asks for a device, so a remembered wrong box can't answer
  // every retry.
  connect: (force?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  // Subscribe a card to a readback while mounted; cards share one query per value.
  poll: Poller['subscribe'];
  // True when a readback's layout doesn't decode.
  pollUnreadable: Poller['unreadable'];
  // Re-read now; call after a write.
  refreshPoll: Poller['refresh'];
  flashProgress: Accessor<FlashProgress | null>;
  flashLog: Accessor<string[]>;
  firmwareInfo: Accessor<FirmwareInfo | null>;
  readFirmwareInfo: () => Promise<FirmwareInfo | null>;
  // 'verified' only when the box came back and replied; 'sent' means transfer and activate succeeded
  // but nothing confirmed the running version.
  updateOverControl: (images: {
    device?: Uint8Array;
    host?: Uint8Array;
  }) => Promise<'verified' | 'sent' | 'failed'>;
  flashNative: (port: SerialPort, image: Uint8Array, kind: FlashKind) => Promise<boolean>;
  clearFlashResult: () => void;
  deviceLog: Accessor<string[]>;
  clearDeviceLog: () => void;
  inputEvents: Accessor<InputEventEntry[]>;
  clearInputEvents: () => void;
  // A raw catch-stream tap for a consumer keeping its own buffer; returns an unsubscribe.
  subscribeEvents: (fn: (ev: CatchEvent, seq: number) => void) => () => void;
}

function formatLogLine(line: LogLine): string {
  return `[${LogLevel[line.level]}] ${line.text}`;
}

// Exported so a card can mount against a stand-in value.
export const DashboardContext = createContext<DashboardContextValue>();

// Flash and update failures only: a failed CONNECT is a verdict, not a string.
function flashErrorText(e: unknown): string {
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

export const DashboardProvider: ParentComponent = (props) => {
  const supported = isWebSerialSupported();
  const secure = isSecureContextOk();
  const [status, setStatus] = createSignal<ConnectionStatus>('disconnected');
  const [version, setVersion] = createSignal<Version | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [verdict, setVerdict] = createSignal<ConnectVerdict | null>(null);
  const [link, setLink] = createSignal<SerialLink | null>(null);
  const [flashProgress, setFlashProgress] = createSignal<FlashProgress | null>(null);
  const [firmwareInfo, setFirmwareInfo] = createSignal<FirmwareInfo | null>(null);
  const [flashLog, setFlashLog] = createSignal<string[]>([]);
  const [deviceLog, setDeviceLog] = createSignal<string[]>([]);
  const [inputEvents, setInputEvents] = createSignal<InputEventEntry[]>([]);
  const eventTaps = new Set<(ev: CatchEvent, seq: number) => void>();

  // Fed a derived link so a flash silences every readback in one place: esptool owns a port then.
  const poller = createPoller(() => (status() === 'flashing' ? null : link()));
  // The poller already polls health as the keepalive; this only reads it.
  const health = poller.subscribe('health');

  // An update waiting for its verdict reattaches on its own, and owns the status until it ends.
  let updating = false;

  const makeLink = (port: SerialPort): SerialLink => {
    const nl: SerialLink = new SerialLink(port, {
      onLog: (ln) => setDeviceLog((prev) => [...prev, formatLogLine(ln)].slice(-500)),
      onEvent: (ev, seq) => {
        setInputEvents((prev) => [...prev, { seq, ev }].slice(-200));
        eventTaps.forEach((fn) => fn(ev, seq));
      },
      onClose: () => {
        // Only the stored link: another may already own this port.
        if (link() !== nl) return;
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

  // Reopens after an activate at whichever rate the box answers; false if it never came back. The
  // status stays the caller's.
  const tryReconnect = async (port: SerialPort): Promise<boolean> => {
    await sleep(2000);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { link: nl, version: v } = await attachLink(port, makeLink);
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

  let disposed = false;

  const connect = async (force = false) => {
    if (status() === 'connecting' || status() === 'connected' || status() === 'flashing') return;
    setError(null);
    setVerdict(null);
    setFlashProgress(null);
    setDeviceLog([]);
    setInputEvents([]);
    setFirmwareInfo(null);
    setStatus('connecting');
    // A failed update's link still holds the writer lock, and a second link over it throws
    // unrecoverably.
    const stale = link();
    if (stale) {
      setLink(null);
      setVersion(null);
      poller.reset();
      await stale.close().catch(() => undefined);
    }

    let outcome: Awaited<ReturnType<typeof attemptConnect<SerialLink>>>;
    try {
      outcome = await attemptConnect<SerialLink>(
        {
          supported: () => supported,
          secure: () => secure,
          granted: grantedMediusPorts,
          choose: requestMediusPort,
          attach: (port) => attachLink(port, makeLink),
        },
        { skipGranted: force },
      );
    } catch (e) {
      // Nothing may escape, or the page sticks on "Connecting..." until a reload.
      outcome = { ok: false, verdict: classifyConnectError(e) };
    }

    // A disconnect or an install may have changed the status meanwhile; its owner wins and this link
    // closes.
    if (disposed || status() !== 'connecting') {
      if (outcome.ok) await outcome.link.close().catch(() => undefined);
      return;
    }
    if (!outcome.ok) {
      setVerdict(outcome.verdict);
      setStatus('disconnected');
      return;
    }
    setVersion(outcome.version);
    setLink(outcome.link);
    // Reset before the cards mount, so each slot is queried once.
    poller.reset();
    setStatus('connected');
  };

  const disconnect = async () => {
    const l = link();
    // Status first: the cards unmount on it and release their holds over the still-open link.
    setStatus('disconnected');
    setLink(null);
    setVersion(null);
    setError(null);
    setVerdict(null);
    setFirmwareInfo(null);
    poller.reset();
    setFlashProgress(null);
    if (l) await l.close().catch(() => undefined);
  };

  const clearFlashResult = () => setFlashProgress(null);
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

  // Reattaches whenever the box stops answering: a revert reboots the main chip, maybe onto the other
  // control rate. No verdict by the deadline is no verification.
  const awaitVerdict = async (port: SerialPort, hostExpected: boolean): Promise<Verdict> => {
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
      if (!(await tryReconnect(port))) return fail('gone');
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
    setError(null);
    setFlashLog([]);
    setStatus('flashing');
    const ctrlPort = l.serialPort;
    try {
      // Host first: the device chip's running firmware relays its image.
      if (images.host) {
        setFlashProgress({ phase: 'writing', written: 0, total: images.host.length });
        await l.stageFirmware(OTA_TGT_HOST, images.host, (written, total) =>
          setFlashProgress({ phase: 'writing', written, total }),
        );
      }
      if (images.device) {
        setFlashProgress({ phase: 'writing', written: 0, total: images.device.length });
        await l.stageFirmware(OTA_TGT_DEVICE, images.device, (written, total) =>
          setFlashProgress({ phase: 'writing', written, total }),
        );
      }
      // A mouse-side chip that answered before the activate has to answer after it, whatever was sent.
      const read = () => l.queryFirmware().catch(() => null);
      const hostBefore = ((await read()) ?? (await read()))?.host != null;
      setFlashProgress({ phase: 'connecting' });
      updating = true;
      await l.activateFirmware();
      // The link is reopened either way; the main chip reboots unless only the mouse-side chip was sent.
      setLink(null);
      setVersion(null);
      setFirmwareInfo(null);
      poller.reset();
      await l.close().catch(() => undefined);
      const hostExpected = images.host !== undefined || hostBefore;
      const verdict = (await tryReconnect(ctrlPort)) ? await awaitVerdict(ctrlPort, hostExpected) : 'gone';
      setFlashProgress({ phase: 'done' });
      if (verdict !== 'ok') {
        // Shared, not page-local, so it survives a tab change; Device, Control and Update show it.
        setError(
          verdict === 'host'
            ? "The update was sent, but the mouse-side chip isn't answering. Replug the box, then connect. If it still isn't answering, open Set up."
            : 'The update was sent, but the box did not come back on its own. Replug it, then connect.',
        );
        setStatus('disconnected');
        return 'sent';
      }
      setStatus('connected');
      return 'verified';
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
      return 'failed';
    } finally {
      updating = false;
    }
  };

  // A chip in ROM download on its native USB. Independent of the control link; restores its status.
  const flashNative = async (
    port: SerialPort,
    image: Uint8Array,
    kind: FlashKind,
  ): Promise<boolean> => {
    if (status() === 'flashing') return false;
    const hadLink = link();
    setError(null);
    setFlashLog([]);
    setFlashProgress({ phase: 'connecting' });
    setStatus('flashing');
    try {
      const { flashNativePort } = await import('../../../dashboard/flash/flasher');
      await flashNativePort({
        port,
        image,
        kind,
        onProgress: (p) => setFlashProgress(p),
        onLog: (line) => setFlashLog((prev) => [...prev, line].slice(-500)),
      });
      setFlashProgress({ phase: 'done' });
      setStatus(hadLink ? 'connected' : 'disconnected');
      return true;
    } catch (e) {
      setError(flashErrorText(e));
      setStatus(hadLink ? 'connected' : 'error');
      return false;
    }
  };

  // Block tab close / refresh during a flash; esptool cannot survive it.
  createEffect(() => {
    if (status() !== 'flashing') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    onCleanup(() => window.removeEventListener('beforeunload', handler));
  });

  onCleanup(() => {
    disposed = true;
    // Never close the port mid-flash; esptool owns it during the handoff.
    if (status() !== 'flashing') void link()?.close().catch(() => undefined);
  });

  const updateOnly = () => {
    const v = version();
    return status() === 'connected' && v !== null && !speaksCurrentWire(v);
  };

  const value: DashboardContextValue = {
    supported,
    secure,
    status,
    version,
    updateOnly,
    health,
    error,
    verdict,
    link,
    connect,
    disconnect,
    poll: poller.subscribe,
    pollUnreadable: poller.unreadable,
    refreshPoll: poller.refresh,
    flashProgress,
    flashLog,
    firmwareInfo,
    readFirmwareInfo,
    updateOverControl,
    flashNative,
    clearFlashResult,
    deviceLog,
    clearDeviceLog,
    inputEvents,
    clearInputEvents,
    subscribeEvents,
  };

  return <DashboardContext.Provider value={value}>{props.children}</DashboardContext.Provider>;
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within a DashboardProvider');
  return ctx;
}
