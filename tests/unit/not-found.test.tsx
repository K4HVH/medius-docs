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
    expect(r.container.textContent).toContain('Page not found');
    const hrefs = [...r.container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/native', '/library', '/dashboard/setup']));
    expect(r.container.querySelector('#not-found[data-search-target]')).not.toBeNull();
    expect(history.get()).toBe('/zzz');
  });

  it('is the catch-all inside the docs layout, not a redirect home', () => {
    const app = readFileSync(join(__dirname, '../../src/app/App.tsx'), 'utf8');
    expect(app).toContain('<Route path="*" component={NotFound} />');
    expect(app).not.toContain('Navigate');
    expect(app.indexOf('<Route path="*"')).toBeLessThan(app.lastIndexOf('</Route>'));
  });
});
