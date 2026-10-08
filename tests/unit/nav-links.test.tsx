import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { NavLinks } from '../../src/app/NavLinks';

const ITEMS = [
  { href: '/native', label: 'Introduction' },
  { href: '/native/quickstart', label: 'Quickstart' },
];

const mount = (props: { disabled?: boolean; onNavigate?: () => void; current?: 'page' | 'true'; label?: string } = {}, at = '/native') => {
  const history = createMemoryHistory();
  history.set({ value: at });
  const r = render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={() => <NavLinks items={ITEMS} active="/native" {...props} />} />
    </MemoryRouter>
  ));
  const link = (label: string) => [...r.container.querySelectorAll('a')].find((a) => a.textContent === label)!;
  return { ...r, history, link };
};

afterEach(cleanup);

describe('NavLinks', () => {
  it('renders each entry as a link with MidnightUI tab classes, the current one active', () => {
    const r = mount();
    const links = [...r.container.querySelectorAll('nav a.tabs__tab')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/native', '/native/quickstart']);
    expect(r.link('Introduction').classList.contains('tabs__tab--active')).toBe(true);
    expect(r.link('Introduction').getAttribute('aria-current')).toBe('page');
    expect(r.link('Quickstart').classList.contains('tabs__tab--active')).toBe(false);
    expect(r.container.querySelector('.tabs.tabs--subtle.tabs--vertical')).not.toBeNull();
  });

  it('navigates on click and reports it', async () => {
    const onNavigate = vi.fn();
    const r = mount({ onNavigate });
    fireEvent.click(r.link('Quickstart'));
    await new Promise((res) => setTimeout(res, 0));
    expect(r.history.get()).toBe('/native/quickstart');
    expect(onNavigate).toHaveBeenCalled();
  });

  it('goes nowhere while disabled, and says so', async () => {
    const onNavigate = vi.fn();
    const r = mount({ disabled: true, onNavigate });
    expect(r.container.querySelector('.tabs--disabled')).not.toBeNull();
    expect(r.link('Quickstart').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(r.link('Quickstart'));
    await new Promise((res) => setTimeout(res, 0));
    expect(r.history.get()).toBe('/native');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('names its landmark and marks the section you are in, deeper than its root, as current but not the page', () => {
    const r = mount({ label: 'Sections', current: 'true' }, '/native/commands/inject');
    expect(r.container.querySelector('nav')!.getAttribute('aria-label')).toBe('Sections');
    expect(r.link('Introduction').getAttribute('aria-current')).toBe('true');
  });
});
