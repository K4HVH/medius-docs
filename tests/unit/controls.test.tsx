import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { Segmented } from '../../src/app/shell/Segmented';
import { Select } from '../../src/app/shell/Select';
import { Range } from '../../src/app/shell/Range';
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

  it('keeps its buttons, and the focus on one, when a poll hands it the same options anew', () => {
    const [o, setO] = createSignal(opts.map((x) => ({ ...x })));
    const { container } = render(() => <Segmented name="Spread" value="half" options={o()} />);
    const half = container.querySelectorAll<HTMLElement>('[role="radio"]')[1];
    half.focus();
    setO(opts.map((x) => ({ ...x })));
    expect(container.querySelectorAll('[role="radio"]')[1]).toBe(half);
    expect(document.activeElement).toBe(half);
  });

  it('a disabled group takes no pick', () => {
    const [v, setV] = createSignal('off');
    const { container } = render(() => <Segmented name="Mode" value={v()} options={opts} onChange={setV} disabled />);
    fireEvent.click(container.querySelectorAll('[role="radio"]')[1]);
    expect(v()).toBe('off');
  });
});

describe('Segmented layout', () => {
  // jsdom lays nothing out: a row too narrow for its labels puts the last option on a second line, a column puts
  // each on its own line, and a hidden choice has no lines at all.
  const long = [
    { value: 'off', label: 'Switched off' },
    { value: 'half', label: 'Half the interval' },
    { value: 'full', label: 'The whole interval' },
  ];
  const short = [
    { value: 'off', label: 'Off' },
    { value: 'half', label: 'Half' },
    { value: 'full', label: 'Full' },
  ];
  let room: 'narrow' | 'wide';
  let shown: boolean;
  let resized: () => void;
  beforeEach(() => {
    room = 'narrow';
    shown = true;
    resized = () => {};
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { resized = cb; }
      observe() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(() => (shown ? document.body : null));
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      const seg = this.closest('.seg');
      if (!shown || !seg || this.tagName !== 'BUTTON') return 0;
      const all = [...seg.querySelectorAll('button')];
      const i = all.indexOf(this as HTMLButtonElement);
      if (seg.classList.contains('seg--col')) return i * 35;
      const tooLong = all.some((b) => (b.textContent ?? '').length > 5);
      return room === 'narrow' && tooLong && i === all.length - 1 ? 35 : 0;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const frame = () => new Promise((r) => setTimeout(r, 30));
  const stacked = (c: HTMLElement) => c.querySelector('.seg')!.classList.contains('seg--col');

  it('stacks its options in one column when they do not fit on one row, and goes back when they do', async () => {
    const { container } = render(() => <Segmented name="Spread" value="off" options={long} />);
    resized();
    await frame();
    expect(stacked(container)).toBe(true);
    room = 'wide';
    resized();
    await frame();
    expect(stacked(container)).toBe(false);
  });

  it('measures again when its labels change though their count does not', async () => {
    const [o, setO] = createSignal(long);
    const { container } = render(() => <Segmented name="Spread" value="off" options={o()} />);
    resized();
    await frame();
    expect(stacked(container)).toBe(true);
    setO(short);
    await frame();
    expect(stacked(container)).toBe(false);
  });

  it('measures again when the window widens, which a column filling its row never reports', async () => {
    const { container } = render(() => <Segmented name="Spread" value="off" options={long} />);
    resized();
    await frame();
    expect(stacked(container)).toBe(true);
    room = 'wide';
    window.dispatchEvent(new Event('resize'));
    await frame();
    expect(stacked(container)).toBe(false);
  });

  it('keeps its column while hidden, so it comes back as it went', async () => {
    const { container } = render(() => <Segmented name="Spread" value="off" options={long} />);
    resized();
    await frame();
    shown = false;
    resized();
    await frame();
    expect(stacked(container)).toBe(true);
  });

  it('puts the fill straight in place when it switches between a row and a column, with no slide', async () => {
    room = 'wide';
    const { container } = render(() => <Segmented name="Spread" value="off" options={long} />);
    await frame();
    expect(stacked(container)).toBe(false);
    room = 'narrow';
    const fill = container.querySelector<HTMLElement>('.seg__fill')!;
    const classes: string[] = [];
    const mo = new MutationObserver((rs) => rs.forEach((r) => classes.push(r.oldValue ?? '')));
    mo.observe(fill, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    resized();
    await frame();
    mo.disconnect();
    expect(stacked(container)).toBe(true);
    expect(classes.some((c) => c.split(' ').includes('jump'))).toBe(true);
  });
});

describe('Select', () => {
  afterEach(() => vi.restoreAllMocks());
  const keys = [
    { value: '4', label: 'a (0x04)' },
    { value: '5', label: 'b (0x05)' },
    { value: '40', label: 'Enter (0x28)' },
  ];

  it('names its button by its field and the value picked, as a screen reader reads it', () => {
    const [v, setV] = createSignal('4');
    const { getByRole } = render(() => <Select value={v()} options={keys} onChange={setV} label="Key" />);
    expect(getByRole('button', { name: 'Key a (0x04)' })).toBeTruthy();
    setV('40');
    expect(getByRole('button', { name: 'Key Enter (0x28)' })).toBeTruthy();
  });

  it('opens its list upward when the screen has no room below it', async () => {
    const { container } = render(() => <Select value="4" options={keys} label="Key" />);
    const dd = container.querySelector<HTMLElement>('.dd')!;
    vi.spyOn(dd, 'getBoundingClientRect').mockReturnValue({ top: innerHeight - 80, bottom: innerHeight - 44 } as DOMRect);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('dd-l') ? 200 : 0;
    });
    fireEvent.click(container.querySelector('.dd-b')!);
    await settle();
    expect(container.querySelector('.dd-l')!.classList.contains('up')).toBe(true);
  });

  it('opens downward when the bars stuck over the page leave no room above, and moves the page for neither', async () => {
    const bar = document.body.appendChild(document.createElement('div'));
    bar.className = 'ptabs';
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: innerHeight - 120 } as DOMRect);
    const { container } = render(() => <Select value="4" options={keys} label="Key" />);
    const dd = container.querySelector<HTMLElement>('.dd')!;
    vi.spyOn(dd, 'getBoundingClientRect').mockReturnValue({ top: innerHeight - 80, bottom: innerHeight - 44 } as DOMRect);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('dd-l') ? 200 : 0;
    });
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    fireEvent.click(container.querySelector('.dd-b')!);
    await settle();
    expect(container.querySelector('.dd-l')!.classList.contains('up')).toBe(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    bar.remove();
  });

  it('takes the roomier side when the list fits on neither, and scrolls inside that room', async () => {
    const { container } = render(() => <Select value="4" options={keys} label="Key" />);
    const dd = container.querySelector<HTMLElement>('.dd')!;
    vi.spyOn(dd, 'getBoundingClientRect').mockReturnValue({ top: 300, bottom: 336 } as DOMRect);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('dd-l') ? 2000 : 0;
    });
    fireEvent.click(container.querySelector('.dd-b')!);
    await settle();
    const list = container.querySelector<HTMLElement>('.dd-l')!;
    expect(list.classList.contains('up')).toBe(innerHeight - 336 < 300);
    expect(list.style.maxHeight).toBe(`${Math.max(innerHeight - 336, 300) - 8}px`);
  });

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

  it('tells a screen reader which option the arrows are on, with only options in the listbox', async () => {
    const [v, setV] = createSignal('4');
    const { container } = render(() => <Select value={v()} options={keys} onChange={setV} filter="Filter by name or id" label="Key" />);
    fireEvent.click(container.querySelector('.dd-b')!);
    await settle();
    const input = container.querySelector<HTMLInputElement>('.dd-f')!;
    const list = container.querySelector('[role="listbox"]')!;
    expect([...list.children].every((c) => c.getAttribute('role') === 'option')).toBe(true);
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    const active = () => container.querySelector(`#${input.getAttribute('aria-activedescendant')}`)?.textContent;
    expect(active()).toBe('a (0x04)');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(active()).toBe('b (0x05)');
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
  it('redraws every line in place when its version moves, with no line added', async () => {
    const [base, setBase] = createSignal(0);
    const [version, setVersion] = createSignal(0);
    const rows = () => [[`t${1 - base()}`], [`t${2 - base()}`]];
    const { container } = render(() => (
      <LogBox rows={rows} added={() => 2} version={version} empty="(no messages)" label="Recent events" />
    ));
    const text = () => [...container.querySelectorAll('.lg > div')].map((l) => l.textContent);
    expect(text()).toEqual(['t1', 't2']);
    setBase(1);
    setVersion(1);
    await Promise.resolve();
    expect(text()).toEqual(['t0', 't1']);
    expect(container.querySelector('.lg > div:last-child')!.classList.contains('now')).toBe(true);
  });

  it('keeps each bracketed byte group in one piece, its text unchanged', () => {
    const rows = () => [['#1', 'hid-in in 0x81 [00 0b 00] [aa bb]']];
    const { container } = render(() => <LogBox rows={rows} added={() => 1} empty="" label="Recent events" />);
    const cell = container.querySelector('.lg > div > span:last-child')!;
    expect(cell.textContent).toBe('hid-in in 0x81 [00 0b 00] [aa bb]');
    expect([...cell.querySelectorAll('.grp')].map((g) => g.textContent)).toEqual(['[00 0b 00]', '[aa bb]']);
  });

  it('lights the newest line of a log drawn whole, as when its tab opens on lines already there', () => {
    const rows = () => [['a'], ['b'], ['c']];
    const { container } = render(() => <LogBox rows={rows} added={() => 3} empty="(no messages)" label="Device log" />);
    const lines = [...container.querySelectorAll('.lg > div')];
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.classList.contains('now'))).toEqual([false, false, true]);
  });

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

describe('Range', () => {
  it('reads its value beside it and fills from zero to the handle, on either side', async () => {
    const [v, setV] = createSignal(50);
    const { container } = render(() => (
      <Range label="Keep" value={v()} min={-100} max={100} step={5} zero={0} format={(n) => `${n}%`} onChange={setV} />
    ));
    const input = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(input.getAttribute('aria-label')).toBe('Keep');
    expect(container.querySelector('output')!.textContent).toBe('50%');
    const fill = () => container.querySelector<HTMLElement>('.sl-fill')!.style;
    expect([fill().getPropertyValue('--a'), fill().getPropertyValue('--w')]).toEqual(['0.5', '0.25']);
    fireEvent.input(input, { target: { value: '-50' } });
    expect(v()).toBe(-50);
    expect(container.querySelector('output')!.textContent).toBe('-50%');
    expect([fill().getPropertyValue('--a'), fill().getPropertyValue('--w')]).toEqual(['0.25', '0.25']);
    expect(container.querySelector('.sl-z')).not.toBeNull();
  });
});
