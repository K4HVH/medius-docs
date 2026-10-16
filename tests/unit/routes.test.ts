import { describe, it, expect, vi } from 'vitest';
import { getDocRoutes } from '../../scripts/lib/routes';

describe('getDocRoutes', () => {
  const routes = getDocRoutes();
  const paths = routes.map((r) => r.path);

  it('prerenders every page but Home, the dashboard included', () => {
    expect(paths).toContain('/native');
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/dashboard/setup');
    expect(paths).toContain('/dashboard/changelog');
    expect(paths).not.toContain('/');
    expect(paths).not.toContain('/404');
  });

  it('tags each route with its section label', () => {
    const bySection = Object.fromEntries(routes.map((r) => [r.path, r.section]));
    expect(bySection['/native/commands/clip']).toBe('Native API');
    expect(bySection['/library/clip']).toBe('Rust Library');
    expect(bySection['/bindings/python']).toBe('Bindings');
    expect(bySection['/dashboard/setup']).toBe('Dashboard');
    expect(bySection['/ai']).toBe('AI access');
  });
});

describe('pagePath', () => {
  it("shows an item's address as its parent page", async () => {
    const { pagePath } = await import('../../src/app/routes');
    expect(pagePath('/guide/help/bsod')).toBe('/guide/help');
    expect(pagePath('/native')).toBe('/native');
  });

  it('leaves alone an item the server answered with the 404 page', async () => {
    vi.resetModules();
    document.documentElement.setAttribute('data-not-found', '');
    window.history.replaceState(null, '', '/guide/help/nope');
    try {
      const { pagePath } = await import('../../src/app/routes');
      expect(pagePath('/guide/help/nope')).toBe('/guide/help/nope');
      expect(pagePath('/guide/help/bsod')).toBe('/guide/help');
    } finally {
      document.documentElement.removeAttribute('data-not-found');
      window.history.replaceState(null, '', '/');
    }
  });
});

describe('addressFor', () => {
  it('reads a place on a page as the page and the place', async () => {
    const { addressFor } = await import('../../src/app/routes');
    expect(addressFor('/native/transport/usb-identity')).toEqual({ kind: 'place', parent: '/native/transport', id: 'usb-identity', target: 'usb-identity' });
    expect(addressFor('/dashboard/options')).toEqual({ kind: 'place', parent: '/dashboard', id: 'options', target: 'options' });
    expect(addressFor('/native/commands/lock/scale/')?.target).toBe('scale');
  });

  it('reads a page as a page, and a page under a page too', async () => {
    const { addressFor } = await import('../../src/app/routes');
    expect(addressFor('/native/transport')).toBeNull();
    expect(addressFor('/bindings/c/build')).toBeNull();
    expect(addressFor('/dashboard/update')).toBeNull();
  });

  it("keeps the three kinds of item, and lands a Devices section by the section's id", async () => {
    const { addressFor } = await import('../../src/app/routes');
    expect(addressFor('/guide/help/bsod')?.kind).toBe('help');
    expect(addressFor('/dashboard/changelog/v3.4.5')?.kind).toBe('release');
    expect(addressFor('/guide/compatibility/limits')).toMatchObject({ kind: 'device', target: 'device-limits', alt: 'limits' });
  });

  it('finds no place on Home, under a place, under no page, or with a malformed id', async () => {
    const { addressFor } = await import('../../src/app/routes');
    for (const p of ['/x', '/native/transport/a/b', '/nope/x', '/native/transport/%20x', '/native/transport/-x', '/404/x', '/guide/compatibility.md', '/native/transport/usb-identity.md'])
      expect(addressFor(p), p).toBeNull();
  });

  it('shows a place as its page', async () => {
    const { pagePath } = await import('../../src/app/routes');
    expect(pagePath('/native/transport/usb-identity')).toBe('/native/transport');
    expect(pagePath('/dashboard/options')).toBe('/dashboard');
    expect(pagePath('/bindings/c/build')).toBe('/bindings/c/build');
  });
});

describe('landingId and placeAddress', () => {
  it('lands on the hash first, then the place or item the path names', async () => {
    const { landingId } = await import('../../src/app/routes');
    expect(landingId('/native/transport/usb-identity', '')).toBe('usb-identity');
    expect(landingId('/native/transport/usb-identity', '#flow')).toBe('flow');
    expect(landingId('/native/transport', '#usb%2Didentity')).toBe('usb-identity');
    expect(landingId('/native/transport', '')).toBe('');
    expect(landingId('/native/transport', '#%E0%A4%A')).toBe('');
  });

  it('lands a Devices section on its id where the page has it, else on the device row', async () => {
    const { landingId } = await import('../../src/app/routes');
    expect(landingId('/guide/compatibility/limits', '', (id) => id === 'limits')).toBe('limits');
    expect(landingId('/guide/compatibility/zowie-ec2', '', () => false)).toBe('device-zowie-ec2');
  });

  it('writes a place as the page and its id, a device row as its item address, and nothing for Home or a page', async () => {
    const { placeAddress } = await import('../../src/app/routes');
    expect(placeAddress('/native/transport', 'usb-identity')).toBe('/native/transport/usb-identity');
    expect(placeAddress('/dashboard', 'options')).toBe('/dashboard/options');
    expect(placeAddress('/guide/compatibility', 'device-zowie-ec2')).toBe('/guide/compatibility/zowie-ec2');
    expect(placeAddress('/guide/compatibility', 'limits')).toBe('/guide/compatibility/limits');
    expect(placeAddress('/', 'hero')).toBeNull();
    expect(placeAddress('/bindings/c', 'build')).toBeNull();
    expect(placeAddress('/nope', 'x')).toBeNull();
    expect(placeAddress('/native/transport', 'usb.identity')).toBeNull();
  });
});

