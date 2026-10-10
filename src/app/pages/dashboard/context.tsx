/// <reference types="w3c-web-serial" />
import {
  type Accessor,
  type ParentComponent,
  Show,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  useContext,
} from 'solid-js';
import { isSecureContextOk, isWebSerialSupported } from '../../../dashboard/serial/support';
import { createStatsSink } from '../../../dashboard/stats';
import type { Boxes, BoxesDeps, LocksLike } from './boxes';

export { NEW_BOX } from './store';
import { type NativeFlash, createNativeFlash } from './nativeFlash';
import type { BoxSession } from './session';
import { createBoxStore } from './store';

export type { ConnectVerdict } from '../../../dashboard/serial';
export type { BoxSession, ConnectionStatus, InputEventEntry, UpdateRun } from './session';
export type { AddResult, BoxEntry, Boxes, Snapshot } from './boxes';
export type { NativeFlash } from './nativeFlash';
export type DashboardContextValue = BoxSession;

// Exported so a card or page can mount against a stand-in value.
export const DashboardContext = createContext<DashboardContextValue>();
export const BoxesContext = createContext<Boxes>();
export const NativeFlashContext = createContext<NativeFlash>();

const localStore = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

// A flash or an update doesn't survive the tab closing.
export function guardUnload(busy: Accessor<boolean>): void {
  createEffect(() => {
    if (!busy()) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    onCleanup(() => window.removeEventListener('beforeunload', handler));
  });
}

// The box runtime (sessions, the serial link, the protocol), fetched with the dashboard's pages, never
// with a docs page alone.
const [runtime, setRuntime] = createSignal<typeof import('./boxes') | null>(null);
let fetching: Promise<unknown> | null = null;
export const loadRuntime = (): Promise<unknown> =>
  (fetching ??= import('./boxes').then(
    (m) => setRuntime(() => m),
    (e: unknown) => {
      fetching = null;
      throw e;
    },
  ));

export const DashboardProvider: ParentComponent = (props) => {
  const supported = isWebSerialSupported();
  const secure = isSecureContextOk();
  // Unit tests mount this provider; their fake boxes must not be counted.
  const stats = import.meta.env.MODE === 'test' ? undefined : createStatsSink();
  const native = createNativeFlash(stats);
  const store = createBoxStore(localStore());
  const deps: BoxesDeps = {
    serial: supported && secure ? navigator.serial : null,
    store,
    supported,
    secure,
    nativeFlashing: native.running,
    locks: typeof navigator !== 'undefined' && navigator.locks ? (navigator.locks as LocksLike) : undefined,
    stats,
    // The dev server's fake box (`?fakebox`), set by index.tsx; a production build never sets it.
    ...(import.meta.env.DEV ? (globalThis as { __mediusDevBox?: Partial<BoxesDeps> }).__mediusDevBox : undefined),
  };
  // Built once the runtime is in: at once when a dashboard page brought it before the first render.
  const real = createMemo(() => {
    const m = runtime();
    return m ? untrack(() => m.createBoxes(deps)) : null;
  });
  const ready = (): Promise<Boxes> => loadRuntime().then(() => real()!);
  // Until then, no boxes: the sidebar lists none, the first thing that needs one fetches the runtime, and
  // only a page under BoxScope, which the dashboard's pages bring the runtime with, asks for a session.
  const boxes: Boxes = {
    supported: deps.supported,
    secure: deps.secure,
    start: () => void ready().then((b) => b.start()),
    entries: () => real()?.entries() ?? [],
    selected: () => real()?.selected() ?? null,
    scope: () => {
      const b = real();
      if (!b) throw new Error('no box session before the box runtime is in');
      return b.scope();
    },
    select: (key) => real()?.select(key),
    add: () => ready().then((b) => b.add()),
    rescan: () => ready().then((b) => b.rescan()),
    snapshot: () => real()?.snapshot() ?? { answering: new Set(), all: new Set() },
    connectNew: (before) => ready().then((b) => b.connectNew(before)),
    anyUpdating: () => real()?.anyUpdating() ?? false,
    icon: (key) => real()?.icon(key) ?? 'box',
    setIcon: (key, icon) => real()?.setIcon(key, icon),
  };
  guardUnload(() => native.running() || boxes.anyUpdating());

  return (
    <NativeFlashContext.Provider value={native}>
      <BoxesContext.Provider value={boxes}>{props.children}</BoxesContext.Provider>
    </NativeFlashContext.Provider>
  );
};

// Keyed on the session, so a box switch remounts the pages and moves every poll.
export const BoxScope: ParentComponent = (props) => {
  const boxes = useBoxes();
  return (
    <Show when={boxes.scope()} keyed>
      {(s) => <DashboardContext.Provider value={s}>{props.children}</DashboardContext.Provider>}
    </Show>
  );
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within a BoxScope');
  return ctx;
}

export function useBoxes(): Boxes {
  const ctx = useContext(BoxesContext);
  if (!ctx) throw new Error('useBoxes must be used within a DashboardProvider');
  return ctx;
}

export function useNativeFlash(): NativeFlash {
  const ctx = useContext(NativeFlashContext);
  if (!ctx) throw new Error('useNativeFlash must be used within a DashboardProvider');
  return ctx;
}
