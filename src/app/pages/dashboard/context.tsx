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
import { type Health, type LogLine, type Version, LogLevel } from '../../../dashboard/protocol';
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
  flashDevice: (image: Uint8Array, kind: FlashKind) => Promise<boolean>;
  flashNative: (port: SerialPort, image: Uint8Array, kind: FlashKind) => Promise<boolean>;
  clearFlashResult: () => void;
  deviceLog: Accessor<string[]>;
  clearDeviceLog: () => void;
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

  const flashDevice = async (image: Uint8Array, kind: FlashKind): Promise<boolean> => {
    if (status() === 'flashing') return false;
    const l = link();
    if (!l) throw new Error('Connect to the box before flashing.');
    const port = l.serialPort;
    stopHealthPolling();
    setError(null);
    setFlashLog([]);
    setFlashProgress({ phase: 'rebooting' });
    setStatus('flashing');
    try {
      const { flashDeviceChip } = await import('../../../dashboard/flash/flasher');
      await flashDeviceChip({
        link: l,
        image,
        kind,
        onProgress: (p) => setFlashProgress(p),
        onLog: (line) => setFlashLog((prev) => [...prev, line].slice(-500)),
      });
      setFlashProgress({ phase: 'done' });
      const reconnected = await tryReconnect(port);
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
    flashDevice,
    flashNative,
    clearFlashResult,
    deviceLog,
    clearDeviceLog,
  };

  return <DashboardContext.Provider value={value}>{props.children}</DashboardContext.Provider>;
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within a DashboardProvider');
  return ctx;
}
