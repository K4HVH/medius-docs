/// <reference types="w3c-web-serial" />
// Every box on this PC: which port each is behind, which ones this page holds, and which one the
// tabs show. A box is known by its MAC; a port that never answered is known by its order of first
// sight.

import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js';
import type { Version } from '../../../dashboard/protocol';
import {
  CH343_PID,
  type ConnectVerdict,
  type Probe,
  type SerialLink,
  type SerialLinkEvents,
  WCH_VID,
  classifyConnectError,
  probeFromError,
  probePort,
  probeVerdict,
  requestMediusPort,
  speaksCurrentWire,
} from '../../../dashboard/serial';
import { type BoxSession, type SessionControl, boxId, createBoxSession } from './session';
import type { BoxStore } from './store';

export interface BoxEntry {
  key: string;
  session: BoxSession;
}

interface Entry extends BoxEntry {
  ctl: SessionControl;
}

export interface Boxes {
  supported: boolean;
  secure: boolean;
  entries: Accessor<BoxEntry[]>;
  selected: Accessor<BoxEntry | null>;
  // The selected box's session, or the blank one when nothing is listed.
  scope: Accessor<BoxSession>;
  select: (key: string) => void;
  add: () => Promise<ConnectVerdict | null>;
  rescan: () => Promise<void>;
  // Selects and connects the first box answering on the current wire whose key isn't in `before`.
  connectNew: (before: ReadonlySet<string>) => Promise<ConnectVerdict | null>;
  answeringKeys: () => Set<string>;
  anyUpdating: Accessor<boolean>;
}

export interface SerialLike {
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: 'connect' | 'disconnect', fn: (ev: Event) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', fn: (ev: Event) => void): void;
}

export interface BoxesDeps {
  serial: SerialLike | null;
  store: BoxStore;
  supported: boolean;
  secure: boolean;
  nativeFlashing: Accessor<boolean>;
  probe?: (port: SerialPort) => Promise<Probe>;
  makeLink?: (port: SerialPort, events: SerialLinkEvents) => SerialLink;
  choose?: () => Promise<SerialPort>;
}

const isControlPort = (p: SerialPort) => {
  const i = p.getInfo();
  return i.usbVendorId === WCH_VID && i.usbProductId === CH343_PID;
};


const versionOf = (p: Probe | null): Version | null => (p && 'version' in p ? p.version : null);

const answersCurrent = (s: BoxSession): boolean => {
  if (s.status() === 'connected') return !s.updateOnly();
  const p = s.probe();
  return s.status() === 'disconnected' && p?.kind === 'box' && speaksCurrentWire(p.version);
};

// Call inside a reactive owner; its cleanup releases every port.
export function createBoxes(deps: BoxesDeps): Boxes {
  const probeFn = deps.probe ?? ((p: SerialPort) => probePort(p));
  const choose = deps.choose ?? requestMediusPort;
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [selKey, setSelKey] = createSignal<string | null>(deps.store.selected());
  const portKeys = new Map<SerialPort, string>();
  const present = new Set<SerialPort>();
  const probing = new Map<SerialPort, Promise<void>>();
  let counter = 0;
  let disposed = false;

  const byKey = (k: string) => entries().find((e) => e.key === k);
  const byPort = (p: SerialPort) => {
    const k = portKeys.get(p);
    return k === undefined ? undefined : byKey(k);
  };
  const bySession = (s: BoxSession) => entries().find((e) => e.session === s);
  const busyWith = (e: Entry) => e.session.status() !== 'disconnected' || e.session.identifying();
  const remembered = (mac: string) => deps.store.held().some((h) => h.mac === mac);

  const remove = (e: Entry) => {
    setEntries((list) => list.filter((x) => x !== e));
    for (const [p, k] of portKeys) if (k === e.key) portKeys.delete(p);
    e.ctl.dispose();
  };

  const rekey = (e: Entry, key: string) => {
    const next: Entry = { ...e, key };
    setEntries((list) => list.map((x) => (x === e ? next : x)));
    for (const [p, k] of portKeys) if (k === e.key) portKeys.set(p, key);
    if (selKey() === e.key) {
      setSelKey(key);
      deps.store.setSelected(key);
    }
    return next;
  };

  // What a session's own attach found on its port. False hands the port to whoever owns that box.
  const seen = (s: BoxSession, port: SerialPort, pr: Probe): boolean => {
    const self = bySession(s);
    const mac = boxId(versionOf(pr));
    if (!self || !mac || self.key === mac) return !!self;
    const known = self.ctl.mac();
    if (known !== null && known !== mac) {
      portKeys.delete(port);
      queueMicrotask(() => place(port, pr));
      return false;
    }
    const other = byKey(mac);
    if (other) {
      const op = other.ctl.port();
      // One box on two ports can't happen; keep the first.
      if (op && op !== port) return false;
      remove(other);
    }
    rekey(self, mac);
    portKeys.set(port, mac);
    return true;
  };

  const make = (key: string, port: SerialPort | null, probe: Probe | null): Entry => {
    let api: BoxSession;
    const made = createBoxSession(
      { port, probe },
      {
        supported: deps.supported,
        secure: deps.secure,
        nativeFlashing: deps.nativeFlashing,
        makeLink: deps.makeLink,
        acquire: () => add(),
        seen: (p, pr) => seen(api, p, pr),
        held: (mac, name) => deps.store.hold(mac, name),
        released: (mac) => {
          deps.store.release(mac);
          const e = bySession(api);
          if (e && !e.ctl.port()) remove(e);
        },
      },
    );
    api = made.api;
    return { key, session: made.api, ctl: made.ctl };
  };

  const listPort = (port: SerialPort): Entry => {
    const known = byPort(port);
    if (known) return known;
    const key = `port:${++counter}`;
    const e = make(key, port, null);
    portKeys.set(port, key);
    setEntries((list) => [...list, e]);
    return e;
  };

  // Files a probe under the box that answered, merging into a remembered entry for it.
  const place = (port: SerialPort, pr: Probe) => {
    if (disposed || !present.has(port)) return;
    const mac = boxId(versionOf(pr));
    let e = byPort(port);
    if (!mac) {
      (e ?? listPort(port)).ctl.setProbe(pr);
      return;
    }
    if (e && e.key !== mac && e.ctl.mac() !== null) {
      // The port's last box is gone from it.
      e.ctl.setPort(null);
      portKeys.delete(port);
      if (!e.session.held()) remove(e);
      e = undefined;
    }
    const owner = byKey(mac);
    if (owner && owner !== e) {
      const op = owner.ctl.port();
      if (op && op !== port && present.has(op)) {
        if (e) remove(e);
        return;
      }
      if (e) remove(e);
      e = owner;
      e.ctl.setPort(port);
      portKeys.set(port, mac);
    } else if (e) {
      if (e.key !== mac) e = rekey(e, mac);
    } else {
      e = make(mac, port, null);
      portKeys.set(port, mac);
      setEntries((list) => [...list, e!]);
    }
    e.ctl.setProbe(pr);
    if (pr.kind === 'box' && remembered(mac) && e.session.status() === 'disconnected') void e.session.connect();
  };

  const probe = (port: SerialPort): Promise<void> => {
    const running = probing.get(port);
    if (running) return running;
    const e = byPort(port);
    if (e && busyWith(e)) return Promise.resolve();
    const run = (async () => {
      let pr: Probe;
      try {
        pr = await probeFn(port);
      } catch (err) {
        pr = probeFromError(err);
      }
      place(port, pr);
    })().finally(() => probing.delete(port));
    probing.set(port, run);
    return run;
  };

  const open = async (s: BoxSession) => {
    const e = bySession(s);
    const p = e?.ctl.port();
    if (!e || !p || s.status() !== 'disconnected') return;
    await probing.get(p);
    if (s.probe()?.kind !== 'box') await probe(p);
    if (s.probe()?.kind === 'box') await s.connect();
  };

  const select = (key: string) => {
    setSelKey(key);
    deps.store.setSelected(key);
    const e = byKey(key);
    if (e) void open(e.session);
  };

  const add = async (): Promise<ConnectVerdict | null> => {
    if (!deps.serial) return { kind: 'unsupported' };
    let port: SerialPort;
    try {
      port = await choose();
    } catch (err) {
      return classifyConnectError(err);
    }
    present.add(port);
    const s = listPort(port).session;
    await probing.get(port);
    if (s.status() === 'disconnected') await probe(port);
    const e = bySession(s);
    if (!e) return null;
    setSelKey(e.key);
    deps.store.setSelected(e.key);
    await open(s);
    return s.status() === 'connected' ? null : (s.verdict() ?? probeVerdict(s.probe()));
  };

  const rescan = async () => {
    await Promise.all([...present].map((p) => probe(p)));
  };

  const answeringKeys = () => new Set(entries().filter((e) => answersCurrent(e.session)).map((e) => e.key));

  const connectNew = async (before: ReadonlySet<string>): Promise<ConnectVerdict | null> => {
    await rescan();
    const sel = selected();
    const pick =
      entries().find((e) => !before.has(e.key) && answersCurrent(e.session)) ??
      (sel && sel.session.status() === 'connected' ? sel : undefined) ??
      entries().find((e) => answersCurrent(e.session));
    if (!pick) {
      const told = entries()
        .map((e) => probeVerdict(e.session.probe()))
        .find((v) => v && (v.kind === 'old-firmware' || v.kind === 'new-firmware' || v.kind === 'silent'));
      return told ?? add();
    }
    setSelKey(pick.key);
    deps.store.setSelected(pick.key);
    await open(pick.session);
    const s = pick.session;
    return s.status() === 'connected' ? null : (s.verdict() ?? probeVerdict(s.probe()));
  };

  const selected = createMemo<BoxEntry | null>(() => {
    const list = entries();
    const k = selKey();
    return (
      (k !== null ? list.find((e) => e.key === k) : undefined) ??
      list.find((e) => e.session.held()) ??
      list.find((e) => e.session.probe()?.kind === 'box') ??
      list[0] ??
      null
    );
  });

  const blank = createBoxSession(
    { port: null },
    { supported: deps.supported, secure: deps.secure, nativeFlashing: deps.nativeFlashing, acquire: () => add() },
  );

  const onConnect = (ev: Event) => {
    const p = ev.target as SerialPort;
    if (!isControlPort(p)) return;
    present.add(p);
    listPort(p);
    void probe(p);
  };
  const onDisconnect = (ev: Event) => {
    const p = ev.target as SerialPort;
    present.delete(p);
    const e = byPort(p);
    portKeys.delete(p);
    if (!e || e.ctl.port() !== p) return;
    if (e.session.held()) e.ctl.setPort(null);
    else remove(e);
  };
  // Another program may have let go of a busy port; a silent one is only retried on request, since a
  // probe writes to whatever is behind the adapter.
  const onFocus = () => {
    for (const e of entries()) {
      const p = e.ctl.port();
      if (p && e.session.probe()?.kind === 'busy' && !busyWith(e)) void probe(p);
    }
  };
  const onVisible = () => {
    if (!document.hidden) onFocus();
  };

  deps.serial?.addEventListener('connect', onConnect);
  deps.serial?.addEventListener('disconnect', onDisconnect);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisible);

  void (async () => {
    let ports: SerialPort[] = [];
    try {
      ports = (await deps.serial?.getPorts()) ?? [];
    } catch {
      ports = [];
    }
    if (disposed) return;
    ports = ports.filter(isControlPort);
    for (const p of ports) {
      present.add(p);
      listPort(p);
    }
    await Promise.all(ports.map((p) => probe(p)));
  })();

  onCleanup(() => {
    disposed = true;
    deps.serial?.removeEventListener('connect', onConnect);
    deps.serial?.removeEventListener('disconnect', onDisconnect);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisible);
    for (const e of entries()) e.ctl.dispose();
    blank.ctl.dispose();
  });

  return {
    supported: deps.supported,
    secure: deps.secure,
    entries,
    selected,
    scope: () => selected()?.session ?? blank.api,
    select,
    add,
    rescan,
    connectNew,
    answeringKeys,
    anyUpdating: () => entries().some((e) => e.session.status() === 'flashing'),
  };
}
