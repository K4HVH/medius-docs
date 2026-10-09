import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { Segmented } from '../../src/app/shell/Segmented';
import { Select } from '../../src/app/shell/Select';
import { LogBox, logText } from '../../src/app/shell/LogBox';

afterEach(cleanup);
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('Segmented', () => {
  const opts = [
    { value: 'off', label: 'Off' },
    { value: 'half', label: 'Half' },
    { value: 'full', label: 'Full' },
  ];

  it('is a radio group with one tab stop, and picks on click and arrows', () => {
    const [v, setV] = createSignal('half');
    const { container } = render(() => <Segmented name="Spread" value={v()} options={opts} onChange={setV} />);
    const radios = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(radios.filter((r) => r.tabIndex === 0).map((r) => r.textContent)).toEqual(['Half']);
    fireEvent.click(radios[2]);
    expect(v()).toBe('full');
    fireEvent.keyDown(radios[2], { key: 'ArrowRight' });
    expect(v()).toBe('off');
    fireEvent.keyDown(radios[0], { key: 'ArrowLeft' });
    expect(v()).toBe('full');
  });

  it('a disabled group takes no pick', () => {
    const [v, setV] = createSignal('off');
    const { container } = render(() => <Segmented name="Mode" value={v()} options={opts} onChange={setV} disabled />);
    fireEvent.click(container.querySelectorAll('[role="radio"]')[1]);
    expect(v()).toBe('off');
  });
});

describe('Select', () => {
  const keys = [
    { value: '4', label: 'a (0x04)' },
    { value: '5', label: 'b (0x05)' },
    { value: '40', label: 'Enter (0x28)' },
  ];

  it('opens, filters, picks with Enter and closes', async () => {
    const [v, setV] = createSignal('4');
    const { container } = render(() => <Select value={v()} options={keys} onChange={setV} filter="Filter by name or id" />);
    const button = container.querySelector<HTMLButtonElement>('.dd-b')!;
    expect(button.textContent).toBe('a (0x04)');
    fireEvent.click(button);
    await settle();
    const input = container.querySelector<HTMLInputElement>('.dd-f')!;
    fireEvent.input(input, { target: { value: 'ent' } });
    expect([...container.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual(['Enter (0x28)']);
    fireEvent.keyDown(container.querySelector('[role="listbox"]')!, { key: 'Enter' });
    expect(v()).toBe('40');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('Escape closes without a pick, and options are not tab stops', async () => {
    const [v, setV] = createSignal('4');
    const { container } = render(() => <Select value={v()} options={keys} onChange={setV} />);
    fireEvent.click(container.querySelector('.dd-b')!);
    await settle();
    expect([...container.querySelectorAll<HTMLElement>('[role="option"]')].every((o) => o.tabIndex === -1)).toBe(true);
    fireEvent.keyDown(container.querySelector('[role="listbox"]')!, { key: 'ArrowDown' });
    fireEvent.keyDown(container.querySelector('[role="listbox"]')!, { key: 'Escape' });
    expect(v()).toBe('4');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('LogBox', () => {
  it('reads from the top, lights only the newest line, and copies each cell once', async () => {
    const [log, setLog] = createSignal<{ rows: string[][]; added: number }>({ rows: [], added: 0 });
    const rows = () => log().rows;
    const { container } = render(() => <LogBox rows={rows} added={() => log().added} empty="(no messages)" label="Device log" />);
    const push = (cells: string[]) => setLog((l) => ({ rows: [...l.rows, cells], added: l.added + 1 }));
    push(['Info', 'inter-chip link up']);
    push(['Info', 'configuration -> index 0']);
    await settle();
    const lines = container.querySelectorAll('.lg > div');
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe('Infointer-chip link up');
    expect(container.querySelectorAll('.lg > .now')).toHaveLength(1);
    expect(lines[1].classList.contains('now')).toBe(true);
    expect(logText(rows())).toBe('Info  inter-chip link up\nInfo  configuration -> index 0');
  });

  it('keeps to the source as old lines leave and when it is cleared', async () => {
    const [log, setLog] = createSignal({ rows: [['a'], ['b']], added: 2 });
    const { container } = render(() => <LogBox rows={() => log().rows} added={() => log().added} empty="(none)" label="Log" />);
    await settle();
    // Lines there when the log opened are drawn, not landing.
    expect(container.querySelectorAll('.lg > .in')).toHaveLength(0);
    setLog({ rows: [['b'], ['c']], added: 3 });
    await settle();
    expect([...container.querySelectorAll('.lg > div')].map((d) => d.textContent)).toEqual(['b', 'c']);
    expect(container.querySelector('.lg > .now')?.textContent).toBe('c');
    setLog({ rows: [], added: 3 });
    await settle();
    expect(container.querySelectorAll('.lg > div')).toHaveLength(0);
  });
});
