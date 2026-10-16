import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { DashboardProvider, type Boxes, useBoxes } from '../../src/app/pages/dashboard/context';

// The box runtime is fetched with the dashboard, not with a docs page. A file apart from the other tests, so
// the runtime starts unloaded.

let boxes: Boxes;
const Probe = () => {
  boxes = useBoxes();
  return null;
};
const mount = () => render(() => <DashboardProvider><Probe /></DashboardProvider>);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  delete (globalThis as { __mediusDevBox?: unknown }).__mediusDevBox;
});

describe('DashboardProvider before the box runtime is in', () => {
  it('lists no boxes, has no session, and is updating nothing', () => {
    mount();
    expect(boxes.entries()).toEqual([]);
    expect(boxes.selected()).toBeNull();
    expect(() => boxes.scope()).toThrow(/box runtime/);
    expect(boxes.anyUpdating()).toBe(false);
    expect(boxes.snapshot().all.size).toBe(0);
  });

  it('takes whether the browser can reach a box from what the page was given, as the boxes inside do', () => {
    (globalThis as { __mediusDevBox?: unknown }).__mediusDevBox = { supported: false, secure: false };
    mount();
    expect(boxes.supported).toBe(false);
    expect(boxes.secure).toBe(false);
  });

  it('leaves the runtime unfetched on a page that is not the dashboard, even with boxes kept from an earlier visit', async () => {
    localStorage.setItem('medius.dashboard.boxes', JSON.stringify({ selected: null, held: [{ mac: '58:8C:81:00:00:01', name: 'Desk' }], icons: {} }));
    vi.stubGlobal('requestIdleCallback', (f: () => void) => (setTimeout(f, 0), 1));
    mount();
    await new Promise((r) => setTimeout(r, 100));
    expect(() => boxes.scope()).toThrow(/box runtime/);
  });

  it('fetches the runtime when the dashboard starts it, and from then on is the real thing', async () => {
    mount();
    boxes.start();
    await waitFor(() => expect(boxes.scope()).toBeDefined());
    expect(typeof boxes.scope().connect).toBe('function');
  });
});
