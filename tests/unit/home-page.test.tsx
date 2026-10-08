import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import Home from '../../src/app/pages/Home';
import { DESCRIPTOR_SAMPLE } from '../../src/app/data/samples';

const page = () => {
  const history = createMemoryHistory();
  history.set({ value: '/' });
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={Home} />
    </MemoryRouter>
  ));
};
const vitals = (c: HTMLElement) => [...c.querySelectorAll('.vitals dd')].map((d) => d.textContent);

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  document.getElementById('home-data')?.remove();
  vi.unstubAllGlobals();
});

describe('Home', () => {
  it('is the hero, the feed, the descriptor compare, the index and the footer', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    const r = page();
    const h1 = r.container.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Replacement firmware for the MAKCU box.');
    expect(r.container.querySelector('main#home .hero .tape')).not.toBeNull();
    expect(r.container.querySelector('.desc-src')!.textContent).toContain(DESCRIPTOR_SAMPLE.device);
    expect(r.container.querySelectorAll('.index a.go')).toHaveLength(4);
    expect(r.container.querySelector('.site-footer')).not.toBeNull();
    expect(r.container.querySelector('.nav .brand')!.getAttribute('href')).toBe('/');
  });

  it('takes the figures the server put in the page, and asks for nothing', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const data = document.createElement('script');
    data.type = 'application/json';
    data.id = 'home-data';
    data.textContent = JSON.stringify({ firmware: 'v3.4.5', devices: 70, boxes: 1201, discord: 596 });
    document.body.appendChild(data);
    const r = page();
    await waitFor(() => expect(vitals(r.container)).toEqual(['v3.4.5', 'MAKCU, 2× ESP32-S3', '70', '1,201']));
    expect(r.container.querySelector('[data-fill="vital-discord"]')!.textContent).toBe('596 members');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks the server when the page carries no figures', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ firmware: 'v3.4.5', boxes: 9 }))));
    vi.stubGlobal('fetch', fetch);
    const r = page();
    await waitFor(() => expect(vitals(r.container)).toEqual(['v3.4.5', 'MAKCU, 2× ESP32-S3', '', '9']));
    expect(fetch).toHaveBeenCalledWith('/api/home');
  });

  it('leaves the cells empty when the server cannot answer', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetch);
    const r = page();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await Promise.resolve();
    expect(vitals(r.container)).toEqual(['', 'MAKCU, 2× ESP32-S3', '', '']);
    expect(r.container.textContent).not.toMatch(/undefined|NaN|Loading/);
  });
});
