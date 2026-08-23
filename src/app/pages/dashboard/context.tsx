/// <reference types="w3c-web-serial" />
import {
  type Accessor,
  type ParentComponent,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import {
  type CatchEvent,
  type Health,
  type LogLine,
  type Version,
  LogLevel,
  RebootTarget,
  type FirmwareInfo,
  OTA_TGT_DEVICE,
  OTA_TGT_HOST,
} from "../../../dashboard/protocol";
import {
  BadProtoVerError,
  NoReplyError,
  SerialLink,
  isSecureContextOk,
  isWebSerialSupported,
  requestMediusPort,
} from "../../../dashboard/serial";
import type { FlashKind, FlashProgress } from "../../../dashboard/flash";
import { type Poller, createPoller } from "./poll";

export type ConnectionStatus =
  "disconnected" | "connecting" | "connected" | "error" | "flashing";

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
  health: Accessor<Health | null>;
  error: Accessor<string | null>;
  link: Accessor<SerialLink | null>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  // Subscribe a card to one box readback for as long as it is mounted. The poller owns the timer
  // and shares one query across every card that wants the same value.
  poll: Poller["subscribe"];
  // Re-read a value now. Call it straight after writing that value, so the readout shows what was
  // just set instead of the previous value until the next tick.
  refreshPoll: Poller["refresh"];
  flashProgress: Accessor<FlashProgress | null>;
  flashLog: Accessor<string[]>;
  rebootDeviceToDownload: () => Promise<SerialPort>;
  firmwareInfo: Accessor<FirmwareInfo | null>;
  readFirmwareInfo: () => Promise<FirmwareInfo | null>;
  updateOverControl: (images: {
    device?: Uint8Array;
    host?: Uint8Array;
  }) => Promise<boolean>;
  flashDeviceNative: (
    romPort: SerialPort,
    ctrlPort: SerialPort,
    image: Uint8Array,
    kind: FlashKind,
  ) => Promise<boolean>;
  flashNative: (
    port: SerialPort,
    image: Uint8Array,
    kind: FlashKind,
  ) => Promise<boolean>;
  clearFlashResult: () => void;
  deviceLog: Accessor<string[]>;
  clearDeviceLog: () => void;
  inputEvents: Accessor<InputEventEntry[]>;
  clearInputEvents: () => void;
}

function formatLogLine(line: LogLine): string {
  return `[${LogLevel[line.level]}] ${line.text}`;
}

// Exported so a card can be mounted against a stand-in value without opening a serial port.
export const DashboardContext = createContext<DashboardContextValue>();

function isUserCancel(e: unknown): boolean {
  return e instanceof DOMException && e.name === "NotFoundError";
}

function describeError(e: unknown): string {
  if (e instanceof BadProtoVerError) {
    return `This device speaks protocol v${e.got}, which this dashboard does not support.`;
  }
  if (e instanceof NoReplyError) {
    return "No reply from the box. Make sure the control cable is on the right port and that this is a Medius box.";
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export const DashboardProvider: ParentComponent = (props) => {
  const supported = isWebSerialSupported();
  const secure = isSecureContextOk();
  const [status, setStatus] = createSignal<ConnectionStatus>("disconnected");
  const [version, setVersion] = createSignal<Version | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [link, setLink] = createSignal<SerialLink | null>(null);
  const [flashProgress, setFlashProgress] = createSignal<FlashProgress | null>(
    null,
  );
  const [firmwareInfo, setFirmwareInfo] = createSignal<FirmwareInfo | null>(
    null,
  );
  const [flashLog, setFlashLog] = createSignal<string[]>([]);
  const [deviceLog, setDeviceLog] = createSignal<string[]>([]);
  const [inputEvents, setInputEvents] = createSignal<InputEventEntry[]>([]);

  // Every card's readback runs through one poller. It is fed a derived link rather than `link`
  // itself so a flash silences it in one place: during a flash esptool owns a port and the control
  // link must not be touched, and there is no start/stop call left to forget at a new call site.
  const poller = createPoller(() => (status() === "flashing" ? null : link()));
  // The poller keeps health polled on its own as the link keepalive; this subscription is only for
  // reading the value.
  const health = poller.subscribe("health");

  const makeLink = (port: SerialPort): SerialLink => {
    const nl: SerialLink = new SerialLink(port, {
      onLog: (ln) =>
        setDeviceLog((prev) => [...prev, formatLogLine(ln)].slice(-500)),
      onEvent: (ev, seq) =>
        setInputEvents((prev) => [...prev, { seq, ev }].slice(-200)),
      onClose: () => {
        if (link() !== nl) return;
        setStatus("disconnected");
        setVersion(null);
        setError(null);
        setLink(null);
        poller.reset();
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
        setStatus("connected");
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
    if (status() === "connecting" || status() === "connected") return;
    setError(null);
    setFlashProgress(null);
    setDeviceLog([]);
    setInputEvents([]);
    setStatus("connecting");
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
      // Cleared before the cards mount, so each slot is queried once rather than by both the reset
      // and the first subscriber.
      poller.reset();
      setStatus("connected");
    } catch (e) {
      if (l) {
        try {
          await l.close();
        } catch {
          // ignore
        }
      }
      if (isUserCancel(e)) {
        setStatus("disconnected");
        return;
      }
      setError(describeError(e));
      setStatus("error");
    }
  };

  const disconnect = async () => {
    const l = link();
    // Status first. The cards unmount on it, and their cleanup releases what they are holding over
    // a link that is still open; dropping the link first left every hold set on the game PC until
    // the box's own silence timer caught it a second later.
    setStatus("disconnected");
    setLink(null);
    setVersion(null);
    setError(null);
    poller.reset();
    setFlashProgress(null);
    if (l) await l.close();
  };

  const clearFlashResult = () => setFlashProgress(null);
  const clearDeviceLog = () => setDeviceLog([]);
  const clearInputEvents = () => setInputEvents([]);

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
  }): Promise<boolean> => {
    const l = link();
    if (!l) {
      setError("Connect to the box before updating.");
      return false;
    }
    if (!images.device && !images.host) return false;
    setError(null);
    setFlashLog([]);
    setStatus("flashing");
    const ctrlPort = l.serialPort;
    try {
      // The host chip first: its image travels through the device chip, so it has to be staged while
      // the device chip is still running the firmware that can relay it.
      if (images.host) {
        setFlashProgress({
          phase: "writing",
          written: 0,
          total: images.host.length,
        });
        await l.stageFirmware(OTA_TGT_HOST, images.host, (written, total) =>
          setFlashProgress({ phase: "writing", written, total }),
        );
      }
      if (images.device) {
        setFlashProgress({
          phase: "writing",
          written: 0,
          total: images.device.length,
        });
        await l.stageFirmware(OTA_TGT_DEVICE, images.device, (written, total) =>
          setFlashProgress({ phase: "writing", written, total }),
        );
      }
      setFlashProgress({ phase: "connecting" });
      await l.activateFirmware();
      // The device chip reboots a moment after it answers, so the link this call rode is gone.
      setLink(null);
      setVersion(null);
      poller.reset();
      await l.close().catch(() => undefined);
      const reconnected = await tryReconnect(ctrlPort);
      setFlashProgress({ phase: "done" });
      if (!reconnected) {
        setStatus("disconnected");
      } else {
        await readFirmwareInfo();
      }
      return true;
    } catch (e) {
      // A refused activate stops at the host chip, and the device image stays staged and armed: the
      // next activate would commit it alone and leave the two chips on different versions. Disarm it
      // before giving up. Best-effort, because the usual reason we are here is that the box is gone.
      try {
        if (images.device) await l.abortUpdate(OTA_TGT_DEVICE);
        if (images.host) await l.abortUpdate(OTA_TGT_HOST);
      } catch {
        /* nothing more to do about it than say what failed first */
      }
      setError(describeError(e));
      setStatus("error");
      return false;
    }
  };

  // Reboot the device chip into ROM download over the control link, then close
  // it. The chip re-enumerates on its native USB (0x303a); the returned CH343
  // port is reused to reconnect and verify once the new firmware is running.
  const rebootDeviceToDownload = async (): Promise<SerialPort> => {
    const l = link();
    if (!l) throw new Error("Connect to the box before updating.");
    const ctrlPort = l.serialPort;
    setError(null);
    setFlashLog([]);
    setLink(null);
    setVersion(null);
    poller.reset();
    await l.reboot(RebootTarget.DeviceDownload);
    await l.close();
    // The control link is down and the chip is in ROM download; report it as
    // disconnected (not flashing) so the UI can show the port-grant step.
    setStatus("disconnected");
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
    if (status() === "flashing") return false;
    setError(null);
    setFlashLog([]);
    setFlashProgress({ phase: "connecting" });
    setStatus("flashing");
    try {
      const { flashNativePort } =
        await import("../../../dashboard/flash/flasher");
      await flashNativePort({
        port: romPort,
        image,
        kind,
        onProgress: (p) => setFlashProgress(p),
        onLog: (line) => setFlashLog((prev) => [...prev, line].slice(-500)),
      });
      setFlashProgress({ phase: "done" });
      const reconnected = await tryReconnect(ctrlPort);
      if (!reconnected) {
        setLink(null);
        setVersion(null);
        poller.reset();
        setStatus("disconnected");
      }
      return true;
    } catch (e) {
      setLink(null);
      setVersion(null);
      poller.reset();
      setError(describeError(e));
      setStatus("error");
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
    if (status() === "flashing") return false;
    const hadLink = link();
    setError(null);
    setFlashLog([]);
    setFlashProgress({ phase: "connecting" });
    setStatus("flashing");
    try {
      const { flashNativePort } =
        await import("../../../dashboard/flash/flasher");
      await flashNativePort({
        port,
        image,
        kind,
        onProgress: (p) => setFlashProgress(p),
        onLog: (line) => setFlashLog((prev) => [...prev, line].slice(-500)),
      });
      setFlashProgress({ phase: "done" });
      setStatus(hadLink ? "connected" : "disconnected");
      return true;
    } catch (e) {
      setError(describeError(e));
      setStatus(hadLink ? "connected" : "error");
      return false;
    }
  };

  // Block tab close / refresh during a flash; esptool cannot survive it.
  createEffect(() => {
    if (status() !== "flashing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    onCleanup(() => window.removeEventListener("beforeunload", handler));
  });

  onCleanup(() => {
    disposed = true;
    // Never close the port mid-flash; esptool owns it during the handoff.
    if (status() !== "flashing") void link()?.close();
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
    poll: poller.subscribe,
    refreshPoll: poller.refresh,
    flashProgress,
    flashLog,
    rebootDeviceToDownload,
    firmwareInfo,
    readFirmwareInfo,
    updateOverControl,
    flashDeviceNative,
    flashNative,
    clearFlashResult,
    deviceLog,
    clearDeviceLog,
    inputEvents,
    clearInputEvents,
  };

  return (
    <DashboardContext.Provider value={value}>
      {props.children}
    </DashboardContext.Provider>
  );
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within a DashboardProvider");
  return ctx;
}
