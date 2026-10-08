import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { DocsSidebar } from '../../src/app/shell/DocsSidebar';

let made = 0;
const Slot = () => {
  made++;
  return <div id="boxes-slot">boxes</div>;
};

const mount = (at: string, props: { disabled?: boolean; onSearch?: () => void; boxes?: boolean; title?: string } = {}) => {
  const history = createMemoryHistory();
  history.set({ value: at });
  const onSearch = props.onSearch ?? vi.fn();
  const r = render(() => (
    <MemoryRouter history={history}>
      <Route
        path="*"
        component={(p) => (
          <DocsSidebar
            pathname={p.location.pathname}
            disabled={props.disabled}
            onSearch={onSearch}
            title={props.title}
            boxes={props.boxes ? <Slot /> : undefined}
          />
        )}
      />
    </MemoryRouter>
  ));
  const side = () => r.container.querySelector('aside.side')!;
  const link = (label: string, scope: ParentNode = side()) =>
    [...scope.querySelectorAll('a')].find((a) => a.textContent?.trim() === label)!;
  const docbar = () => r.container.querySelector<HTMLButtonElement>('button.docbar')!;
  return { ...r, history, side, link, docbar, onSearch };
};

const settle = () => new Promise((res) => setTimeout(res, 0));

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('locked');
});

describe('DocsSidebar', () => {
  it('switches between the code sections and marks the one you are in', () => {
    const r = mount('/native/commands/inject');
    const sections = r.side().querySelector('.sections')!;
    expect([...sections.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Native', '/native'],
      ['Rust', '/library'],
      ['Bindings', '/bindings'],
    ]);
    expect(r.link('Native', sections).getAttribute('aria-current')).toBe('true');
    expect(r.link('Inject').getAttribute('aria-current')).toBe('page');
    expect(r.link('Move').getAttribute('aria-current')).toBeNull();
  });

  it('marks Rust on a library page and shows its groups', () => {
    const r = mount('/library/inject');
    expect(r.link('Rust', r.side().querySelector('.sections')!).getAttribute('aria-current')).toBe('true');
    expect(r.link('Inject').getAttribute('href')).toBe('/library/inject');
  });

  it('adds the language switcher on bindings pages', () => {
    const r = mount('/bindings/python/api');
    const langs = r.side().querySelector('.sections.langs')!;
    expect([...langs.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Overview', 'C / C++', 'Python']);
    expect(r.link('Python', langs).getAttribute('aria-current')).toBe('true');
    expect(r.link('API index').getAttribute('aria-current')).toBe('page');
  });

  it('shows the guide without the code switcher', () => {
    const r = mount('/guide/faq');
    expect(r.side().querySelector('.sections')).toBeNull();
    expect([...r.side().querySelectorAll('.group a')].map((a) => a.getAttribute('href'))).toEqual([
      '/guide',
      '/guide/update',
      '/guide/compatibility',
      '/guide/faq',
      '/guide/troubleshooting',
      '/guide/device-fixes',
    ]);
  });

  it('shows the box list on dashboard pages, built once', () => {
    made = 0;
    const r = mount('/dashboard', { boxes: true });
    expect(r.side().querySelectorAll('#boxes-slot')).toHaveLength(1);
    expect(made).toBe(1);
    expect(r.link('Device').getAttribute('aria-current')).toBe('page');
  });

  it('puts the title it is given in the page bar', () => {
    const r = mount('/dashboard', { title: 'Device - Desk' });
    expect(r.docbar().querySelector('b')?.textContent).toBe('Device - Desk');
  });

  it('opens search from its button', () => {
    const r = mount('/native');
    fireEvent.click(r.side().querySelector('button.search')!);
    expect(r.onSearch).toHaveBeenCalled();
  });

  it('goes nowhere while a flash runs', async () => {
    const r = mount('/dashboard/setup', { disabled: true });
    fireEvent.click(r.link('Device'));
    await settle();
    expect(r.history.get()).toBe('/dashboard/setup');
    expect(r.link('Device').getAttribute('aria-disabled')).toBe('true');
  });

  it('moves focus into the open panel, keeps Tab inside it, and Escape closes it back to the bar', async () => {
    const r = mount('/native');
    fireEvent.click(r.docbar());
    await settle();
    const inside = [...r.side().querySelectorAll<HTMLElement>('a, button')];
    expect(document.activeElement).toBe(inside[0]);
    inside[inside.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(r.docbar());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(r.side().classList.contains('open')).toBe(false);
    expect(document.activeElement).toBe(r.docbar());
  });

  it('opens as a full panel on a phone, locks the page, and a link closes it', async () => {
    const r = mount('/native/commands/inject');
    expect(r.docbar().textContent).toContain('Native API / Inject');
    fireEvent.click(r.docbar());
    expect(r.side().classList.contains('open')).toBe(true);
    expect(r.docbar().getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.classList.contains('locked')).toBe(true);
    fireEvent.click(r.link('Move'));
    await settle();
    expect(r.side().classList.contains('open')).toBe(false);
    expect(document.documentElement.classList.contains('locked')).toBe(false);
    expect(r.history.get()).toBe('/native/commands/move');
  });
});
