/// <reference types="w3c-web-serial" />
import {
  type Accessor,
  type ParentComponent,
  Show,
  createContext,
  createEffect,
  onCleanup,
  useContext,
} from 'solid-js';
import { isSecureContextOk, isWebSerialSupported } from '../../../dashboard/serial';
import { createStatsSink } from '../../../dashboard/stats';
import { type Boxes, type BoxesDeps, type LocksLike, createBoxes } from './boxes';

export { NEW_BOX } from './boxes';
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

export const DashboardProvider: ParentComponent = (props) => {
  const supported = isWebSerialSupported();
  const secure = isSecureContextOk();
  // Unit tests mount this provider; their fake boxes must not be counted.
  const stats = import.meta.env.MODE === 'test' ? undefined : createStatsSink();
  const native = createNativeFlash(stats);
  const boxes = createBoxes({
    serial: supported && secure ? navigator.serial : null,
    store: createBoxStore(localStore()),
    supported,
    secure,
    nativeFlashing: native.running,
    locks: typeof navigator !== 'undefined' && navigator.locks ? (navigator.locks as LocksLike) : undefined,
    stats,
    // The dev server's fake box (`?fakebox`), set by index.tsx; a production build never sets it.
    ...(import.meta.env.DEV ? (globalThis as { __mediusDevBox?: Partial<BoxesDeps> }).__mediusDevBox : undefined),
  });
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
