import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { MemoryRouter, Route } from '@solidjs/router';
import { SiteFooter } from '../../src/app/shell/SiteFooter';
import { routeFor } from '../../src/app/routes';
import { LINKS } from '../../src/app/site';

afterEach(cleanup);

describe('SiteFooter', () => {
  const mount = () =>
    render(() => (
      <MemoryRouter>
        <Route path="*" component={() => <SiteFooter />} />
      </MemoryRouter>
    ));

  it('links only to pages that exist', () => {
    const r = mount();
    const internal = [...r.container.querySelectorAll('footer a')]
      .map((a) => a.getAttribute('href')!)
      .filter((h) => h.startsWith('/'));
    expect(internal.length).toBeGreaterThanOrEqual(8);
    for (const h of internal) expect(routeFor(h), h).toBeDefined();
  });

  it('groups its links under Guide, Docs, Dashboard and Community', () => {
    const r = mount();
    const titles = [...r.container.querySelectorAll('footer h4')].map((h) => h.textContent);
    expect(titles).toEqual(['Guide', 'Docs', 'Dashboard', 'Community']);
    expect(r.container.querySelector('footer')!.textContent).toContain('Firmware for the MAKCU box.');
    expect(r.container.querySelector('footer')!.textContent).toContain('© 2026 K4TECH');
  });

  it('links Discord, GitHub, crates.io and PyPI in a new tab', () => {
    const r = mount();
    const external = [...r.container.querySelectorAll('footer a')].filter((a) => !a.getAttribute('href')!.startsWith('/'));
    expect(external.map((a) => a.getAttribute('href')).sort()).toEqual(Object.values(LINKS).sort());
    for (const a of external) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noreferrer');
    }
  });
});
