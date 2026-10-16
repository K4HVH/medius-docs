import { describe, it, expect } from 'vitest';
import { MemoryRouter, Route, createMemoryHistory, useNavigate, type RouteSectionProps } from '@solidjs/router';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { onCleanup } from 'solid-js';

// The router's ranking: a page under a page beats the parent's place segment, and a page with its
// places stays one mounted page.
describe('a page and the places on it', () => {
  it('reaches a page under a page, not a place of that name on its parent', async () => {
    const history = createMemoryHistory();
    history.set({ value: '/bindings/c/build' });
    const r = render(() => (
      <MemoryRouter history={history}>
        <Route path="/bindings/c/:place?" component={() => <p>C</p>} />
        <Route path="/bindings/c/build/:place?" component={() => <p>Build</p>} />
      </MemoryRouter>
    ));
    await waitFor(() => expect(r.container.textContent).toBe('Build'));
    cleanup();
  });

  it('keeps the page mounted across its places', async () => {
    const history = createMemoryHistory();
    history.set({ value: '/dashboard' });
    let mounts = 0;
    let unmounts = 0;
    let go: (to: string) => void = () => {};
    const Page = (props: RouteSectionProps) => {
      mounts++;
      onCleanup(() => unmounts++);
      go = useNavigate();
      return <p>{props.params.place ?? 'top'}</p>;
    };
    const r = render(() => (
      <MemoryRouter history={history}>
        <Route path="/dashboard/:place?" component={Page} />
      </MemoryRouter>
    ));
    await waitFor(() => expect(r.container.textContent).toBe('top'));
    go('/dashboard/options');
    await waitFor(() => expect(r.container.textContent).toBe('options'));
    go('/dashboard/log');
    await waitFor(() => expect(r.container.textContent).toBe('log'));
    expect([mounts, unmounts]).toEqual([1, 0]);
    cleanup();
  });
});
