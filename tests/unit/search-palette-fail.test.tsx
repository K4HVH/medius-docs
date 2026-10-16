import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { Search } from '../../src/app/shell/Search';
import type { SearchIndex } from '../../src/app/search/types';

// A file apart, so the index loads afresh: the first fetch fails.

const INDEX: SearchIndex = {
  version: 1,
  built: 'now',
  entries: [{ path: '/native/commands/lock', title: 'LOCK', kind: 'page', section: 'Native API', crumb: 'Commands', text: '' }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Search when the index will not load', () => {
  it('says so with a Retry that loads it, and keeps the main pages on offer meanwhile', async () => {
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (fail ? new Response('', { status: 500 }) : new Response(JSON.stringify(INDEX), { status: 200 }))),
    );
    render(() => <Search open onClose={() => {}} onPick={() => {}} />);
    const input = document.querySelector<HTMLInputElement>('.srch input')!;
    expect(document.querySelector('.srch')!.textContent).toContain('Start here');
    fireEvent.input(input, { target: { value: 'lock' } });
    await waitFor(() => expect(document.querySelector('.srch-fail')!.textContent).toContain("Search couldn't load."));
    // Tab reaches Retry, and from it comes back to the box.
    const retry = document.querySelector<HTMLButtonElement>('.srch-fail button')!;
    for (let i = 0; i < 3 && document.activeElement !== retry; i++) fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(retry);
    fireEvent.keyDown(retry, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
    fail = false;
    retry.focus();
    fireEvent.click(retry);
    expect(document.activeElement).toBe(input);
    await waitFor(() => expect(document.querySelector('.srch [role="option"] .t')!.textContent).toBe('LOCK'));
  });
});
