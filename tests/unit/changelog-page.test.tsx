import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { COMMITS_MARKER } from '../../src/dashboard/firmware/notes';

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => [
    {
      tag: 'v3.4.5', name: 'v3.4.5', publishedAt: '2026-10-05T12:00:00Z', prerelease: false, assets: [],
      notes: `## Changes\n- Update here: https://medius.k4tech.net/dashboard/update.\n\n${COMMITS_MARKER}\n## Commits\n**Firmware**\n- firmware: answered from RAM (bf6e62f)`,
    },
    { tag: 'v2.2.0', name: 'v2.2.0', publishedAt: '2026-06-30T12:00:00Z', prerelease: false, assets: [], notes: '**Firmware**\n- fw: older (1234567)' },
  ],
}));

import Changelog from '../../src/app/pages/dashboard/Changelog';

afterEach(cleanup);

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
});
