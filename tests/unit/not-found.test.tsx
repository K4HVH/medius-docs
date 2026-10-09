import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import NotFound from '../../src/app/pages/NotFound';

afterEach(cleanup);

describe('NotFound', () => {
  it('stays on the unknown address and links to the main pages', () => {
    const history = createMemoryHistory();
    history.set({ value: '/zzz' });
    const r = render(() => (
      <MemoryRouter history={history}>
        <Route path="*" component={NotFound} />
      </MemoryRouter>
    ));
    const h1 = r.container.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Page not found');
    expect(r.container.querySelector('.lost .num')!.textContent).toBe('404');
    // The request line names the address asked for.
    expect([...r.container.querySelectorAll('.req span')].map((e) => e.textContent)).toEqual(['GET', '/zzz', '404']);
    expect(r.container.querySelector('.page-header .lead')).toBeNull();
    const hrefs = [...r.container.querySelectorAll('nav.index a.go')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/dashboard/setup', '/dashboard', '/native']);
    expect(r.container.querySelector('#not-found[data-search-target]')).not.toBeNull();
    expect(history.get()).toBe('/zzz');
  });

  it('follows a page that moved, keeping the old anchor unless the new address names one', async () => {
    for (const [from, to] of [
      ['/guide/faq#bsod', '/guide/help#bsod'],
      ['/guide/update#rollback', '/guide/help#q-update'],
    ]) {
      const history = createMemoryHistory();
      history.set({ value: from });
      render(() => (
        <MemoryRouter history={history}>
          <Route path="*" component={NotFound} />
        </MemoryRouter>
      ));
      await new Promise((res) => setTimeout(res, 0));
      expect(history.get()).toBe(to);
      cleanup();
    }
  });

  it('follows a moved page reached from another unknown address, not only on arrival', async () => {
    const history = createMemoryHistory();
    history.set({ value: '/nope' });
    render(() => (
      <MemoryRouter history={history}>
        <Route path="*" component={NotFound} />
      </MemoryRouter>
    ));
    await new Promise((res) => setTimeout(res, 0));
    history.set({ value: '/guide/faq#bsod' });
    await new Promise((res) => setTimeout(res, 0));
    expect(history.get()).toBe('/guide/help#bsod');
  });

  it('is the catch-all inside the docs layout, not a redirect home', () => {
    const app = readFileSync(join(__dirname, '../../src/app/App.tsx'), 'utf8');
    expect(app).toContain('<Route path="*" component={NotFound} />');
    expect(app).not.toContain('Navigate');
    expect(app.indexOf('<Route path="*"')).toBeLessThan(app.lastIndexOf('</Route>'));
  });
});
