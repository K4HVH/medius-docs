import { describe, it, expect } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { guardUnload } from '../../src/app/pages/dashboard/context';

const leave = () => {
  const ev = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
};

describe('guardUnload', () => {
  it('asks before the tab closes only while something is being written', () => {
    const { setBusy, dispose } = createRoot((dispose) => {
      const [busy, setBusy] = createSignal(false);
      guardUnload(busy);
      return { setBusy, dispose };
    });
    expect(leave()).toBe(false);
    setBusy(true);
    expect(leave()).toBe(true);
    setBusy(false);
    expect(leave()).toBe(false);
    setBusy(true);
    dispose();
    expect(leave()).toBe(false);
  });
});
