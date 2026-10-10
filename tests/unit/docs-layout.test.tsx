import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { PageHeader } from '../../src/app/shell/PageHeader';
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
  Element.prototype.scrollIntoView ??= () => {};
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
    icon: () => 'box',
    setIcon: () => {},
  } as unknown as Boxes;
  const native = { running, progress: () => null, log: () => [], error: () => null, flash: async () => true, clear: () => {} } as unknown as NativeFlash;
  return { boxes, native, setRunning, setStatus, start, select };
};

const Sections = () => (
  <>
    <section class="doc-section" id="intro"><h2 class="doc-h2">Intro</h2><p>first</p></section>
    <section class="doc-section" id="frames"><h2 class="doc-h2">Frames</h2><p>target</p></section>
    <section class="doc-section" id="later"><h2 class="doc-h2">Later</h2><p>below</p></section>
  </>
);

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
        <Route path="/native/transport" component={Sections} />
        <Route
          path="/native/commands/inject"
          component={() => (
            <>
              <PageHeader />
              <p>inject page</p>
            </>
          )}
        />
        <Route path="/dashboard" component={() => <p>device page</p>} />
        <Route path="/dashboard/setup" component={() => <p>setup page</p>} />
        <Route path="/dashboard/changelog" component={() => <p>changelog page</p>} />
        <Route path="/dashboard/update" component={() => <p>update page</p>} />
        <Route path="*" component={() => <p>other page</p>} />
      </Route>
    </MemoryRouter>
  ));
  return { ...r, history, ...w };
};

afterEach(cleanup);

const row = (r: ReturnType<typeof render>) =>
  [...r.container.querySelectorAll('button.tabs__tab')].find((b) => /Desk/.test(b.textContent ?? '')) as HTMLElement;

const bar = (r: ReturnType<typeof render>) => r.container.querySelector('button.docbar')!.textContent ?? '';

describe('DocsLayout and the boxes', () => {
  it('names the selected box in the page bar on a box route, and not on Setup', async () => {
    const r = mount('/dashboard');
    await waitFor(() => expect(bar(r)).toContain('Device - Desk'));
    r.history.set({ value: '/dashboard/setup' });
    await waitFor(() => expect(r.container.textContent).toContain('setup page'));
    expect(bar(r)).not.toContain('Desk');
  });

  it('names the box on Update, and a box picked there stays on Update', async () => {
    const r = mount('/dashboard/update');
    await waitFor(() => expect(bar(r)).toContain('Update - Desk'));
    fireEvent.click(row(r));
    await new Promise((res) => setTimeout(res, 20));
    expect(r.container.textContent).toContain('update page');
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

  it('locks the sidebar and the box list during a flash over a chip USB, and not during a box update', async () => {
    const r = mount('/dashboard');
    await waitFor(() => expect(row(r)).toBeTruthy());
    const setupLink = () => [...r.container.querySelectorAll('.side a')].find((t) => /Set up/.test(t.textContent ?? '')) as HTMLAnchorElement;
    const inert = () => setupLink().getAttribute('aria-disabled') === 'true';
    r.setStatus('flashing');
    await new Promise((res) => setTimeout(res, 0));
    expect(inert()).toBe(false);
    expect((row(r) as HTMLButtonElement).disabled).toBe(false);
    r.setRunning(true);
    await waitFor(() => expect(inert()).toBe(true));
    fireEvent.click(setupLink());
    await new Promise((res) => setTimeout(res, 0));
    expect(r.container.textContent).toContain('device page');
    expect((row(r) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(row(r));
    expect(r.select).not.toHaveBeenCalled();
  });

  it('keeps every link in the nav, the sidebar and the footer from leaving a flash', async () => {
    const r = mount('/dashboard');
    await waitFor(() => expect(r.container.textContent).toContain('device page'));
    r.setRunning(true);
    await new Promise((res) => setTimeout(res, 0));
    const links = [
      r.container.querySelector('header.nav a.brand'),
      r.container.querySelector('header.nav .links a[href="/guide"]'),
      r.container.querySelector('header.nav a.btn'),
      r.container.querySelector('.side a[href="/dashboard/changelog"]'),
      r.container.querySelector('footer.site-footer a[href="/guide/help"]'),
      r.container.querySelector('footer.site-footer a[href="/native"]'),
    ];
    for (const a of links) {
      expect(a).not.toBeNull();
      fireEvent.click(a!);
      await new Promise((res) => setTimeout(res, 0));
      expect(r.history.get()).toBe('/dashboard');
    }
    expect(r.container.textContent).toContain('device page');
    fireEvent.click(r.container.querySelector('.side button.search')!);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    await new Promise((res) => setTimeout(res, 0));
    expect(document.querySelector('.srch')).toBeNull();
  });

  it('opens search from the sidebar and on Ctrl K', async () => {
    const r = mount('/native');
    await waitFor(() => expect(r.container.textContent).toContain('native'));
    fireEvent.click(r.container.querySelector('.side button.search')!);
    await waitFor(() => expect(document.querySelector('.srch')).not.toBeNull());
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(document.querySelector('.srch')).toBeNull());
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(document.querySelector('.srch')).not.toBeNull());
  });

  it('closes the phone page panel when a box is picked, and unlocks the page', async () => {
    const r = mount('/dashboard/changelog');
    await waitFor(() => expect(row(r)).toBeTruthy());
    fireEvent.click(r.container.querySelector('button.docbar')!);
    expect(r.container.querySelector('aside.side')!.classList.contains('open')).toBe(true);
    fireEvent.click(row(r));
    await waitFor(() => expect(r.container.textContent).toContain('device page'));
    expect(r.container.querySelector('aside.side')!.classList.contains('open')).toBe(false);
    expect(document.documentElement.classList.contains('locked')).toBe(false);
    fireEvent.click(r.container.querySelector('button.docbar')!);
    fireEvent.click(row(r));
    expect(r.container.querySelector('aside.side')!.classList.contains('open')).toBe(false);
  });

  it('closes the phone page panel when a search result is chosen', async () => {
    const r = mount('/native');
    await waitFor(() => expect(r.container.textContent).toContain('native'));
    fireEvent.click(r.container.querySelector('button.docbar')!);
    fireEvent.click(r.container.querySelector('.side button.search')!);
    const input = await waitFor(() => document.querySelector<HTMLInputElement>('.srch input')!);
    fireEvent.input(input, { target: { value: 'Inject' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(document.querySelector('.srch')).toBeNull());
    expect(r.container.querySelector('aside.side')!.classList.contains('open')).toBe(false);
    expect(document.documentElement.classList.contains('locked')).toBe(false);
  });

  it('keeps the page locked while either phone panel is still open', async () => {
    const r = mount('/native');
    await waitFor(() => expect(r.container.textContent).toContain('native'));
    fireEvent.click(r.container.querySelector('button.docbar')!);
    fireEvent.click(r.container.querySelector('button.menu-btn')!);
    fireEvent.click(r.container.querySelector('button.menu-btn')!);
    expect(r.container.querySelector('aside.side')!.classList.contains('open')).toBe(true);
    expect(document.documentElement.classList.contains('locked')).toBe(true);
    fireEvent.click(r.container.querySelector('button.docbar')!);
    expect(document.documentElement.classList.contains('locked')).toBe(false);
  });

  it('gives the dashboard the full width beside the sidebar, and the docs their reading measure', async () => {
    const r = mount('/dashboard/update');
    await waitFor(() => expect(r.container.textContent).toContain('update page'));
    expect(r.container.querySelector('.docs')!.classList.contains('tool')).toBe(true);
    r.history.set({ value: '/native' });
    await waitFor(() => expect(r.container.textContent).toContain('native'));
    expect(r.container.querySelector('.docs')!.classList.contains('tool')).toBe(false);
  });

  it('makes every sidebar entry a link a crawler can follow', async () => {
    const r = mount('/native');
    await waitFor(() => expect(r.container.textContent).toContain('native'));
    const side = r.container.querySelector('aside.side')!;
    expect(side.querySelectorAll('.group button, .sections button')).toHaveLength(0);
    const hrefs = [...side.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/native', '/library', '/bindings', '/native/commands/inject', '/ai']));
    const nav = [...r.container.querySelectorAll('header.nav a')].map((a) => a.getAttribute('href'));
    expect(nav).toEqual(expect.arrayContaining(['/', '/guide', '/dashboard', '/dashboard/changelog']));
  });

  it('puts the page in main, its crumbs in the page header and the footer after the docs grid', async () => {
    const r = mount('/native/commands/inject');
    await waitFor(() => expect(r.container.textContent).toContain('inject page'));
    const main = r.container.querySelector('.docs > main.docs-page')!;
    const crumbs = main.querySelector('header.page-header nav.crumbs')!;
    expect([...crumbs.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/', '/native']);
    expect(main.querySelector('footer')).toBeNull();
    expect(r.container.querySelector('.docs + footer.site-footer')).not.toBeNull();
  });

  it('shows no Boxes section where the browser cannot reach a port', async () => {
    const r = mount('/dashboard', world({ supported: false }));
    await waitFor(() => expect(r.container.textContent).toContain('device page'));
    expect(r.container.textContent).not.toContain('Boxes');
    expect(row(r)).toBeUndefined();
  });
});

describe('DocsLayout scrolling', () => {
  let observed: Element[];
  let jumped: Element | null;
  let how: boolean | ScrollIntoViewOptions | undefined;

  beforeEach(() => {
    observed = [];
    jumped = null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe(el: Element) {
          observed.push(el);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    // jsdom lays nothing out; every block here is on the page.
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(() => [{}] as unknown as DOMRectList);
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
      jumped = this;
      how = arg;
    });
    // Before the jump the target sits a screen down; after it, at the top. The last section never
    // reaches the screen.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const id = this.closest('section')?.id;
      const top = id === 'later' ? window.innerHeight * 3 : id === 'frames' ? (jumped ? 90 : window.innerHeight + 400) : jumped ? -600 : 100;
      return { top, bottom: top + 40, left: 0, right: 0, width: 0, height: 40, x: 0, y: top, toJSON: () => ({}) };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lands on the hash section and never hides it behind a reveal', async () => {
    const r = mount('/native/transport#frames');
    await waitFor(() => expect(r.container.querySelector('#later p')?.classList.contains('rv-wait')).toBe(true));
    expect(jumped).toBe(r.container.querySelector('#frames'));
    expect(how).toEqual({ behavior: 'instant', block: 'start' });
    for (const el of r.container.querySelectorAll('#frames h2, #frames p')) {
      expect(el.classList.contains('rb')).toBe(true);
      expect(el.classList.contains('rv-wait')).toBe(false);
    }
  });

  it('scrolls the window to the top on a new page without a hash', async () => {
    const top = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const r = mount('/native');
    await waitFor(() => expect(r.container.textContent).toContain('native'));
    top.mockClear();
    r.history.set({ value: '/native/transport' });
    await waitFor(() => expect(r.container.querySelector('#frames')).not.toBeNull());
    expect(top).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(jumped).toBeNull();
  });
});
