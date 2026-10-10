import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { Search } from '../../src/app/shell/Search';
import type { IndexEntry, SearchIndex } from '../../src/app/search/types';
import { routeFor, sectionLabel } from '../../src/app/routes';

const e = (path: string, title: string, o: Partial<IndexEntry> = {}): IndexEntry => ({
  path,
  title,
  kind: path.includes('#') ? 'anchor' : 'page',
  section: 'Native API',
  crumb: '',
  text: '',
  ...o,
});

const INDEX: SearchIndex = {
  version: 1,
  built: 'now',
  entries: [
    e('/native/commands/lock', 'LOCK', { crumb: 'Commands', text: 'LOCK weighs physical input before it reaches the PC.' }),
    e('/native/commands/lock#blanket', 'BLANKET', { crumb: 'Commands / Lock', text: 'An id of 0xFFFF addresses the whole class in one command.' }),
    e('/library/lock', 'Lock', { section: 'Rust Library', crumb: 'API', text: 'Set a lock from Rust.' }),
    // The main pages, as the built index holds every page.
    ...['/guide', '/guide/compatibility', '/guide/help', '/dashboard', '/native'].map((p) => {
      const r = routeFor(p)!;
      return e(p, r.title, { section: sectionLabel(r), text: r.description });
    }),
    e('/dashboard/changelog#v3.4.4', 'v3.4.4', { kind: 'release', section: 'Dashboard', crumb: 'Changelog', caption: '2 October 2026', text: 'Fixed the Logitech delay.' }),
    e('https://discord.gg/x', 'Discord', { kind: 'external', section: 'Elsewhere', crumb: 'discord.gg', keywords: ['community'] }),
  ],
};

// The loader keeps the index for the whole file once fetched; it reaches a panel a tick after the panel
// opens, so what a test reads straight after opening or typing is the panel without it.
let fetches = 0;
const serve = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      fetches++;
      return new Response(JSON.stringify(INDEX), { status: 200 });
    }),
  );

const picks: string[] = [];
let closes = 0;

const mount = () => {
  const r = render(() => <Search open onClose={() => closes++} onPick={(p) => picks.push(p)} />);
  const input = () => document.querySelector<HTMLInputElement>('.srch input')!;
  const type = (q: string) => fireEvent.input(input(), { target: { value: q } });
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) => fireEvent.keyDown(input(), { key: k, ...mods });
  const options = () => [...document.querySelectorAll<HTMLElement>('.srch [role="option"]')];
  const active = () => options().find((o) => o.getAttribute('aria-selected') === 'true');
  const titles = () => options().map((o) => o.querySelector('.t')!.textContent);
  const found = async (q: string) => {
    type(q);
    await waitFor(() => expect(options().length).toBeGreaterThan(0));
  };
  return { ...r, input, type, key, options, active, titles, found };
};

beforeEach(() => {
  picks.length = 0;
  closes = 0;
  localStorage.clear();
  serve();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Search', () => {
  it('opens on the main pages, with the box ready to type in, before the index has come', () => {
    const s = mount();
    expect(document.activeElement).toBe(s.input());
    expect(s.titles()).toContain('Start here');
    expect(s.active()).toBe(s.options()[0]);
    expect(document.querySelector<HTMLElement>('.srch-l .mark')!.style.opacity).toBe('1');
  });

  it('lists what matches, best first, and opens the one picked with Enter', async () => {
    const s = mount();
    await s.found('physical input');
    expect(s.active()!.querySelector('.t')!.textContent).toBe('LOCK');
    s.key('Enter');
    expect(picks).toEqual(['/native/commands/lock']);
  });

  it('moves through the list with the arrows, round from the end to the start', async () => {
    const s = mount();
    await s.found('lock');
    s.key('ArrowDown');
    expect(s.active()).toBe(s.options()[1]);
    s.key('ArrowUp');
    s.key('ArrowUp');
    expect(s.active()).toBe(s.options()[s.options().length - 1]);
  });

  it('files results under the site sections, says where each lives, and lights the words that matched', async () => {
    const s = mount();
    await s.found('blanket lock');
    const o = s.options()[0];
    expect(o.closest('[role="group"]')!.getAttribute('aria-label')).toBe('Native API');
    expect(o.querySelector('.c')!.textContent).toBe('Commands / Lock');
    expect(o.querySelector('.t mark')!.textContent).toBe('BLANKET');
  });

  it('shows the sentence the words matched in, lit', async () => {
    const s = mount();
    await s.found('whole class');
    const d = s.options()[0].querySelector('.d')!;
    expect(d.textContent).toBe('An id of 0xFFFF addresses the whole class in one command.');
    expect([...d.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['whole', 'class']);
  });

  it('dates a release beside where it lives, and says what it changed rather than the date again', async () => {
    const s = mount();
    await s.found('v3.4.4');
    expect(s.options()[0].querySelector('.c')!.textContent).toBe('Changelog · 2 October 2026');
    expect(s.options()[0].querySelector('.d')!.textContent).toBe('Fixed the Logitech delay.');
  });

  it('takes a space after a word as the word finished', async () => {
    const s = mount();
    await s.found('physica');
    expect(s.titles()[0]).toBe('LOCK');
    s.type('physica ');
    await waitFor(() => expect(s.options()).toEqual([]));
  });

  it('keeps the result in focus when the index arrives under it', async () => {
    const s = mount();
    s.key('ArrowDown');
    s.key('ArrowDown');
    const before = s.active()!.querySelector('.t')!.textContent;
    await waitFor(() => expect(fetches).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 20));
    expect(s.active()!.querySelector('.t')!.textContent).toBe(before);
  });

  it('keeps picks a reader made before this search, kept by address and title', async () => {
    localStorage.setItem('medius.search.recent', JSON.stringify(['/native/commands/lock LOCK']));
    const s = mount();
    await waitFor(() => expect(s.titles()[0]).toBe('LOCK'));
    expect(document.querySelector('.srch')!.textContent).toContain('Recent');
  });

  it('says so when nothing matches', async () => {
    const s = mount();
    s.type('zzzzqq');
    await waitFor(() => expect(document.querySelector('.srch')!.textContent).toContain('Nothing matches "zzzzqq"'));
    expect(s.options()).toEqual([]);
  });

  it('fetches the index once however often it opens', async () => {
    const before = fetches;
    const s = mount();
    await s.found('lock');
    cleanup();
    const t = mount();
    await t.found('lock');
    expect(fetches - before).toBeLessThanOrEqual(1);
  });

  it('closes on Escape', () => {
    const s = mount();
    s.key('Escape');
    expect(closes).toBe(1);
  });

  it('keeps what was opened, and offers it first next time, before the index has come', async () => {
    const s = mount();
    await s.found('blanket');
    s.key('Enter');
    cleanup();
    const t = mount();
    expect(t.titles()[0]).toBe('BLANKET');
    expect(document.querySelector('.srch')!.textContent).toContain('Recent');
  });

  it('drops a kept pick whose address is no longer on the site', async () => {
    localStorage.setItem('medius.search.recent', JSON.stringify([{ path: '/native/gone', title: 'Gone', kind: 'page', section: 'Native API', crumb: '' }]));
    const s = mount();
    await waitFor(() => expect(s.titles()).not.toContain('Gone'));
  });

  it('is a combobox over a listbox that names the result in focus', async () => {
    const s = mount();
    await s.found('lock');
    expect(s.input().getAttribute('role')).toBe('combobox');
    expect(s.input().getAttribute('aria-activedescendant')).toBe(s.active()!.id);
    expect(document.querySelector('.srch [role="listbox"]')).not.toBeNull();
  });

  it('opens a result in a new tab with Ctrl and Enter', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const s = mount();
    await s.found('physical input');
    s.key('Enter', { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('/native/commands/lock', '_blank', 'noopener,noreferrer');
    expect(picks).toEqual([]);
    open.mockRestore();
  });

  it('opens another site in a new tab and closes', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const s = mount();
    await s.found('community');
    s.key('Enter');
    expect(open).toHaveBeenCalledWith('https://discord.gg/x', '_blank', 'noopener,noreferrer');
    expect(closes).toBe(1);
    open.mockRestore();
  });

  it('closes on Escape from anywhere in the panel, not only the box', () => {
    mount();
    const close = document.querySelector<HTMLElement>('.srch-x')!;
    close.focus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(closes).toBe(1);
  });

  it('keeps the keys it handles from reaching what lies under it', () => {
    const s = mount();
    const under = vi.fn();
    document.addEventListener('keydown', under);
    s.key('Escape');
    s.key('Tab');
    document.removeEventListener('keydown', under);
    expect(under).not.toHaveBeenCalled();
  });

  it('opens nothing on the Enter that ends a composition', async () => {
    const s = mount();
    await s.found('lock');
    s.key('Enter', { isComposing: true });
    expect(picks).toEqual([]);
  });
});

describe('Search kept open and shut', () => {
  it('gives focus back to what had it, when mounted already open and then closed', async () => {
    const [open, setOpen] = createSignal(true);
    const before = document.createElement('button');
    document.body.append(before);
    before.focus();
    render(() => <Search open={open()} onClose={() => setOpen(false)} onPick={() => {}} />);
    expect(document.activeElement).toBe(document.querySelector('.srch input'));
    setOpen(false);
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('starts afresh each time it opens: focus in the box, recent picks first, the edge on the first', async () => {
    const [open, setOpen] = createSignal(true);
    render(() => <Search open={open()} onClose={() => setOpen(false)} onPick={() => setOpen(false)} />);
    const input = () => document.querySelector<HTMLInputElement>('.srch input')!;
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    setOpen(true);
    await Promise.resolve();
    expect(document.activeElement).toBe(input());
    expect(document.querySelector('.srch')!.textContent).toContain('Recent');
    const sel = document.querySelector('.srch [aria-selected="true"]')!;
    expect(sel).toBe(document.querySelector('.srch [role="option"]'));
  });

  it('takes focus back when opened again while it is still closing', async () => {
    const [open, setOpen] = createSignal(true);
    render(() => <Search open={open()} onClose={() => setOpen(false)} onPick={() => {}} />);
    const outside = document.createElement('button');
    document.body.append(outside);
    setOpen(false);
    outside.focus();
    setOpen(true);
    await Promise.resolve();
    expect(document.activeElement).toBe(document.querySelector('.srch input'));
    outside.remove();
  });
});
