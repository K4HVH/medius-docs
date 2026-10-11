import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import type { Component } from 'solid-js';
import { routeFor } from '../../src/app/routes';
import { HELP, HELP_ITEMS } from '../../src/app/data/help';
import { COMPAT } from '../../src/app/data/compatibility';

const stats = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../../src/dashboard/stats', async (orig) => ({
  ...(await orig<object>()),
  fetchStats: () => Promise.resolve(stats.value),
}));

import Start from '../../src/app/pages/guide/Start';
import Devices from '../../src/app/pages/guide/Devices';
import Help from '../../src/app/pages/guide/Help';
import Options from '../../src/app/pages/guide/Options';
import { OPTION_PLACES } from '../../src/app/pages/dashboard/optionPlaces';
import { extractPage } from '../../src/app/search/extract';
import { htmlToMarkdown } from '../../scripts/lib/htmlToMarkdown';

const PAGES: [string, Component][] = [
  ['/guide', Start],
  ['/guide/compatibility', Devices],
  ['/guide/help', Help],
  ['/guide/options', Options],
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

  it('sends owners to what the dashboard does, not to scripts in Discord', () => {
    const answer = (id: string) => HELP_ITEMS.find((i) => i.id === id)!;
    for (const i of HELP_ITEMS) expect(i.a, i.id).not.toMatch(/#tools|logitech_fix|fetch_makcu_fw/);
    expect(answer('no-options').a).toMatch(/v3\.2\.0/);
    expect(answer('stock-firmware').a).toMatch(/MAKCU stock/);
    expect(answer('stock-firmware').links?.map((l) => l.href)).toContain('/dashboard/update#manual');
  });

  it('explains every place on the Options tab a link can name, under the same id, and links back to it', () => {
    const r = mount('/guide/options', Options);
    for (const [id, title] of Object.entries(OPTION_PLACES)) {
      if (id === 'options') continue;
      const el = r.container.querySelector(`[id="${id}"]`);
      expect(el, id).not.toBeNull();
      const named = el!.querySelector('h2')?.getAttribute('aria-label') ?? el!.querySelector('.api-response-label > span')?.textContent;
      expect(named, id).toBe(title);
      const back = el!.querySelector('h2 a.fix, .api-response-label a.fix');
      expect(back?.getAttribute('href'), id).toBe(`/dashboard#${id}`);
      expect(back?.textContent, id).toBe('Dashboard');
      expect(el!.querySelector('thead')?.textContent, id).toMatch(/^(Value|Setting)Effect$/);
      expect(el!.textContent, id).toContain('(default');
    }
  });

  it('gives search and the Markdown twin every option, with its facts', () => {
    const r = mount('/guide/options', Options);
    const page = r.container.firstElementChild!.parentElement!;
    const route = routeFor('/guide/options')!;
    const entries = extractPage(page, { path: route.path, title: route.title, description: route.description, section: 'Guide', group: 'Guide', nav: route.nav, app: false });
    for (const id of ['imperfect-clone', 'wire-rate', 'render-full', 'spread']) expect(entries.some((e) => e.path === `/guide/options#${id}`), id).toBe(true);
    const md = htmlToMarkdown(page.innerHTML);
    expect(md).toContain('## Imperfect clone');
    expect(md).toContain('Forcing needs Imperfect clone on');
    expect(md).not.toMatch(/\[Dashboard\]/);
  });

  it("gives each Help answer a link icon that copies the answer's address", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (s: string) => void written.push(s) }, configurable: true });
    const r = mount('/guide/help', Help);
    for (const f of HELP_ITEMS) expect(r.container.querySelector(`#${f.id} h3 button.cl[data-for="${f.id}"]`), f.id).not.toBeNull();
    fireEvent.click(r.container.querySelector('#bsod h3 button.cl')!);
    await waitFor(() => expect(written).toEqual(['https://medius.k4tech.net/guide/help/bsod']));
  });

  it("gives each device row a link icon in its first cell that copies the device's address", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (s: string) => void written.push(s) }, configurable: true });
    const r = mount('/guide/compatibility', Devices);
    const rows = [...r.container.querySelectorAll('tbody tr[id]')];
    expect(rows.length).toBe(COMPAT.length);
    for (const row of rows) expect(row.querySelector(`td:first-child button.cl[data-for="${row.id}"]`), row.id).not.toBeNull();
    fireEvent.click(r.container.querySelector('#device-glorious-model-o3 button.cl')!);
    await waitFor(() => expect(written).toEqual(['https://medius.k4tech.net/guide/compatibility/glorious-model-o3']));
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

  it('matches Help as the site search does: words in any order, other endings, one slip', async () => {
    const r = mount('/guide/help', Help);
    const shown = () => [...r.container.querySelectorAll<HTMLElement>('.qa')].filter((q) => !q.hidden).map((q) => q.id);
    const input = r.container.querySelector('input[type="search"]')!;
    fireEvent.input(input, { target: { value: 'screens blue' } });
    await waitFor(() => expect(shown()).toEqual(['bsod']));
    fireEvent.input(input, { target: { value: 'logitch' } });
    await waitFor(() => expect(shown()).toContain('logitech'));
  });

  it('finds a model number inside a name, and 8K as the site writes it', async () => {
    const r = mount('/guide/compatibility', Devices);
    const names = () => [...r.container.querySelectorAll('.compat tbody tr')].map((t) => t.querySelector('td')!.firstChild!.textContent);
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: '502' } });
    await waitFor(() => expect(names().length).toBeGreaterThan(0));
    expect(names().every((n) => /502/.test(n!))).toBe(true);
    const help = mount('/guide/help', Help);
    fireEvent.input(help.container.querySelectorAll('input[type="search"]')[0]!, { target: { value: '8k' } });
    await waitFor(() => expect([...help.container.querySelectorAll<HTMLElement>('.qa')].filter((q) => !q.hidden).map((q) => q.id)).toContain('razer-8k'));
  });

  it('narrows the devices by the words of a name in any order', async () => {
    const r = mount('/guide/compatibility', Devices);
    const rows = () => [...r.container.querySelectorAll('.compat tbody tr')];
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'viper pro' } });
    await waitFor(() => expect(rows().map((t) => t.querySelector('td')!.firstChild!.textContent)).toContain('Razer Viper V3 Pro'));
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
    expect(row().querySelector('td')!.textContent).toBe('Razer Viper V3 Pro 1532:00c1');
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

});
