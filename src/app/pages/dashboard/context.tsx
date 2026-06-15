import {
  type Accessor,
  type ParentComponent,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  useContext,
} from 'solid-js';
import type { Health, Version } from '../../../dashboard/protocol';
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
  flashDevice: (image: Uint8Array, kind: FlashKind) => Promise<void>;
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

  let disposed = false;

  const connect = async () => {
    if (status() === 'connecting' || status() === 'connected') return;
    setError(null);
    setFlashProgress(null);
    setStatus('connecting');
    let l: SerialLink | null = null;
    try {
      const port = await requestMediusPort();
      if (disposed) return;
      l = new SerialLink(port, {
        onClose: () => {
          if (link() !== l) return; // ignore a stale or superseded link
          stopHealthPolling();
          setStatus('disconnected');
          setVersion(null);
          setHealth(null);
          setError(null);
          setLink(null);
        },
      });
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
    setStatus('disconnected');
    if (l) await l.close();
  };

  const flashDevice = async (image: Uint8Array, kind: FlashKind) => {
    if (status() === 'flashing') return;
    const l = link();
    if (!l) throw new Error('Connect to the box before flashing.');
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
      setLink(null);
      setVersion(null);
      setHealth(null);
      setFlashProgress({ phase: 'done' });
      setStatus('disconnected');
    } catch (e) {
      setLink(null);
      setVersion(null);
      setHealth(null);
      setError(describeError(e));
      setStatus('error');
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
  };

  return <DashboardContext.Provider value={value}>{props.children}</DashboardContext.Provider>;
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within a DashboardProvider');
  return ctx;
}
