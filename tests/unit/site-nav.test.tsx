import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { SiteNav } from '../../src/app/shell/SiteNav';

const mount = (at = '/native', props: { overHero?: boolean; disabled?: boolean } = {}) => {
  const history = createMemoryHistory();
  history.set({ value: at });
  const r = render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={() => <SiteNav {...props} />} />
    </MemoryRouter>
  ));
  const link = (label: string) => [...r.container.querySelectorAll('a')].find((a) => a.textContent?.trim().startsWith(label))!;
  const nav = () => r.container.querySelector('header.nav')!;
  const menu = () => r.container.querySelector<HTMLButtonElement>('button.menu-btn')!;
  return { ...r, history, link, nav, menu };
};

const settle = () => new Promise((res) => setTimeout(res, 0));

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('locked');
});

describe('SiteNav', () => {
  it('links the wordmark, the four sections and Install', () => {
    const r = mount();
    const hrefs = [...r.container.querySelectorAll('a')].map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(hrefs).toEqual([
      ['Medius', '/'],
      ['Guide', '/guide'],
      ['Docs', '/native'],
      ['Dashboard', '/dashboard'],
      ['Changelog', '/dashboard/changelog'],
      ['Install', '/guide'],
    ]);
  });

  it('marks the section you are in', () => {
    expect(mount('/library/inject').link('Docs').getAttribute('aria-current')).toBe('page');
    cleanup();
    expect(mount('/bindings/python/api').link('Docs').getAttribute('aria-current')).toBe('page');
    cleanup();
    const r = mount('/dashboard/changelog');
    expect(r.link('Changelog').getAttribute('aria-current')).toBe('page');
    expect(r.link('Dashboard').getAttribute('aria-current')).toBeNull();
    cleanup();
    expect(mount('/guide/faq').link('Guide').getAttribute('aria-current')).toBe('page');
  });

  it('is solid away from the landing hero, and clear over it until the page scrolls', () => {
    expect(mount('/native').nav().classList.contains('solid')).toBe(true);
    cleanup();
    const r = mount('/', { overHero: true });
    expect(r.nav().classList.contains('solid')).toBe(false);
    Object.defineProperty(window, 'scrollY', { value: 40, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(r.nav().classList.contains('solid')).toBe(true);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('opens the phone menu over a locked page, and any link closes it', async () => {
    const r = mount('/native');
    fireEvent.click(r.menu());
    expect(r.nav().classList.contains('open')).toBe(true);
    expect(r.menu().getAttribute('aria-expanded')).toBe('true');
    expect(r.menu().textContent).toBe('Close');
    expect(document.documentElement.classList.contains('locked')).toBe(true);
    fireEvent.click(r.link('Dashboard'));
    await settle();
    expect(r.nav().classList.contains('open')).toBe(false);
    expect(document.documentElement.classList.contains('locked')).toBe(false);
    expect(r.history.get()).toBe('/dashboard');
  });

  it('closes the phone menu when the page changes underneath it, as on Back', async () => {
    const r = mount('/native');
    fireEvent.click(r.menu());
    expect(r.nav().classList.contains('open')).toBe(true);
    r.history.set({ value: '/library' });
    await settle();
    expect(r.nav().classList.contains('open')).toBe(false);
    expect(document.documentElement.classList.contains('locked')).toBe(false);
  });

  it('moves focus into the open menu, keeps Tab inside it, and Escape closes it back to its button', async () => {
    const r = mount('/native');
    fireEvent.click(r.menu());
    await settle();
    const links = [...r.container.querySelectorAll<HTMLElement>('#site-links a')];
    expect(document.activeElement).toBe(links[0]);
    links[links.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(r.menu());
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(links[links.length - 1]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(r.nav().classList.contains('open')).toBe(false);
    expect(document.activeElement).toBe(r.menu());
  });

  it('puts its menu button ahead of the links it opens, for a screen reader', () => {
    const r = mount('/native');
    const button = r.menu();
    const links = r.container.querySelector('#site-links')!;
    expect(button.compareDocumentPosition(links) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('goes nowhere while a flash runs', async () => {
    const r = mount('/dashboard/setup', { disabled: true });
    for (const label of ['Medius', 'Guide', 'Docs', 'Install']) {
      fireEvent.click(r.link(label));
      await settle();
      expect(r.history.get(), label).toBe('/dashboard/setup');
    }
    expect(r.link('Docs').getAttribute('aria-disabled')).toBe('true');
  });
});
