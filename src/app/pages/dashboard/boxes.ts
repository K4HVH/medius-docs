/// <reference types="w3c-web-serial" />
import { type Accessor, createEffect, createMemo, createSignal, onCleanup, untrack } from 'solid-js';
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
  requestMediusPort,
} from '../../../dashboard/serial';
import type { StatsSink } from '../../../dashboard/stats';
import { type BoxSession, type SessionControl, boxId, createBoxSession } from './session';
import { type BoxIcon, type BoxStore, NEW_BOX, STORE_KEY } from './store';

export { NEW_BOX } from './store';

export interface BoxEntry {
  readonly key: string;
  session: BoxSession;
}

interface Entry extends BoxEntry {
  setKey: (key: string) => void;
  ctl: SessionControl;
}

export type AddResult = { ok: true; entry: BoxEntry } | { ok: false; verdict: ConnectVerdict };

export interface Snapshot {
  answering: ReadonlySet<string>;
  all: ReadonlySet<string>;
}

export interface Boxes {
  supported: boolean;
  secure: boolean;
  start: () => void;
  entries: Accessor<BoxEntry[]>;
  selected: Accessor<BoxEntry | null>;
  // The selected session, else a blank one whose Connect opens the chooser.
  scope: Accessor<BoxSession>;
  select: (key: string) => void;
  add: () => Promise<AddResult>;
  rescan: () => Promise<void>;
  snapshot: () => Snapshot;
  connectNew: (before: Snapshot) => Promise<ConnectVerdict | null>;
  anyUpdating: Accessor<boolean>;
  icon: (key: string) => BoxIcon;
  setIcon: (key: string, icon: BoxIcon) => void;
}

export interface SerialLike {
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: 'connect' | 'disconnect', fn: (ev: Event) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', fn: (ev: Event) => void): void;
}

export interface LocksLike {
  request(name: string, opts: { ifAvailable: true }, cb: (lock: unknown) => unknown): Promise<unknown>;
}

export interface BoxesDeps {
  serial: SerialLike | null;
  store: BoxStore;
  supported: boolean;
  secure: boolean;
  nativeFlashing: Accessor<boolean>;
  locks?: LocksLike;
  probe?: (port: SerialPort) => Promise<Probe>;
  makeLink?: (port: SerialPort, events: SerialLinkEvents) => SerialLink;
  choose?: () => Promise<SerialPort>;
  stats?: StatsSink;
}

const isControlPort = (p: SerialPort) => {
  const i = p.getInfo();
  return i.usbVendorId === WCH_VID && i.usbProductId === CH343_PID;
};

const isPortKey = (key: string) => key.startsWith('port:');

const versionOf = (p: Probe | null): Version | null => (p && 'version' in p ? p.version : null);

// Connected, or answered a probe on any protocol this page can reach, a newer one included.
const answers = (s: BoxSession): boolean => {
  if (s.status() === 'connected') return true;
  const p = s.probe();
  return s.status() === 'disconnected' && p?.kind === 'box';
};

const REPLUG_TRIES = 4;
const REPLUG_FIRST_MS = 1000;

// Call inside a reactive owner; its cleanup releases every port.
export function createBoxes(deps: BoxesDeps): Boxes {
  const probeFn = deps.probe ?? ((p: SerialPort) => probePort(p));
  const choose = deps.choose ?? requestMediusPort;
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [selKey, setSelKey] = createSignal<string | null>(deps.store.selected());
  const [icons, setIcons] = createSignal(deps.store.icons());
  const portKeys = new Map<SerialPort, string>();
  const present = new Set<SerialPort>();
  const probing = new Map<SerialPort, Promise<void>>();
  const chains = new Map<SerialPort, Promise<unknown>>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let counter = 0;
  let started = false;
  let disposed = false;

  const byKey = (k: string) => entries().find((e) => e.key === k);
  const byPort = (p: SerialPort) => {
    const k = portKeys.get(p);
    return k === undefined ? undefined : byKey(k);
  };
  const bySession = (s: BoxSession) => entries().find((e) => e.session === s);
  const busyWith = (e: Entry) => e.session.status() !== 'disconnected' || e.session.identifying();
  const remembered = (mac: string) => deps.store.held().some((h) => h.mac === mac);
  const setIcon = (key: string, icon: BoxIcon) => {
    deps.store.setIcon(key, icon);
    setIcons(deps.store.icons());
  };

  // One open per port at a time.
  const exclusive = <T,>(port: SerialPort, fn: () => Promise<T>): Promise<T> => {
    const run = (chains.get(port) ?? Promise.resolve()).then(fn);
    const tail = run.catch(() => undefined);
    chains.set(port, tail);
    void tail.then(() => {
      if (chains.get(port) === tail) chains.delete(port);
    });
    return run;
  };

  const claim = (mac: string): Promise<(() => void) | null> => {
    const locks = deps.locks;
    if (!locks) return Promise.resolve(() => {});
    return new Promise((resolve) => {
      void locks.request(`medius-box:${mac}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        return new Promise<void>((release) => resolve(() => release()));
      });
    });
  };

  const choosing = (key: string) => {
    setSelKey(key);
    if (!isPortKey(key) && key !== NEW_BOX) deps.store.setSelected(key);
  };

  const remove = (e: Entry) => {
    setEntries((list) => list.filter((x) => x !== e));
    for (const [p, k] of portKeys) if (k === e.key) portKeys.delete(p);
    e.ctl.dispose();
  };

  // In place: the list's row, and its focus, belong to this object.
  const rekey = (e: Entry, key: string) => {
    for (const [p, k] of portKeys) if (k === e.key) portKeys.set(p, key);
    const wasSelected = selKey() === e.key;
    e.setKey(key);
    if (wasSelected) choosing(key);
  };

  const absorb = (e: Entry, into: Entry) => {
    const wasSelected = selKey() === e.key;
    remove(e);
    if (wasSelected) choosing(into.key);
  };

  // False hands the port to whichever entry owns the box that answered on it.
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
      // Same MAC on two ports: keep the first.
      if (op && op !== port) return false;
      const wasSelected = selKey() === other.key;
      remove(other);
      rekey(self, mac);
      if (wasSelected) choosing(mac);
    } else rekey(self, mac);
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
        exclusive,
        claim,
        acquire: async () => {
          const r = await add();
          return r.ok ? null : r.verdict;
        },
        seen: (p, pr) => seen(api, p, pr),
        held: (mac, name) => deps.store.hold(mac, name),
        released: (mac) => {
          deps.store.release(mac);
          const e = bySession(api);
          if (e && !e.ctl.port()) remove(e);
        },
        forgotten: (mac) => setIcon(mac, 'box'),
        report: deps.stats,
      },
    );
    api = made.api;
    const [k, setKey] = createSignal(key);
    return {
      get key() {
        return k();
      },
      setKey,
      session: made.api,
      ctl: made.ctl,
    };
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

  const place = (port: SerialPort, pr: Probe) => {
    if (disposed || !present.has(port)) return;
    const mac = boxId(versionOf(pr));
    let e = byPort(port);
    if (!mac) {
      (e ?? listPort(port)).ctl.setProbe(pr);
      return;
    }
    if (e && e.key !== mac && e.ctl.mac() !== null) {
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
      if (e) absorb(e, owner);
      e = owner;
      e.ctl.setPort(port);
      portKeys.set(port, mac);
    } else if (e) {
      if (e.key !== mac) rekey(e, mac);
    } else {
      e = make(mac, port, null);
      portKeys.set(port, mac);
      setEntries((list) => [...list, e!]);
    }
    e.ctl.setProbe(pr);
    if (pr.kind === 'box' && remembered(mac) && e.session.status() === 'disconnected') void e.session.connect();
  };

  const probe = (port: SerialPort): Promise<void> => {
    if (deps.nativeFlashing()) return Promise.resolve();
    const running = probing.get(port);
    if (running) return running;
    const run = exclusive(port, async () => {
      // A session may have taken the port while this waited its turn.
      const e = byPort(port);
      if (e && busyWith(e)) return;
      let pr: Probe;
      try {
        pr = await probeFn(port);
      } catch (err) {
        pr = probeFromError(err);
      }
      place(port, pr);
    }).finally(() => probing.delete(port));
    probing.set(port, run);
    return run;
  };

  const heldWithoutPort = () => entries().some((e) => e.session.held() && !e.ctl.port());

  // A held box replugged while it boots is silent at first.
  const retryNew = (port: SerialPort, left = REPLUG_TRIES, wait = REPLUG_FIRST_MS) => {
    const t = setTimeout(() => {
      timers.delete(t);
      const e = byPort(port);
      if (disposed || !present.has(port) || !e || e.ctl.mac() !== null || !heldWithoutPort()) return;
      void probe(port).then(() => {
        if (left > 1) retryNew(port, left - 1, wait * 2);
      });
    }, wait);
    timers.add(t);
  };

  const open = async (s: BoxSession) => {
    if (deps.nativeFlashing()) return;
    const e = bySession(s);
    const p = e?.ctl.port();
    if (!e || !p || s.status() !== 'disconnected') return;
    await probing.get(p);
    if (s.probe()?.kind !== 'box') await probe(p);
    if (s.probe()?.kind === 'box') await s.connect();
  };

  const select = (key: string) => choosing(key);

  const add = async (): Promise<AddResult> => {
    if (!deps.serial) return { ok: false, verdict: { kind: 'unsupported' } };
    if (deps.nativeFlashing()) return { ok: false, verdict: { kind: 'busy' } };
    let port: SerialPort;
    try {
      port = await choose();
    } catch (err) {
      return { ok: false, verdict: classifyConnectError(err) };
    }
    present.add(port);
    listPort(port);
    await probe(port);
    // The probe may have merged it into a remembered entry.
    const e = byPort(port);
    if (!e) return { ok: false, verdict: { kind: 'other', message: 'The port went away' } };
    choosing(e.key);
    await open(e.session);
    return { ok: true, entry: e };
  };

  const rescan = async () => {
    await Promise.all([...present].map((p) => probe(p)));
  };

  const snapshot = (): Snapshot => ({
    answering: new Set(entries().filter((e) => answers(e.session)).map((e) => e.key)),
    all: new Set(entries().map((e) => e.key)),
  });

  const connectNew = async (before: Snapshot): Promise<ConnectVerdict | null> => {
    await rescan();
    const now = (e: Entry) => answers(e.session) || e.session.status() === 'connecting';
    const fresh = entries().find((e) => !before.answering.has(e.key) && now(e));
    if (fresh) {
      choosing(fresh.key);
      await fresh.ctl.settled();
      await open(fresh.session);
      return fresh.session.status() === 'connected' ? null : fresh.session.verdict();
    }
    // A single port that appeared during the install is the box installed, whatever it says.
    const appeared = entries().filter((e) => !before.all.has(e.key) && e.session.status() !== 'connected');
    if (appeared.length === 1) {
      const v = appeared[0].session.verdict();
      if (v) {
        choosing(appeared[0].key);
        return v;
      }
    }
    const r = await add();
    if (!r.ok) return r.verdict;
    const s = r.entry.session;
    return s.status() === 'connected' ? null : (s.verdict() ?? { kind: 'silent' });
  };

  const selected = createMemo<BoxEntry | null>(() => {
    const list = entries();
    const k = selKey();
    if (k === NEW_BOX) return null;
    return (
      (k !== null ? list.find((e) => e.key === k) : undefined) ??
      list.find((e) => e.session.held()) ??
      list.find((e) => e.session.probe()?.kind === 'box') ??
      list.find((e) => !isPortKey(e.key)) ??
      null
    );
  });

  const blank = createBoxSession(
    { port: null },
    {
      supported: deps.supported,
      secure: deps.secure,
      nativeFlashing: deps.nativeFlashing,
      acquire: async () => {
        const r = await add();
        return r.ok ? null : r.verdict;
      },
    },
  );
  // With nothing listed, the blank card says why a plugged-in port isn't a box yet. Not plain silence: a
  // CH343 that isn't a box (the sim's adapter) is silent too.
  createEffect(() => {
    const none = entries().every((e) => isPortKey(e.key));
    const stuck = none
      ? (entries()
          .map((e) => e.session.probe())
          .find((p) => p?.kind === 'unreadable' || p?.kind === 'busy') ?? null)
      : null;
    untrack(() => blank.ctl.setProbe(stuck));
  });

  const onConnect = (ev: Event) => {
    const p = ev.target as SerialPort;
    if (!isControlPort(p)) return;
    present.add(p);
    listPort(p);
    void probe(p).then(() => {
      if (byPort(p)?.ctl.mac() === null && heldWithoutPort()) retryNew(p);
    });
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
  // Busy ports only: a probe writes to whatever is behind the adapter.
  const onFocus = () => {
    for (const e of entries()) {
      const p = e.ctl.port();
      if (p && e.session.probe()?.kind === 'busy' && !busyWith(e)) void probe(p);
    }
  };
  const onVisible = () => {
    if (!document.hidden) onFocus();
  };
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === STORE_KEY || ev.key === null) setIcons(deps.store.icons());
  };

  const start = () => {
    if (started || disposed) return;
    started = true;
    deps.serial?.addEventListener('connect', onConnect);
    deps.serial?.addEventListener('disconnect', onDisconnect);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
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
  };

  onCleanup(() => {
    disposed = true;
    for (const t of timers) clearTimeout(t);
    if (started) {
      deps.serial?.removeEventListener('connect', onConnect);
      deps.serial?.removeEventListener('disconnect', onDisconnect);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    }
    for (const e of entries()) e.ctl.dispose();
    blank.ctl.dispose();
  });

  return {
    supported: deps.supported,
    secure: deps.secure,
    start,
    entries,
    selected,
    scope: () => selected()?.session ?? blank.api,
    select,
    add,
    rescan,
    snapshot,
    connectNew,
    anyUpdating: () => entries().some((e) => e.session.status() === 'flashing'),
    icon: (key) => icons()[key] ?? 'box',
    setIcon,
  };
}
