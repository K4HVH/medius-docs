import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import type { Component } from 'solid-js';
import { routeFor } from '../../src/app/routes';
import { FAQ } from '../../src/app/data/faq';
import { COMPAT } from '../../src/app/data/compatibility';
import { entries } from '../../src/app/searchIndex';

const stats = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../../src/dashboard/stats', async (orig) => ({
  ...(await orig<object>()),
  fetchStats: () => Promise.resolve(stats.value),
}));

import Install from '../../src/app/pages/guide/Install';
import Update from '../../src/app/pages/guide/Update';
import Compatibility from '../../src/app/pages/guide/Compatibility';
import Faq from '../../src/app/pages/guide/Faq';
import Troubleshooting from '../../src/app/pages/guide/Troubleshooting';
import DeviceFixes from '../../src/app/pages/guide/DeviceFixes';

const PAGES: [string, Component][] = [
  ['/guide', Install],
  ['/guide/update', Update],
  ['/guide/compatibility', Compatibility],
  ['/guide/faq', Faq],
  ['/guide/troubleshooting', Troubleshooting],
  ['/guide/device-fixes', DeviceFixes],
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

  it('gives each FAQ entry its own section, reachable by its id', () => {
    const r = mount('/guide/faq', Faq);
    for (const f of FAQ) {
      const s = r.container.querySelector(`section#${f.id}`)!;
      expect(s, f.id).not.toBeNull();
      expect(s.querySelector('h2')!.textContent).toContain(f.q);
      expect(s.textContent).toContain(f.a);
    }
  });

  it('lists every reported device, and narrows the table by name', async () => {
    const r = mount('/guide/compatibility', Compatibility);
    const rows = () => [...r.container.querySelectorAll('tbody tr')];
    expect(rows()).toHaveLength(COMPAT.length);
    fireEvent.input(r.container.querySelector('input[type="search"]')!, { target: { value: 'viper v3' } });
    await waitFor(() => expect(rows().map((t) => t.querySelector('td')!.firstChild!.textContent)).toEqual(['Razer Viper V3 Pro']));
  });

  it('shows how many boxes cloned a device once the stats arrive', async () => {
    stats.value = { devices: { unique: 1, byKind: [], top: [{ vid: 0x1532, pid: 0x00c1, kind: 2, product: 'Razer Viper V3 Pro', boxes: 5 }] } };
    const r = mount('/guide/compatibility', Compatibility);
    const row = () => [...r.container.querySelectorAll('tbody tr')].find((t) => t.textContent!.includes('Razer Viper V3 Pro'))!;
    await waitFor(() => expect(row().lastElementChild!.textContent).toBe('5'));
    expect(row().querySelector('td')!.textContent).toBe('Razer Viper V3 Pro1532:00c1');
  });

  it('names a device the stats know only by its ids once', async () => {
    stats.value = { devices: { unique: 1, byKind: [], top: [{ vid: 0x3837, pid: 0x100a, kind: 2, product: null, boxes: 3 }] } };
    const r = mount('/guide/compatibility', Compatibility);
    await waitFor(() => expect(r.container.textContent).toContain('3837:100a'));
    expect(r.container.textContent!.match(/3837:100a/g)).toHaveLength(1);
  });

  it('puts every Guide page and every FAQ answer in search', () => {
    const paths = entries.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(PAGES.map(([p]) => p)));
    expect(paths).toEqual(expect.arrayContaining(FAQ.map((f) => `/guide/faq#${f.id}`)));
  });
});
