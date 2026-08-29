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
  type FirmwareInfo,
  OTA_TGT_DEVICE,
  OTA_TGT_HOST,
} from '../../../dashboard/protocol';
import {
  type ConnectVerdict,
  SerialLink,
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

// One event received on the CATCH stream, with its rolling box-side sequence. The sequence is
// shared across all three event frame types, so a gap is a drop regardless of which kind fell out.
export interface InputEventEntry {
  seq: number;
  ev: CatchEvent;
}

export interface DashboardContextValue {
  supported: boolean;
  secure: boolean;
  status: Accessor<ConnectionStatus>;
  version: Accessor<Version | null>;
  // A box a protocol version behind connects for one thing: being updated. Everything else on this
  // page speaks the current wire, so it is not offered while this is true.
  updateOnly: Accessor<boolean>;
  health: Accessor<Health | null>;
  error: Accessor<string | null>;
  // Why the last connect attempt did not produce a link. Null once one succeeds, and null before
  // anything has been tried.
  verdict: Accessor<ConnectVerdict | null>;
  link: Accessor<SerialLink | null>;
  // `force` skips the ports the browser already remembers and asks which device to use. It is what
  // a retry does, so a remembered port that is the wrong box cannot answer for every later attempt.
  connect: (force?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  // Subscribe a card to one box readback for as long as it is mounted. The poller owns the timer
  // and shares one query across every card that wants the same value.
  poll: Poller['subscribe'];
  // Re-read a value now. Call it straight after writing that value, so the readout shows what was
  // just set instead of the previous value until the next tick.
  refreshPoll: Poller['refresh'];
  flashProgress: Accessor<FlashProgress | null>;
  flashLog: Accessor<string[]>;
  firmwareInfo: Accessor<FirmwareInfo | null>;
  readFirmwareInfo: () => Promise<FirmwareInfo | null>;
  // 'verified' only when the box came back and answered. 'sent' means the transfer and the activate
  // succeeded but nothing has confirmed what is running now -- the box reverts an image that will
  // not boot, so claiming a version here would be a claim nothing checked.
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
  // Register a raw tap on the catch stream (the input-events store is capped and shared); returns an
  // unsubscribe. Lets a high-rate consumer keep its own buffer.
  subscribeEvents: (fn: (ev: CatchEvent, seq: number) => void) => () => void;
}

function formatLogLine(line: LogLine): string {
  return `[${LogLevel[line.level]}] ${line.text}`;
}

// Exported so a card can be mounted against a stand-in value without opening a serial port.
export const DashboardContext = createContext<DashboardContextValue>();

// Flash and update failures only: a failed CONNECT is a verdict, not a string.
function flashErrorText(e: unknown): string {
  if (e instanceof Error) {
    // Web Serial's own wording surfaces raw otherwise, and none of it says what to do.
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

  // Every card's readback runs through one poller. It is fed a derived link rather than `link`
  // itself so a flash silences it in one place: during a flash esptool owns a port and the control
  // link must not be touched, and there is no start/stop call left to forget at a new call site.
  const poller = createPoller(() => (status() === 'flashing' ? null : link()));
  // The poller keeps health polled on its own as the link keepalive; this subscription is only for
  // reading the value.
  const health = poller.subscribe('health');

  const makeLink = (port: SerialPort): SerialLink => {
    const nl: SerialLink = new SerialLink(port, {
      onLog: (ln) => setDeviceLog((prev) => [...prev, formatLogLine(ln)].slice(-500)),
      onEvent: (ev, seq) => {
        setInputEvents((prev) => [...prev, { seq, ev }].slice(-200));
        eventTaps.forEach((fn) => fn(ev, seq));
      },
      onClose: () => {
        // Only the stored link: another link may already own this port, and closing it would take
        // that one's port down with it.
        if (link() !== nl) return;
        setStatus('disconnected');
        setVersion(null);
        setError(null);
        setLink(null);
        poller.reset();
        // The read loop is finished but the port is still open and its writer still locked. Without
        // this the next connect adopts the port and cannot get a writer, which nothing recovers.
        void nl.close().catch(() => undefined);
      },
    });
    return nl;
  };

  // After the main chip reboots to run, reconnect and read the version back as a
  // verification. Returns false if it never came back (then a power-cycle is needed).
  const tryReconnect = async (port: SerialPort): Promise<boolean> => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await sleep(2000);
    for (let attempt = 0; attempt < 4; attempt++) {
      const nl = makeLink(port);
      try {
        await nl.open();
        const v = await nl.handshake();
        setVersion(v);
        setLink(nl);
        poller.reset();
        setStatus('connected');
        return true;
      } catch {
        try {
          await nl.close();
        } catch {
          // ignore
        }
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
    setStatus('connecting');
    // Every link built here is tracked, so a port that opened but did not answer is closed on the
    // way out rather than left holding the device against the next attempt.
    // A link left behind by a failed update still holds the port's writer lock. Opening a second
    // link over it throws where nothing can recover, so let go of it first.
    const stale = link();
    if (stale) {
      setLink(null);
      setVersion(null);
      poller.reset();
      await stale.close().catch(() => undefined);
    }

    const built = new Map<SerialPort, SerialLink>();
    let outcome: Awaited<ReturnType<typeof attemptConnect<SerialLink>>>;
    try {
      outcome = await attemptConnect<SerialLink>(
        {
          supported: () => supported,
          secure: () => secure,
          granted: grantedMediusPorts,
          choose: requestMediusPort,
          attach: async (port) => {
            const l = makeLink(port);
            built.set(port, l);
            await l.open();
            return { link: l, version: await l.handshake() };
          },
          detach: async (port) => {
            try {
              await built.get(port)?.close();
            } catch {
              // A port that will not close is not a reason to stop trying the next one.
            }
            built.delete(port);
          },
        },
        { skipGranted: force },
      );
    } catch (e) {
      // Nothing may escape: an unhandled rejection here leaves the whole page on "Connecting..."
      // with no button to press and no way back but a reload.
      outcome = { ok: false, verdict: classifyConnectError(e) };
    }

    // Something else may have moved on while the chooser and handshake ran -- a disconnect, or the
    // setup wizard starting an install. Whoever changed the status owns it now; this link is not
    // wanted and must not be installed over the top.
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
    // Cleared before the cards mount, so each slot is queried once rather than by both the reset
    // and the first subscriber.
    poller.reset();
    setStatus('connected');
  };

  const disconnect = async () => {
    const l = link();
    // Status first. The cards unmount on it, and their cleanup releases what they are holding over
    // a link that is still open; dropping the link first left every hold set on the game PC until
    // the box's own silence timer caught it a second later.
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

  // Update over the control port the user is already connected to. Nothing reboots into ROM download
  // and no second port grant is needed: each chip writes the slot it is not running, and the box
  // reverts anything that will not boot. The host chip's image is relayed over the inter-chip link,
  // which is the only route to it.
  const updateOverControl = async (images: {
    device?: Uint8Array;
    host?: Uint8Array;
  }): Promise<'verified' | 'sent' | 'failed'> => {
    const l = link();
    if (!l) {
      setError('Connect to the box before updating.');
      return 'failed';
    }
    if (!images.device && !images.host) return 'failed';
    setError(null);
    setFlashLog([]);
    setStatus('flashing');
    const ctrlPort = l.serialPort;
    try {
      // The host chip first: its image travels through the device chip, so it has to be staged while
      // the device chip is still running the firmware that can relay it.
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
      setFlashProgress({ phase: 'connecting' });
      await l.activateFirmware();
      // The device chip reboots a moment after it answers, so the link this call rode is gone.
      setLink(null);
      setVersion(null);
      poller.reset();
      await l.close().catch(() => undefined);
      const reconnected = await tryReconnect(ctrlPort);
      setFlashProgress({ phase: 'done' });
      if (!reconnected) {
        // Shared, not page-local: this is the one instruction that fixes it, and navigating to
        // another tab used to destroy it. Device, Control and Update all surface it. The claim is
        // only what the code can support -- what is running now is what nothing has checked.
        setError(
          'The update was sent, but the box did not come back on its own. Unplug it, plug it back in, then connect.',
        );
        setStatus('disconnected');
        return 'sent';
      }
      await readFirmwareInfo();
      return 'verified';
    } catch (e) {
      // A refused activate stops at the host chip, and whatever is staged stays armed: the next
      // activate would commit it alone and leave the two chips on different versions. Disarm it,
      // host first, the same order it was staged in. Each target gets its own try, so a box that
      // has already gone away on the first one does not skip the second.
      // Short, because the usual reason for being here is a box that has stopped answering, and the
      // full op timeout twice over would leave the user watching a frozen progress bar for the best
      // part of a minute before the real error appears. A box that IS answering replies at once.
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
    }
  };

  // Flash a chip already in ROM download on its native USB port (recovery / host
  // chip). Independent of the control link; restores it afterwards if one was up.
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
