import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import AiActions from '../../src/app/AiActions';

afterEach(cleanup);

describe('AiActions', () => {
  it("offers a place's page as Markdown, since a place has no twin", async () => {
    const history = createMemoryHistory();
    history.set({ value: '/native/transport/usb-identity' });
    const r = render(() => (
      <MemoryRouter history={history}>
        <Route path="/native/transport/:place?" component={AiActions} />
      </MemoryRouter>
    ));
    await waitFor(() => expect(r.container.querySelector('button[aria-label="Use this page with AI"]')).not.toBeNull());
    fireEvent.click(r.container.querySelector('button[aria-label="Use this page with AI"]')!);
    await waitFor(() => expect(document.querySelector('a.ai-actions__item[href$=".md"]')).not.toBeNull());
    expect(document.querySelector('a.ai-actions__item[href$=".md"]')!.getAttribute('href')).toBe('/native/transport.md');
  });
});
