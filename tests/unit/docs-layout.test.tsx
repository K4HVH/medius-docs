import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import DocsLayout from '../../src/app/pages/DocsLayout';
import { BoxesContext, NativeFlashContext, type Boxes, type BoxSession, type NativeFlash } from '../../src/app/pages/dashboard/context';
import { PROTO_VER } from '../../src/dashboard/protocol';

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo ??= () => {};
});

const world = (opts: { supported?: boolean } = {}) => {
  const [running, setRunning] = createSignal(false);
  const [status, setStatus] = createSignal('connected');
  const session = {
    name: () => 'Desk',
    status,
    present: () => true,
    held: () => true,
    probe: () => null,
    version: () => ({ protoVer: PROTO_VER, fwMajor: 3, fwMinor: 4, fwPatch: 4, mac: [], name: 'Desk' }),
    updateOnly: () => false,
    updateProgress: () => null,
    identifying: () => false,
    identify: async () => {},
  } as unknown as BoxSession;
  const start = vi.fn();
  const select = vi.fn();
  const boxes = {
    supported: opts.supported ?? true,
    secure: true,
    start,
    entries: () => [{ key: 'a', session }],
    selected: () => ({ key: 'a', session }),
    select,
    add: async () => ({ ok: false, verdict: { kind: 'no-port' } }),
    anyUpdating: () => status() === 'flashing',
  } as unknown as Boxes;
  const native = { running, progress: () => null, log: () => [], error: () => null, flash: async () => true, clear: () => {} } as unknown as NativeFlash;
  return { boxes, native, setRunning, setStatus, start, select };
};

const mount = (path: string, w = world()) => {
  const history = createMemoryHistory();
  history.set({ value: path });
  const r = render(() => (
    <MemoryRouter
      history={history}
      root={(p) => (
        <NativeFlashContext.Provider value={w.native}>
          <BoxesContext.Provider value={w.boxes}>{p.children}</BoxesContext.Provider>
        </NativeFlashContext.Provider>
      )}
    >
      <Route path="/" component={DocsLayout}>
        <Route path="/native" component={() => <p>native</p>} />
        <Route path="/dashboard" component={() => <p>device page</p>} />
        <Route path="/dashboard/setup" component={() => <p>setup page</p>} />
        <Route path="/dashboard/changelog" component={() => <p>changelog page</p>} />
      </Route>
    </MemoryRouter>
  ));
  return { ...r, history, ...w };
};

afterEach(cleanup);

const row = (r: ReturnType<typeof render>) =>
  [...r.container.querySelectorAll('button.tabs__tab')].find((b) => /Desk/.test(b.textContent ?? '')) as HTMLElement;

describe('DocsLayout and the boxes', () => {
  it('names the selected box under the title on a box tab, and not on Setup', async () => {
    const r = mount('/dashboard');
    await waitFor(() => expect(r.container.textContent).toContain('Device - Desk'));
    r.history.set({ value: '/dashboard/setup' });
    await waitFor(() => expect(r.container.textContent).toContain('setup page'));
    expect(r.container.textContent).not.toContain('Set up - Desk');
  });

  it('starts looking for boxes only once the dashboard is open', async () => {
    const r = mount('/native');
    await waitFor(() => expect(r.container.textContent).toContain('native'));
    expect(r.start).not.toHaveBeenCalled();
    r.history.set({ value: '/dashboard' });
    await waitFor(() => expect(r.start).toHaveBeenCalled());
  });

  it('a box picked on Changelog opens Device; one picked during Setup leaves the wizard where it is', async () => {
    const r = mount('/dashboard/changelog');
    await waitFor(() => expect(row(r)).toBeTruthy());
    fireEvent.click(row(r));
    await waitFor(() => expect(r.container.textContent).toContain('device page'));
    r.history.set({ value: '/dashboard/setup' });
    await waitFor(() => expect(r.container.textContent).toContain('setup page'));
    fireEvent.click(row(r));
    await new Promise((res) => setTimeout(res, 20));
    expect(r.container.textContent).toContain('setup page');
  });

  it('locks the tabs and the box list during a flash over a chip USB, and not during a box update', async () => {
    const r = mount('/dashboard');
    await waitFor(() => expect(row(r)).toBeTruthy());
    const setupTab = () => [...r.container.querySelectorAll('[role="tab"]')].find((t) => /Set up/.test(t.textContent ?? '')) as HTMLButtonElement;
    r.setStatus('flashing');
    await new Promise((res) => setTimeout(res, 0));
    expect(setupTab().disabled).toBe(false);
    expect((row(r) as HTMLButtonElement).disabled).toBe(false);
    r.setRunning(true);
    await waitFor(() => expect(setupTab().disabled).toBe(true));
    expect((row(r) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(row(r));
    expect(r.select).not.toHaveBeenCalled();
  });

  it('shows no Boxes section where the browser cannot reach a port', async () => {
    const r = mount('/dashboard', world({ supported: false }));
    await waitFor(() => expect(r.container.textContent).toContain('device page'));
    expect(r.container.textContent).not.toContain('Boxes');
    expect(row(r)).toBeUndefined();
  });
});
