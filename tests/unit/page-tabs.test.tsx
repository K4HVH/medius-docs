import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { Show, createSignal } from 'solid-js';

const loc = vi.hoisted(() => ({
  path: null as null | (() => string),
  hash: null as null | (() => string),
  set: null as null | ((h: string) => void),
  go: null as null | ((to: string) => void),
}));
vi.mock('@solidjs/router', async () => {
  const { createSignal } = await import('solid-js');
  const [path, setPath] = createSignal('/dashboard');
  const [hash, setHash] = createSignal('');
  loc.path = path;
  loc.hash = hash;
  // A hash on the page as it is.
  loc.set = setHash;
  loc.go = (to: string) => {
    const at = to.indexOf('#');
    setPath(at < 0 ? to : to.slice(0, at));
    setHash(at < 0 ? '' : to.slice(at));
  };
  return {
    useLocation: () => ({ get pathname() { return path(); }, get hash() { return hash(); } }),
    useNavigate: () => (to: string) => loc.go!(to),
  };
});

import { PageTabs, Pane } from '../../src/app/shell/PageTabs';
import { Panel, Panels } from '../../src/app/shell/Panel';

const settle = () => new Promise((r) => setTimeout(r, 0));
const selected = (c: HTMLElement) => c.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
const visible = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((p) => !p.hidden).map((p) => p.dataset.pane);

afterEach(() => {
  cleanup();
  loc.go!('/dashboard');
});

function page(opts: { optionsOff?: () => boolean } = {}) {
  return render(() => (
    <PageTabs
      id="device"
      tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'options', label: 'Options', disabled: opts.optionsOff?.() },
        { key: 'log', label: 'Log' },
      ]}
    >
      <Pane key="overview">
        <Panels>
          <Panel id="your-box" title="Your box">x</Panel>
        </Panels>
      </Pane>
      <Pane key="options">
        <Panels>
          <Panel id="o-emit" title="Emit rate">y</Panel>
        </Panels>
      </Pane>
      <Pane key="log">
        <Panel id="device-log">z</Panel>
      </Pane>
    </PageTabs>
  ));
}

describe('PageTabs', () => {
  it('opens on the first tab, one tab stop, panes hidden but in the page', () => {
    const { container } = page();
    expect(selected(container)).toBe('Overview');
    expect(visible(container)).toEqual(['overview']);
    expect([...container.querySelectorAll('[role="tab"]')].filter((t) => (t as HTMLElement).tabIndex === 0)).toHaveLength(1);
    // Every tab's text is in the document for crawlers.
    expect(container.textContent).toContain('Emit rate');
  });

  it('holds the tablist and a link icon in its bar, the list holding only its tabs and mark', () => {
    const { container } = page();
    const bar = container.querySelector('.ptabs')!;
    const list = bar.querySelector(':scope > [role="tablist"]')!;
    expect(list).not.toBeNull();
    expect([...list.children].every((c) => c.matches('[role="tab"], .ind'))).toBe(true);
    expect(bar.querySelector(':scope > button.cl')).not.toBeNull();
  });

  it("copies the open tab's address", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (s: string) => void written.push(s) }, configurable: true });
    const { container } = page();
    fireEvent.click(container.querySelector('[data-tab="log"]')!);
    const icon = container.querySelector<HTMLButtonElement>('.ptabs > button.cl')!;
    expect(icon.getAttribute('aria-label')).toBe('Copy link to Log');
    fireEvent.click(icon);
    await settle();
    await settle();
    expect(written).toEqual(['https://medius.k4tech.net/dashboard/log']);
  });

  it('opens a tab picked from further down at the top of its pane, under the stuck bar', () => {
    const { container } = page();
    const bar = container.querySelector<HTMLElement>('.ptabs')!;
    bar.style.top = '72px';
    Object.defineProperty(bar, 'offsetHeight', { value: 43, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true });
    container.querySelector<HTMLElement>('#pane-device-log')!.getBoundingClientRect = () => ({ top: -208 }) as DOMRect;
    const to = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      fireEvent.click(container.querySelector('[data-tab="log"]')!);
      expect(to).toHaveBeenCalledWith({ top: 900 - 208 - 43 - 72, behavior: 'instant' });
    } finally {
      to.mockRestore();
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    }
  });

  it('leaves the page where it is for a tab picked with its pane in view', () => {
    const { container } = page();
    container.querySelector<HTMLElement>('#pane-device-log')!.getBoundingClientRect = () => ({ top: 400 }) as DOMRect;
    const to = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      fireEvent.click(container.querySelector('[data-tab="log"]')!);
      expect(to).not.toHaveBeenCalled();
    } finally {
      to.mockRestore();
    }
  });

  it('moves along the tabs with the arrows, never onto the icon', () => {
    const { container } = page();
    const log = container.querySelector<HTMLButtonElement>('[data-tab="log"]')!;
    log.focus();
    fireEvent.keyDown(log, { key: 'ArrowRight' });
    expect(selected(container)).toBe('Overview');
  });

  it('leaves a key held with Ctrl, Alt, Shift or Meta to the browser', () => {
    const { container } = page();
    const first = container.querySelector<HTMLButtonElement>('[data-tab="overview"]')!;
    first.focus();
    for (const mod of ['ctrlKey', 'altKey', 'shiftKey', 'metaKey']) {
      const ev = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true, [mod]: true });
      first.dispatchEvent(ev);
      expect(ev.defaultPrevented, mod).toBe(false);
      expect(selected(container), mod).toBe('Overview');
    }
  });

  it("tells the stylesheet its tabs' count and letters, which set their spacing", () => {
    const { container } = page();
    const bar = container.querySelector<HTMLElement>('.ptabs')!;
    expect(bar.style.getPropertyValue('--tab-n')).toBe('3');
    expect(bar.style.getPropertyValue('--tab-chars')).toBe(String('OverviewOptionsLog'.length));
  });

  it('opens a tab on click and on End and Home', async () => {
    const { container } = page();
    fireEvent.click(container.querySelector('[data-tab="log"]')!);
    expect(visible(container)).toEqual(['log']);
    const tab = container.querySelector<HTMLButtonElement>('[data-tab="log"]')!;
    tab.focus();
    fireEvent.keyDown(tab, { key: 'Home' });
    expect(selected(container)).toBe('Overview');
    fireEvent.keyDown(container.querySelector('[data-tab="overview"]')!, { key: 'End' });
    expect(selected(container)).toBe('Log');
  });

  it('opens the tab a hash names, and the tab holding an element the hash names', async () => {
    const { container } = page();
    loc.set!('#log');
    await settle();
    expect(visible(container)).toEqual(['log']);
    loc.set!('#o-emit');
    await settle();
    expect(visible(container)).toEqual(['options']);
  });

  it('keeps the tab the reader picked when the tabs mount again, as they do on a box change', async () => {
    loc.set!('#options');
    const first = page();
    await settle();
    expect(visible(first.container)).toEqual(['options']);
    fireEvent.click(first.container.querySelector('[data-tab="log"]')!);
    await settle();
    expect([loc.path!(), loc.hash!()]).toEqual(['/dashboard/log', '']);
    first.unmount();
    const again = page();
    await settle();
    expect(visible(again.container)).toEqual(['log']);
  });

  it('writes a hash that names a tab as the tab\'s address', async () => {
    page();
    loc.set!('#log');
    await settle();
    await settle();
    expect([loc.path!(), loc.hash!()]).toEqual(['/dashboard/log', '']);
  });

  it('writes a hash naming a disabled tab as the tab\'s address once the tab opens', async () => {
    const [off, setOff] = createSignal(true);
    page({ optionsOff: off });
    loc.set!('#options');
    await settle();
    expect(loc.path!()).toBe('/dashboard');
    setOff(false);
    await settle();
    await settle();
    expect([loc.path!(), loc.hash!()]).toEqual(['/dashboard/options', '']);
  });

  it('opens the tab the address names, and the tab holding a place the address names', async () => {
    const { container } = page();
    loc.go!('/dashboard/log');
    await settle();
    expect(visible(container)).toEqual(['log']);
    loc.go!('/dashboard/o-emit');
    await settle();
    expect(visible(container)).toEqual(['options']);
  });

  it('opens nothing on a hash it cannot decode, and does not throw', async () => {
    const { container } = page();
    loc.set!('#%E0%A4%A');
    await settle();
    expect(visible(container)).toEqual(['overview']);
  });

  it('brings an element the hash names into view once its tab is open, and leaves a tab named alone', async () => {
    const seen: string[] = [];
    const was = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      seen.push(this.id);
    };
    const [off, setOff] = createSignal(true);
    page({ optionsOff: off });
    loc.set!('#log');
    await new Promise((r) => setTimeout(r, 40));
    expect(seen).toEqual([]);
    loc.set!('#o-emit');
    await new Promise((r) => setTimeout(r, 40));
    expect(seen).toEqual([]);
    setOff(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(seen).toEqual(['o-emit']);
    Element.prototype.scrollIntoView = was;
  });

  it('opens the tab for an element the hash named before it existed, once it appears', async () => {
    const seen: string[] = [];
    const was = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      seen.push(this.id);
    };
    const [ready, setReady] = createSignal(false);
    const { container } = render(() => (
      <PageTabs
        id="device"
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'options', label: 'Options', disabled: !ready() },
        ]}
      >
        <Pane key="overview">
          <Panel id="your-box" title="Your box">x</Panel>
        </Pane>
        <Pane key="options">
          <Show when={ready()}>
            <Panels>
              <Panel id="emit-rate" title="Emit rate">y</Panel>
            </Panels>
          </Show>
        </Pane>
      </PageTabs>
    ));
    loc.set!('#emit-rate');
    await new Promise((r) => setTimeout(r, 40));
    expect(visible(container)).toEqual(['overview']);
    setReady(true);
    await new Promise((r) => setTimeout(r, 40));
    expect(visible(container)).toEqual(['options']);
    expect(seen).toEqual(['emit-rate']);
    Element.prototype.scrollIntoView = was;
  });

  it('forgets an element the hash named once the reader picks a tab', async () => {
    const [ready, setReady] = createSignal(false);
    const { container } = render(() => (
      <PageTabs
        id="device"
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'log', label: 'Log' },
          { key: 'options', label: 'Options', disabled: !ready() },
        ]}
      >
        <Pane key="overview">x</Pane>
        <Pane key="log">z</Pane>
        <Pane key="options">
          <Show when={ready()}>
            <Panel id="emit-rate" title="Emit rate">y</Panel>
          </Show>
        </Pane>
      </PageTabs>
    ));
    loc.set!('#emit-rate');
    await settle();
    fireEvent.click(container.querySelector('[data-tab="log"]')!);
    setReady(true);
    await new Promise((r) => setTimeout(r, 40));
    expect(visible(container)).toEqual(['log']);
  });

  it('opens a disabled tab the hash named once it is enabled, and leaves one disabled while open', async () => {
    const [off, setOff] = createSignal(true);
    const { container } = page({ optionsOff: off });
    loc.set!('#o-emit');
    await settle();
    expect(visible(container)).toEqual(['overview']);
    setOff(false);
    await settle();
    expect(visible(container)).toEqual(['options']);
    setOff(true);
    await settle();
    expect(visible(container)).toEqual(['overview']);
  });
});

describe('Panel', () => {
  it('heads a panel with an h2 and holds no subtitle', () => {
    const { container } = render(() => (
      <Panel id="status" title="Status" aside={<span class="caps">0 of 32</span>}>
        body
      </Panel>
    ));
    expect(container.querySelector('.ph h2')?.textContent).toBe('Status');
    expect(container.querySelector('.ph .caps')?.textContent).toBe('0 of 32');
    expect(container.querySelector('#status')?.hasAttribute('data-search-target')).toBe(true);
  });

  it('a panel with no title has no heading', () => {
    const { container } = render(() => <Panel>body</Panel>);
    expect(container.querySelector('.ph')).toBeNull();
  });
});
