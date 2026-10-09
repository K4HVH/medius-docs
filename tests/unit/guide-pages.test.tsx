import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import type { Component } from 'solid-js';
import { routeFor } from '../../src/app/routes';
import { HELP, HELP_ITEMS } from '../../src/app/data/help';
import { COMPAT } from '../../src/app/data/compatibility';
import { entries } from '../../src/app/searchIndex';

const stats = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../../src/dashboard/stats', async (orig) => ({
  ...(await orig<object>()),
  fetchStats: () => Promise.resolve(stats.value),
}));

import Start from '../../src/app/pages/guide/Start';
import Devices from '../../src/app/pages/guide/Devices';
import Help from '../../src/app/pages/guide/Help';

const PAGES: [string, Component][] = [
  ['/guide', Start],
  ['/guide/compatibility', Devices],
  ['/guide/help', Help],
];

const mount = (path: string, page: Component) => {
  const history = createMemoryHistory();
  history.set({ value: path });
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={page} />
    </MemoryRouter>
  ));
};

afterEach(() => {
  cleanup();
  stats.value = null;
});

describe('Guide pages', () => {
  it.each(PAGES)('%s has one h1, its registry title', (path, page) => {
    const r = mount(path, page);
    const h1s = r.container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(routeFor(path)!.title);
  });

  it('carries no lead, and no line about USB1 and USB3 in one computer', () => {
    for (const [path, page] of PAGES) {
      const r = mount(path, page);
      expect(r.container.querySelector('.page-header .lead'), path).toBeNull();
      expect(r.container.textContent, path).not.toMatch(/same computer|one computer|back into that computer|shut a laptop/i);
      cleanup();
    }
  });

  it('starts with the ports and requirements, then the next pages', () => {
    const r = mount('/guide', Start);
    expect([...r.container.querySelectorAll('section.doc-section')].map((s) => s.id)).toEqual(['ports', 'requirements']);
    expect(r.container.querySelector('#ports figure.board')).not.toBeNull();
    expect([...r.container.querySelectorAll('nav.index a.go')].map((a) => a.getAttribute('href'))).toEqual([
      '/dashboard/setup',
      '/dashboard/update',
      '/guide/compatibility',
      '/guide/help',
    ]);
  });

  it('gives each Help answer a row in its group, reachable by its id', () => {
    const r = mount('/guide/help', Help);
    for (const g of HELP) {
      const s = r.container.querySelector(`section#${g.id}`)!;
      expect(s.querySelector('h2')!.textContent).toBe(g.title);
      for (const f of g.items) {
        const row = s.querySelector(`#${f.id}`)!;
        expect(row, f.id).not.toBeNull();
        expect(row.querySelector('h3')!.textContent).toBe(f.q);
        expect(row.textContent).toContain(f.a);
      }
    }
  });

  it('finds an answer by its anchor word too, names one answer in the singular, and stays out of the Markdown twin', async () => {
    const r = mount('/guide/help', Help);
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'bsod' } });
    await waitFor(() => expect(r.container.querySelector('.filter .n')!.textContent).toBe('1 answer'));
    expect([...r.container.querySelectorAll<HTMLElement>('.qa')].filter((q) => !q.hidden).map((q) => q.id)).toEqual(['bsod']);
    expect(r.container.querySelector('.filter')!.hasAttribute('data-agent-hide')).toBe(true);
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'newer firmware' } });
    await waitFor(() => expect(r.container.querySelector('.filter .n')!.textContent).toBe('1 answer'));
  });

  it('narrows Help to the answers that match, marks the match, drops empty groups and says when none do', async () => {
    const r = mount('/guide/help', Help);
    const count = () => r.container.querySelector('.filter .n b')!.textContent;
    expect(count()).toBe(String(HELP_ITEMS.length));
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'usbser' } });
    await waitFor(() => expect(count()).toBe('1'));
    const shown = [...r.container.querySelectorAll<HTMLElement>('.qa')].filter((q) => !q.hidden);
    expect(shown.map((q) => q.id)).toEqual(['bsod']);
    expect(shown[0].classList.contains('first')).toBe(true);
    expect(shown[0].querySelector('mark')!.textContent).toBe('usbser');
    const groups = [...r.container.querySelectorAll<HTMLElement>('section.doc-section')].filter((g) => !g.hidden);
    expect(groups.map((g) => g.id)).toEqual(['q-windows']);
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'zzzz' } });
    await waitFor(() => expect(r.container.textContent).toContain('No answers match.'));
  });

  it('lists every reported device, and narrows the table by name', async () => {
    const r = mount('/guide/compatibility', Devices);
    const rows = () => [...r.container.querySelectorAll('.compat tbody tr')];
    expect(rows()).toHaveLength(COMPAT.length);
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'viper v3' } });
    await waitFor(() => expect(rows().map((t) => t.querySelector('td')!.firstChild!.textContent)).toEqual(['Razer Viper V3 Pro']));
  });

  it('shows how many boxes cloned a device once the stats arrive', async () => {
    stats.value = { devices: { unique: 1, byKind: [], top: [{ vid: 0x1532, pid: 0x00c1, kind: 2, product: 'Razer Viper V3 Pro', boxes: 5 }] } };
    const r = mount('/guide/compatibility', Devices);
    const row = () => [...r.container.querySelectorAll('.compat tbody tr')].find((t) => t.textContent!.includes('Razer Viper V3 Pro'))!;
    await waitFor(() => expect(row().lastElementChild!.textContent).toBe('5'));
    expect(row().querySelector('td')!.textContent).toBe('Razer Viper V3 Pro1532:00c1');
  });

  it('names a device the stats know only by its ids once', async () => {
    stats.value = { devices: { unique: 1, byKind: [], top: [{ vid: 0x3837, pid: 0x100a, kind: 2, product: null, boxes: 3 }] } };
    const r = mount('/guide/compatibility', Devices);
    await waitFor(() => expect(r.container.textContent).toContain('3837:100a'));
    expect(r.container.textContent!.match(/3837:100a/g)).toHaveLength(1);
  });

  it('shows the release each device was reported on, and links a note naming a setting to Options', () => {
    const r = mount('/guide/compatibility', Devices);
    const row = [...r.container.querySelectorAll('tbody tr')].find((t) => t.textContent!.includes('Wooting Two HE'))!;
    expect(row.querySelector('td.v')!.textContent).toBe('v3.4.4');
    expect(row.querySelector('a.fix')!.getAttribute('href')).toBe('/dashboard#imperfect-clone');
    expect(row.querySelector('.status')!.textContent).toBe('Supported');
  });

  it('says when no device matches', async () => {
    const r = mount('/guide/compatibility', Devices);
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'zzzz' } });
    await waitFor(() => expect(r.container.textContent).toContain('No devices match.'));
    expect(r.container.querySelector('.filter .n b')!.textContent).toBe('0');
  });

  it('puts every Guide page and every Help answer in search', () => {
    const paths = entries.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(PAGES.map(([p]) => p)));
    expect(paths).toEqual(expect.arrayContaining(HELP_ITEMS.map((f) => `/guide/help#${f.id}`)));
  });
});
