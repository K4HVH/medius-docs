import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { CopyLink } from '../../src/app/shell/CopyLink';

const SITE = 'https://medius.k4tech.net';
let written: string[];

const clipboard = (writeText: (s: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

beforeEach(() => {
  written = [];
  clipboard(async (s) => void written.push(s));
  history.replaceState(null, '', '/native/commands/lock');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  history.replaceState(null, '', '/');
});

const button = (r: ReturnType<typeof render>) => r.container.querySelector<HTMLButtonElement>('button.cl')!;

describe('CopyLink', () => {
  it('is a labelled button with no text of its own, out of search and the Markdown twins', () => {
    const b = button(render(() => <CopyLink id="scale" label="Scale" />));
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('aria-label')).toBe('Copy link to Scale');
    expect(b.dataset.for).toBe('scale');
    expect(b.hasAttribute('data-search-skip')).toBe(true);
    expect(b.hasAttribute('data-agent-hide')).toBe(true);
    expect(b.textContent).toBe('');
  });

  it("copies the page's full address with the place's id", async () => {
    const b = button(render(() => <CopyLink id="scale" label="Scale" />));
    fireEvent.click(b);
    await waitFor(() => expect(b.dataset.state).toBe('copied'));
    expect(written).toEqual([`${SITE}/native/commands/lock#scale`]);
  });

  it('copies the address it is given', async () => {
    fireEvent.click(button(render(() => <CopyLink id="bsod" label="My PC blue-screens" to="/guide/help/bsod" />)));
    await waitFor(() => expect(written).toEqual([`${SITE}/guide/help/bsod`]));
  });

  it("names the parent page on an item's address", async () => {
    history.replaceState(null, '', '/guide/help/bsod');
    fireEvent.click(button(render(() => <CopyLink id="q-install" label="Install" />)));
    await waitFor(() => expect(written).toEqual([`${SITE}/guide/help#q-install`]));
  });

  it("falls back to the browser's copy command where the clipboard is refused", async () => {
    clipboard(async () => {
      throw new Error('denied');
    });
    let copied = '';
    const exec = vi.fn(() => ((copied = document.querySelector('textarea')?.value ?? ''), true));
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    const b = button(render(() => <CopyLink id="scale" label="Scale" />));
    fireEvent.click(b);
    await waitFor(() => expect(b.dataset.state).toBe('copied'));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(copied).toBe(`${SITE}/native/commands/lock#scale`);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('says it did not copy when both are refused', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    const b = button(render(() => <CopyLink id="scale" label="Scale" />));
    fireEvent.click(b);
    await waitFor(() => expect(b.dataset.state).toBe('failed'));
  });

  it('shows the result for 1.5 s, counted again from a second click', async () => {
    vi.useFakeTimers();
    const b = button(render(() => <CopyLink id="scale" label="Scale" />));
    fireEvent.click(b);
    await vi.advanceTimersByTimeAsync(1000);
    expect(b.dataset.state).toBe('copied');
    fireEvent.click(b);
    await vi.advanceTimersByTimeAsync(1000);
    expect(b.dataset.state).toBe('copied');
    await vi.advanceTimersByTimeAsync(600);
    expect(b.dataset.state).toBeUndefined();
  });

  it('tells a screen reader, from outside the heading', async () => {
    const r = render(() => (
      <h2>
        Scale
        <CopyLink id="scale" label="Scale" />
      </h2>
    ));
    fireEvent.click(button(r));
    await waitFor(() => expect(document.querySelector('[role="status"].cl-said')?.textContent).toBe('Link copied'));
    expect(r.container.querySelector('h2')!.textContent).toBe('Scale');
  });
});
