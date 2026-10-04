/// <reference types="w3c-web-serial" />
import {
  type ParentComponent,
  Show,
  createContext,
  createEffect,
  onCleanup,
  useContext,
} from 'solid-js';
import { isSecureContextOk, isWebSerialSupported } from '../../../dashboard/serial';
import { type Boxes, createBoxes } from './boxes';
import { type NativeFlash, createNativeFlash } from './nativeFlash';
import type { BoxSession } from './session';
import { createBoxStore } from './store';

export type { ConnectVerdict } from '../../../dashboard/serial';
export type { BoxSession, ConnectionStatus, InputEventEntry, UpdateRun } from './session';
export type { BoxEntry, Boxes } from './boxes';
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

export const DashboardProvider: ParentComponent = (props) => {
  const supported = isWebSerialSupported();
  const secure = isSecureContextOk();
  const native = createNativeFlash();
  const boxes = createBoxes({
    serial: supported && secure ? navigator.serial : null,
    store: createBoxStore(localStore()),
    supported,
    secure,
    nativeFlashing: native.running,
  });

  // Block tab close / refresh during a flash or an update; neither survives it.
  createEffect(() => {
    if (!native.running() && !boxes.anyUpdating()) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    onCleanup(() => window.removeEventListener('beforeunload', handler));
  });

  return (
    <NativeFlashContext.Provider value={native}>
      <BoxesContext.Provider value={boxes}>{props.children}</BoxesContext.Provider>
    </NativeFlashContext.Provider>
  );
};

// The selected box for everything inside; a switch remounts it, so every poll moves to the new box.
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
