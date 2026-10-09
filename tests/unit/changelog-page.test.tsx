import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
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

const InRoute = () => {
  const history = createMemoryHistory();
  history.set({ value: '/dashboard/changelog' });
  return (
    <MemoryRouter history={history}>
      <Route path="*" component={Changelog} />
    </MemoryRouter>
  );
};

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
  it('anchors each release by tag, its version and date beside notes, and no lead', async () => {
    const r = render(() => <InRoute />);
    await waitFor(() => expect(r.container.querySelector('section#v3\\.4\\.5')).not.toBeNull());
    expect(r.container.querySelector('.page-header .lead')).toBeNull();
    const latest = r.container.querySelector('section#v3\\.4\\.5')!;
    expect(latest.querySelector('.rel-l h2')?.textContent).toBe('v3.4.5');
    expect(latest.querySelector('.rel-l time')?.getAttribute('datetime')).toBe('2026-10-05T12:00:00Z');
    expect([...latest.querySelectorAll('.rel-r > p.sublabel')].map((e) => e.textContent)).toEqual(['Changes']);
    expect(latest.querySelector('a[href="https://medius.k4tech.net/dashboard/update"]')).not.toBeNull();
  });

  it('folds the commits under Show commits, grouped by repo, each subject beside its hash', async () => {
    const r = render(() => <InRoute />);
    await waitFor(() => expect(r.container.querySelector('section#v3\\.4\\.5')).not.toBeNull());
    const latest = r.container.querySelector('section#v3\\.4\\.5')!;
    const button = latest.querySelector<HTMLButtonElement>('.more > button')!;
    expect(button.textContent).toBe('Show commits');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const body = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(body.querySelector('p.sublabel')?.textContent).toBe('Firmware');
    const item = body.querySelector('ol > li')!;
    expect(item.firstChild?.textContent).toBe('firmware: answered from RAM');
    expect(item.querySelector('code')?.textContent).toBe('bf6e62f');
    fireEvent.click(button);
    expect(button.textContent).toBe('Hide commits');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(latest.querySelector('.more')!.classList.contains('open')).toBe(true);
  });

  it('shows an older release its commit list, grouped, with nothing to unfold', async () => {
    const r = render(() => <InRoute />);
    await waitFor(() => expect(r.container.querySelector('section#v2\\.2\\.0')).not.toBeNull());
    const old = r.container.querySelector('section#v2\\.2\\.0')!;
    expect(old.querySelector('.more')).toBeNull();
    expect(old.querySelector('p.sublabel')?.textContent).toBe('Firmware');
    expect(old.querySelector('ol > li')?.firstChild?.textContent).toBe('fw: older');
    expect(old.querySelector('li > code')?.textContent).toBe('1234567');
  });

  it('starts from the releases the server embedded, with no Loading in between', () => {
    const data = document.createElement('script');
    data.id = 'releases-data';
    data.type = 'application/json';
    data.textContent = JSON.stringify([{ tag: 'v9.0.0', name: 'v9.0.0', publishedAt: '2026-10-01T00:00:00Z', prerelease: false, assets: [], notes: '## Changes\n- embedded' }]);
    document.body.appendChild(data);
    const r = render(() => <InRoute />);
    expect(r.container.textContent).not.toContain('Loading');
    expect(r.container.querySelector('section#v9\\.0\\.0')).not.toBeNull();
  });

  it('opens the release a link names and scrolls to it', async () => {
    window.location.hash = '#v3.4.5';
    const r = render(() => <InRoute />);
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    const latest = r.container.querySelector('section#v3\\.4\\.5')!;
    expect(latest.querySelector('.more > button')!.getAttribute('aria-expanded')).toBe('true');
  });
});
