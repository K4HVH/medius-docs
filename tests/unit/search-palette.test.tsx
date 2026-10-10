import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { Search } from '../../src/app/shell/Search';

const picks: string[] = [];
let closes = 0;

const mount = () => {
  const r = render(() => <Search open onClose={() => closes++} onPick={(p) => picks.push(p)} />);
  const input = () => document.querySelector<HTMLInputElement>('.srch input')!;
  const type = (q: string) => fireEvent.input(input(), { target: { value: q } });
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) => fireEvent.keyDown(input(), { key: k, ...mods });
  const options = () => [...document.querySelectorAll<HTMLElement>('.srch [role="option"]')];
  const active = () => options().find((o) => o.getAttribute('aria-selected') === 'true');
  return { ...r, input, type, key, options, active };
};

beforeEach(() => {
  picks.length = 0;
  closes = 0;
  localStorage.clear();
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => cleanup());

describe('Search', () => {
  it('opens on the main pages, with the box ready to type in', () => {
    const s = mount();
    expect(document.activeElement).toBe(s.input());
    expect(s.options().map((o) => o.querySelector('.t')!.textContent)).toContain('Start here');
    expect(s.active()).toBe(s.options()[0]);
    expect(document.querySelector<HTMLElement>('.srch-l .mark')!.style.opacity).toBe('1');
  });

  it('lists what matches, best first, and opens the one picked with Enter', () => {
    const s = mount();
    s.type('lock');
    expect(s.active()!.querySelector('.t')!.textContent).toBe('LOCK');
    s.key('Enter');
    expect(picks).toEqual(['/native/commands/lock']);
  });

  it('moves through the list with the arrows, round from the end to the start', () => {
    const s = mount();
    s.type('lock');
    s.key('ArrowDown');
    expect(s.active()).toBe(s.options()[1]);
    s.key('ArrowUp');
    s.key('ArrowUp');
    expect(s.active()).toBe(s.options()[s.options().length - 1]);
  });

  it('files results under the site sections, says where each lives, and lights the words that matched', () => {
    const s = mount();
    s.type('blanket lock');
    const o = s.options()[0];
    expect(o.closest('[role="group"]')!.getAttribute('aria-label')).toBe('Native API');
    expect(o.querySelector('.c')!.textContent).toBe('Commands / Lock');
    expect(o.querySelector('.t mark')!.textContent).toBe('Blanket');
  });

  it('says so when nothing matches', () => {
    const s = mount();
    s.type('zzzzqq');
    expect(s.options()).toEqual([]);
    expect(document.querySelector('.srch')!.textContent).toContain('Nothing matches');
  });

  it('closes on Escape', () => {
    const s = mount();
    s.key('Escape');
    expect(closes).toBe(1);
  });

  it('keeps what was opened, and offers it first next time', () => {
    const s = mount();
    s.type('blanket lock');
    s.key('Enter');
    cleanup();
    const t = mount();
    expect(t.options()[0].querySelector('.t')!.textContent).toBe('Blanket lock');
    expect(document.querySelector('.srch')!.textContent).toContain('Recent');
  });

  it('is a combobox over a listbox that names the result in focus', () => {
    const s = mount();
    s.type('lock');
    expect(s.input().getAttribute('role')).toBe('combobox');
    expect(s.input().getAttribute('aria-activedescendant')).toBe(s.active()!.id);
    expect(document.querySelector('.srch [role="listbox"]')).not.toBeNull();
  });

  it('opens a result in a new tab with Ctrl and Enter', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const s = mount();
    s.type('lock');
    s.key('Enter', { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('/native/commands/lock', '_blank', 'noopener,noreferrer');
    expect(picks).toEqual([]);
    open.mockRestore();
  });

  it('closes on Escape from anywhere in the panel, not only the box', () => {
    const s = mount();
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

  it('opens nothing on the Enter that ends a composition', () => {
    const s = mount();
    s.type('lock');
    s.key('Enter', { isComposing: true });
    expect(picks).toEqual([]);
  });

  it('tells apart two results that share a page', () => {
    const s = mount();
    s.type('install medius');
    const picked = s.active()!.querySelector('.t')!.textContent;
    s.key('Enter');
    cleanup();
    const t = mount();
    expect(t.options()[0].querySelector('.t')!.textContent).toBe(picked);
  });
});

describe('Search kept open and shut', () => {
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
