import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { SiteNav } from '../../src/app/shell/SiteNav';
import { useLeaveFade } from '../../src/app/shell/leave';
import { useScrollPlace } from '../../src/app/shell/scrollPlace';

const mount = (at = '/native', props: { disabled?: boolean } = {}) => {
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
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const scrollTo = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
};

// As the app has it: one bar over every page, and links that fade the page out before the next arrives.
const across = (at: string) => {
  const history = createMemoryHistory();
  history.set({ value: at });
  const r = render(() => (
    <MemoryRouter
      history={history}
      root={(p) => {
        useLeaveFade(() => false);
        useScrollPlace();
        return (
          <>
            <SiteNav />
            {p.children}
          </>
        );
      }}
    >
      <Route path="/" component={() => <div class="landing">landing</div>} />
      <Route path="/guide" component={() => <main class="docs-page">guide</main>} />
    </MemoryRouter>
  ));
  const link = (label: string) => [...r.container.querySelectorAll('header.nav a')].find((a) => a.textContent?.trim().startsWith(label))!;
  const nav = () => r.container.querySelector('header.nav')!;
  return { ...r, history, link, nav };
};

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
    expect(mount('/guide/help').link('Guide').getAttribute('aria-current')).toBe('page');
  });

  it('is solid away from the landing hero, and clear over it until the page scrolls', () => {
    expect(mount('/native').nav().classList.contains('solid')).toBe(true);
    cleanup();
    const r = mount('/');
    expect(r.nav().classList.contains('solid')).toBe(false);
    scrollTo(40);
    expect(r.nav().classList.contains('solid')).toBe(true);
    scrollTo(0);
  });

  it('stays one bar between the landing and the other pages, so its words never fade with a page', async () => {
    const r = across('/');
    const bar = r.nav();
    fireEvent.click(r.link('Guide'));
    await wait(200);
    expect(r.history.get()).toBe('/guide');
    expect(r.nav()).toBe(bar);
    fireEvent.click(r.link('Medius'));
    await wait(200);
    expect(r.history.get()).toBe('/');
    expect(r.nav()).toBe(bar);
  });

  it('turns solid as the landing fades out for another page, at the pace of that fade', () => {
    const r = across('/');
    expect(r.nav().classList.contains('solid')).toBe(false);
    fireEvent.click(r.link('Guide'));
    expect(r.history.get()).toBe('/');
    expect(r.nav().classList.contains('solid')).toBe(true);
    expect(r.nav().classList.contains('routed')).toBe(true);
  });

  it('clears as a page fades out for the landing, though the page it leaves is scrolled', () => {
    scrollTo(400);
    const r = across('/guide');
    window.dispatchEvent(new Event('scroll'));
    expect(r.nav().classList.contains('solid')).toBe(true);
    fireEvent.click(r.link('Medius'));
    expect(r.nav().classList.contains('solid')).toBe(false);
    scrollTo(0);
  });

  it('stays clear once the landing is in, though the page it came from was scrolled', async () => {
    scrollTo(1000);
    const r = across('/guide');
    fireEvent.click(r.link('Medius'));
    await wait(200);
    expect(r.history.get()).toBe('/');
    expect(r.nav().classList.contains('solid')).toBe(false);
    scrollTo(0);
  });

  it('fades at the slower scroll pace when the landing scrolls under it', () => {
    const r = across('/');
    scrollTo(40);
    expect(r.nav().classList.contains('solid')).toBe(true);
    expect(r.nav().classList.contains('routed')).toBe(false);
    scrollTo(0);
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
