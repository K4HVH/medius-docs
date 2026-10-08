import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { COMMITS_MARKER } from '../../src/dashboard/firmware/notes';

const fetchCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => (fetchCalls.n++, [
    {
      tag: 'v3.4.5', name: 'v3.4.5', publishedAt: '2026-10-05T12:00:00Z', prerelease: false, assets: [],
      notes: `## Changes\n- Update here: https://medius.k4tech.net/dashboard/update.\n\n${COMMITS_MARKER}\n## Commits\n**Firmware**\n- firmware: answered from RAM (bf6e62f)`,
    },
    { tag: 'v2.2.0', name: 'v2.2.0', publishedAt: '2026-06-30T12:00:00Z', prerelease: false, assets: [], notes: '**Firmware**\n- fw: older (1234567)' },
  ]),
}));

import Changelog from '../../src/app/pages/dashboard/Changelog';

beforeEach(() => {
  fetchCalls.n = 0;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  document.getElementById('releases-data')?.remove();
  window.location.hash = '';
});

describe('Changelog', () => {
  it('anchors each release by tag, notes open and commits folded under Show commits', async () => {
    const r = render(() => <Changelog />);
    await waitFor(() => expect(r.container.querySelector('section#v3\\.4\\.5')).not.toBeNull());
    const latest = r.container.querySelector('section#v3\\.4\\.5')!;
    expect(latest.querySelector('details > summary')?.textContent).toBe('Show commits');
    expect(latest.querySelector('details')?.textContent).toContain('answered from RAM');
    expect(latest.querySelector('a[href="https://medius.k4tech.net/dashboard/update"]')).not.toBeNull();
  });

  it('shows an older release its commit list with nothing to unfold', async () => {
    const r = render(() => <Changelog />);
    await waitFor(() => expect(r.container.querySelector('section#v2\\.2\\.0')).not.toBeNull());
    const old = r.container.querySelector('section#v2\\.2\\.0')!;
    expect(old.textContent).toContain('fw: older (1234567)');
    expect(old.querySelector('details')).toBeNull();
  });

  it('starts from the releases the server embedded, with no Loading in between', () => {
    const data = document.createElement('script');
    data.id = 'releases-data';
    data.type = 'application/json';
    data.textContent = JSON.stringify([{ tag: 'v9.0.0', name: 'v9.0.0', publishedAt: '2026-10-01T00:00:00Z', prerelease: false, assets: [], notes: '## Changes\n- embedded' }]);
    document.body.appendChild(data);
    const r = render(() => <Changelog />);
    expect(r.container.textContent).not.toContain('Loading');
    expect(r.container.querySelector('section#v9\\.0\\.0')).not.toBeNull();
  });

  it('opens the release a link names and scrolls to it', async () => {
    window.location.hash = '#v3.4.5';
    const r = render(() => <Changelog />);
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    const latest = r.container.querySelector('section#v3\\.4\\.5')!;
    expect(latest.querySelector('details')!.hasAttribute('open')).toBe(true);
  });
});
