import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { Search } from '../../src/app/shell/Search';
import { loadIndex } from '../../src/app/search/load';
import type { SearchIndex } from '../../src/app/search/types';

// A file apart, so the loader starts with no index: typed into before it comes, and its fetch failing.
const INDEX: SearchIndex = {
  version: 1,
  built: 'now',
  entries: [{ path: '/native/commands/lock', title: 'LOCK', kind: 'page', section: 'Native API', crumb: 'Commands', text: 'LOCK weighs physical input.' }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Search before the index is in', () => {
  it('says it is loading when typed into before the index comes', async () => {
    let answer = (_: Response) => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (answer = r))));
    render(() => <Search open onClose={() => {}} onPick={() => {}} />);
    fireEvent.input(document.querySelector<HTMLInputElement>('.srch input')!, { target: { value: 'physical input' } });
    expect(document.querySelector('.srch-none')!.textContent).toBe('Loading...');
    answer(new Response('', { status: 503 }));
    await waitFor(() => expect(document.querySelector('.srch')!.textContent).toContain("Search couldn't load."));
  });

  it('shows the results once the index comes by another way, such as pointing at the search button', async () => {
    let up = false;
    vi.stubGlobal('fetch', vi.fn(async () => (up ? new Response(JSON.stringify(INDEX)) : new Response('', { status: 503 }))));
    render(() => <Search open onClose={() => {}} onPick={() => {}} />);
    fireEvent.input(document.querySelector<HTMLInputElement>('.srch input')!, { target: { value: 'lock' } });
    await waitFor(() => expect(document.querySelector('.srch')!.textContent).toContain("Search couldn't load."));
    up = true;
    await loadIndex();
    await waitFor(() => expect(document.querySelectorAll('.srch [role="option"]').length).toBeGreaterThan(0));
    expect(document.querySelector('.srch')!.textContent).not.toContain("couldn't load");
  });
});
