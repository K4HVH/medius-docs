import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { createRoot } from 'solid-js';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { BoxScope, BoxesContext, useDashboard } from '../../src/app/pages/dashboard/context';
import { type Boxes, createBoxes } from '../../src/app/pages/dashboard/boxes';
import { createBoxStore } from '../../src/app/pages/dashboard/store';
import { probePort } from '../../src/dashboard/serial';
import { FakeBox, FakePort, FakeSerial, makeFakeLink, settle } from './fake-boxes';

let disposeBoxes: (() => void) | null = null;

const mountBoxes = (serial: FakeSerial): Boxes =>
  createRoot((dispose) => {
    disposeBoxes = dispose;
    const b = createBoxes({
      serial,
      store: createBoxStore(null),
      supported: true,
      secure: true,
      nativeFlashing: () => false,
      probe: (p) => probePort(p, (pp) => makeFakeLink(pp, {})),
      makeLink: makeFakeLink,
    });
    b.start();
    return b;
  });

const ready = async () => {
  await settle();
  await vi.advanceTimersByTimeAsync(0);
  await settle();
};

const LocksCard = () => {
  const dash = useDashboard();
  dash.poll('locks', 100);
  return <span data-testid="name">{dash.name()}</span>;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  disposeBoxes?.();
  vi.useRealTimers();
});

describe('Flash and BoxScope', () => {
  it('Flash is not inside BoxScope, so a box coming or going never resets a ROM flash half set up', () => {
    // Unplugging USB2 for a ROM flash removes an unheld box and moves the selection: inside BoxScope
    // that remounted the form and put Chip back on the main chip. Flash scopes its USB2 form alone.
    const app = readFileSync('src/app/App.tsx', 'utf8');
    const scope = app.slice(app.indexOf('component={BoxScope}>'));
    const inside = scope.slice(0, scope.indexOf('</Route>'));
    expect(inside).not.toContain('/dashboard/flash/');
    expect(app).toMatch(/<Route path="\/dashboard\/flash\/:place\?" component=\{[^}]+\} \/>/);
    const flash = readFileSync('src/app/pages/dashboard/Flash.tsx', 'utf8');
    const scoped = [...flash.matchAll(/<BoxScope>([\s\S]*?)<\/BoxScope>/g)].map((m) => m[1]);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]).toContain('<Usb2Flash');
  });
});

describe('BoxScope', () => {
  it('moves every card to the box selected, and leaves nothing polling the one before', async () => {
    const a = new FakeBox({ mac: [1, 1, 1, 1, 1, 1], name: 'Left' });
    const b = new FakeBox({ mac: [2, 2, 2, 2, 2, 2], name: 'Right' });
    const boxes = mountBoxes(new FakeSerial([new FakePort(a), new FakePort(b)]));
    await ready();
    const { getByTestId } = render(() => (
      <BoxesContext.Provider value={boxes}>
        <BoxScope>
          <LocksCard />
        </BoxScope>
      </BoxesContext.Provider>
    ));
    boxes.select(a.mac);
    await boxes.scope().connect();
    await ready();
    await vi.advanceTimersByTimeAsync(500);
    expect(getByTestId('name').textContent).toBe('Left');
    expect(a.locksQueries).toBeGreaterThan(0);

    boxes.select(b.mac);
    await boxes.scope().connect();
    await ready();
    const aBefore = a.locksQueries;
    await vi.advanceTimersByTimeAsync(1000);
    expect(getByTestId('name').textContent).toBe('Right');
    expect(b.locksQueries).toBeGreaterThan(0);
    expect(a.locksQueries).toBe(aBefore);
    expect(boxes.entries()[0].session.status()).toBe('connected');
  });

  it('a box switch remounts the routed page', async () => {
    const a = new FakeBox({ mac: [1, 1, 1, 1, 1, 1], name: 'Left' });
    const b = new FakeBox({ mac: [2, 2, 2, 2, 2, 2], name: 'Right' });
    const boxes = mountBoxes(new FakeSerial([new FakePort(a), new FakePort(b)]));
    await ready();
    const history = createMemoryHistory();
    history.set({ value: '/box' });
    const { findByTestId } = render(() => (
      <MemoryRouter
        history={history}
        root={(p) => <BoxesContext.Provider value={boxes}>{p.children}</BoxesContext.Provider>}
      >
        <Route path="/" component={BoxScope}>
          <Route path="/box" component={LocksCard} />
        </Route>
      </MemoryRouter>
    ));
    boxes.select(a.mac);
    await boxes.scope().connect();
    await ready();
    await vi.advanceTimersByTimeAsync(500);
    expect((await findByTestId('name')).textContent).toBe('Left');
    boxes.select(b.mac);
    await boxes.scope().connect();
    await ready();
    const aBefore = a.locksQueries;
    await vi.advanceTimersByTimeAsync(1000);
    expect((await findByTestId('name')).textContent).toBe('Right');
    expect(b.locksQueries).toBeGreaterThan(0);
    expect(a.locksQueries).toBe(aBefore);
  });

  it('a card outside a scope has no box to talk to', () => {
    const Bare = () => {
      useDashboard();
      return null;
    };
    expect(() => render(() => <Bare />)).toThrow(/BoxScope/);
  });
});
