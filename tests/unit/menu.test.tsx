import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { Menu, MenuItem } from '../../src/components/navigation/Menu';
import { Combobox } from '../../src/components/inputs/Combobox';

afterEach(cleanup);

const frames = () => vi.spyOn(window, 'requestAnimationFrame');
const scrollAndResize = () => {
  fireEvent.scroll(document);
  fireEvent(window, new Event('resize'));
};

describe('a menu that has closed', () => {
  it('measures nothing on a scroll or resize, so no frame loop starts', () => {
    render(() => (
      <Menu trigger={<button>Open</button>}>
        <MenuItem>One</MenuItem>
      </Menu>
    ));
    fireEvent.click(screen.getByText('Open'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    const spy = frames();
    scrollAndResize();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reports no close for a click elsewhere', () => {
    const [open, setOpen] = createSignal(false);
    const change = vi.fn((o: boolean) => setOpen(o));
    render(() => (
      <Menu open={open()} onOpenChange={change} trigger={<button>Open</button>}>
        <MenuItem>One</MenuItem>
      </Menu>
    ));
    fireEvent.click(screen.getByText('Open'));
    fireEvent.keyDown(document, { key: 'Escape' });
    change.mockClear();
    fireEvent.pointerDown(document.body);
    expect(change).not.toHaveBeenCalled();
  });

  it('under a combobox picked from once, starts no frame loop on a scroll', () => {
    const [value, setValue] = createSignal('a');
    render(() => (
      <Combobox
        value={value()}
        onChange={(v) => setValue(v as string)}
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
      />
    ));
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    const spy = frames();
    scrollAndResize();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
