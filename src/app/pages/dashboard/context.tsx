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
  type Health,
  type InputReport,
  type LogLine,
  type Version,
  LogLevel,
  RebootTarget,
} from '../../../dashboard/protocol';
import {
  BadProtoVerError,
  NoReplyError,
  SerialLink,
  isSecureContextOk,
  isWebSerialSupported,
  requestMediusPort,
} from '../../../dashboard/serial';
import type { FlashKind, FlashProgress } from '../../../dashboard/flash';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'flashing';

// One physical-input EVENT received on the CATCH stream, with its rolling box-side sequence.
export interface InputEventEntry {
  seq: number;
  report: InputReport;
}

export interface DashboardContextValue {
  supported: boolean;
  secure: boolean;
  status: Accessor<ConnectionStatus>;
  version: Accessor<Version | null>;
  health: Accessor<Health | null>;
  error: Accessor<string | null>;
  link: Accessor<SerialLink | null>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setHealth: (h: Health | null) => void;
  flashProgress: Accessor<FlashProgress | null>;
  flashLog: Accessor<string[]>;
  rebootDeviceToDownload: () => Promise<SerialPort>;
  flashDeviceNative: (
    romPort: SerialPort,
    ctrlPort: SerialPort,
    image: Uint8Array,
    kind: FlashKind,
  ) => Promise<boolean>;
  flashNative: (port: SerialPort, image: Uint8Array, kind: FlashKind) => Promise<boolean>;
  clearFlashResult: () => void;
  deviceLog: Accessor<string[]>;
  clearDeviceLog: () => void;
  inputEvents: Accessor<InputEventEntry[]>;
  clearInputEvents: () => void;
}

function formatLogLine(line: LogLine): string {
  return `[${LogLevel[line.level]}] ${line.text}`;
}

const DashboardContext = createContext<DashboardContextValue>();

function isUserCancel(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotFoundError';
}

function describeError(e: unknown): string {
  if (e instanceof BadProtoVerError) {
    return `This device speaks protocol v${e.got}, which this dashboard does not support.`;
  }
  if (e instanceof NoReplyError) {
    return 'No reply from the box. Make sure the control cable is on the right port and that this is a Medius box.';
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export const DashboardProvider: ParentComponent = (props) => {
  const supported = isWebSerialSupported();
  const secure = isSecureContextOk();
  const [status, setStatus] = createSignal<ConnectionStatus>('disconnected');
  const [version, setVersion] = createSignal<Version | null>(null);
  const [health, setHealth] = createSignal<Health | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [link, setLink] = createSignal<SerialLink | null>(null);
  const [flashProgress, setFlashProgress] = createSignal<FlashProgress | null>(null);
  const [flashLog, setFlashLog] = createSignal<string[]>([]);
  const [deviceLog, setDeviceLog] = createSignal<string[]>([]);
  const [inputEvents, setInputEvents] = createSignal<InputEventEntry[]>([]);

  const HEALTH_POLL_MS = 1000;
  let healthTimer: ReturnType<typeof setTimeout> | null = null;
  let polling = false;

  const startHealthPolling = (l: SerialLink) => {
    stopHealthPolling();
    polling = true;
    const tick = async () => {
      // Bail if polling stopped or this tick belongs to a superseded link.
      if (!polling || link() !== l) return;
      try {
        setHealth(await l.queryHealth());
      } catch {
        // A transient miss is fine; a real drop is handled by onClose.
      }
      if (polling && link() === l) healthTimer = setTimeout(() => void tick(), HEALTH_POLL_MS);
    };
    void tick();
  };

  const stopHealthPolling = () => {
    polling = false;
    if (healthTimer !== null) {
      clearTimeout(healthTimer);
      healthTimer = null;
    }
  };

  const makeLink = (port: SerialPort): SerialLink => {
    const nl: SerialLink = new SerialLink(port, {
      onLog: (ln) => setDeviceLog((prev) => [...prev, formatLogLine(ln)].slice(-500)),
      onEvent: (report, seq) => setInputEvents((prev) => [...prev, { seq, report }].slice(-200)),
      onClose: () => {
        if (link() !== nl) return;
        stopHealthPolling();
        setStatus('disconnected');
        setVersion(null);
        setHealth(null);
        setError(null);
        setLink(null);
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
        setStatus('connected');
        startHealthPolling(nl);
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

  const connect = async () => {
    if (status() === 'connecting' || status() === 'connected') return;
    setError(null);
    setFlashProgress(null);
    setDeviceLog([]);
    setInputEvents([]);
    setStatus('connecting');
    let l: SerialLink | null = null;
    try {
      const port = await requestMediusPort();
      if (disposed) return;
      l = makeLink(port);
      await l.open();
      if (disposed) {
        await l.close();
        return;
      }
      const v = await l.handshake();
      if (disposed) {
        await l.close();
        return;
      }
      setVersion(v);
      setLink(l);
      setStatus('connected');
      startHealthPolling(l);
    } catch (e) {
      if (l) {
        try {
          await l.close();
        } catch {
          // ignore
        }
      }
      if (isUserCancel(e)) {
        setStatus('disconnected');
        return;
      }
      setError(describeError(e));
      setStatus('error');
    }
  };

  const disconnect = async () => {
    stopHealthPolling();
    const l = link();
    setLink(null);
    setVersion(null);
    setHealth(null);
    setError(null);
    setFlashProgress(null);
    setStatus('disconnected');
    if (l) await l.close();
  };

  const clearFlashResult = () => setFlashProgress(null);
  const clearDeviceLog = () => setDeviceLog([]);
  const clearInputEvents = () => setInputEvents([]);

  // Reboot the device chip into ROM download over the control link, then close
  // it. The chip re-enumerates on its native USB (0x303a); the returned CH343
  // port is reused to reconnect and verify once the new firmware is running.
  const rebootDeviceToDownload = async (): Promise<SerialPort> => {
    const l = link();
    if (!l) throw new Error('Connect to the box before updating.');
    const ctrlPort = l.serialPort;
    stopHealthPolling();
    setError(null);
    setFlashLog([]);
    setLink(null);
    setVersion(null);
    setHealth(null);
    await l.reboot(RebootTarget.DeviceDownload);
    await l.close();
    // The control link is down and the chip is in ROM download; report it as
    // disconnected (not flashing) so the UI can show the port-grant step.
    setStatus('disconnected');
    return ctrlPort;
  };

  // Flash the device chip over its native USB (already in ROM download), then
  // reconnect over the control port and read the version back as verification.
  const flashDeviceNative = async (
    romPort: SerialPort,
    ctrlPort: SerialPort,
    image: Uint8Array,
    kind: FlashKind,
  ): Promise<boolean> => {
    if (status() === 'flashing') return false;
    setError(null);
    setFlashLog([]);
    setFlashProgress({ phase: 'connecting' });
    setStatus('flashing');
    try {
      const { flashNativePort } = await import('../../../dashboard/flash/flasher');
      await flashNativePort({
        port: romPort,
        image,
        kind,
        onProgress: (p) => setFlashProgress(p),
        onLog: (line) => setFlashLog((prev) => [...prev, line].slice(-500)),
      });
      setFlashProgress({ phase: 'done' });
      const reconnected = await tryReconnect(ctrlPort);
      if (!reconnected) {
        setLink(null);
        setVersion(null);
        setHealth(null);
        setStatus('disconnected');
      }
      return true;
    } catch (e) {
      setLink(null);
      setVersion(null);
      setHealth(null);
      setError(describeError(e));
      setStatus('error');
      return false;
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
    if (hadLink) stopHealthPolling();
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
      if (hadLink) {
        setStatus('connected');
        startHealthPolling(hadLink);
      } else {
        setStatus('disconnected');
      }
      return true;
    } catch (e) {
      setError(describeError(e));
      if (hadLink) {
        setStatus('connected');
        startHealthPolling(hadLink);
      } else {
        setStatus('error');
      }
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
    stopHealthPolling();
    // Never close the port mid-flash; esptool owns it during the handoff.
    if (status() !== 'flashing') void link()?.close();
  });

  const value: DashboardContextValue = {
    supported,
    secure,
    status,
    version,
    health,
    error,
    link,
    connect,
    disconnect,
    setHealth,
    flashProgress,
    flashLog,
    rebootDeviceToDownload,
    flashDeviceNative,
    flashNative,
    clearFlashResult,
    deviceLog,
    clearDeviceLog,
    inputEvents,
    clearInputEvents,
  };

  return <DashboardContext.Provider value={value}>{props.children}</DashboardContext.Provider>;
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within a DashboardProvider');
  return ctx;
}
