import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { Show, createSignal } from 'solid-js';

const loc = vi.hoisted(() => ({ hash: null as null | (() => string), set: null as null | ((h: string) => void) }));
vi.mock('@solidjs/router', async () => {
  const { createSignal } = await import('solid-js');
  const [hash, setHash] = createSignal('');
  loc.hash = hash;
  loc.set = setHash;
  return { useLocation: () => ({ pathname: '/dashboard', get hash() { return hash(); } }) };
});

import { PageTabs, Pane } from '../../src/app/shell/PageTabs';
import { Panel, Panels } from '../../src/app/shell/Panel';

const settle = () => new Promise((r) => setTimeout(r, 0));
const selected = (c: HTMLElement) => c.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
const visible = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((p) => !p.hidden).map((p) => p.dataset.pane);

afterEach(() => {
  cleanup();
  loc.set!('');
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

  it('brings an element the hash names into view once its tab is open, and leaves a tab named alone', async () => {
    const seen: string[] = [];
    // jsdom has no scrollIntoView.
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
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('opens the tab for an element the hash named before it existed, once it appears', async () => {
    const seen: string[] = [];
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
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
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
