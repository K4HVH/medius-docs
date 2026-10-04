import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { BsArrowRepeat, BsBoxSeam, BsBoxSeamFill, BsExclamationCircle } from 'solid-icons/bs';
import { BoxList, boxIcon } from '../../src/app/pages/dashboard/BoxList';
import { BoxesContext, type BoxEntry, type Boxes, type BoxSession } from '../../src/app/pages/dashboard/context';
import { PROTO_VER, MIN_PROTO_VER, type Version } from '../../src/dashboard/protocol';
import type { Probe } from '../../src/dashboard/serial';

const version = (protoVer = PROTO_VER, name = 'Desk'): Version => ({
  protoVer,
  fwMajor: 3,
  fwMinor: 4,
  fwPatch: 4,
  mac: [1, 2, 3, 4, 5, 6],
  name,
});

interface State {
  status: string;
  present: boolean;
  held: boolean;
  probe: Probe | null;
  version: Version | null;
  name: string | null;
}

// Real signals, so a row re-renders on a state change the way it does against a real session.
const session = (over: Partial<State> = {}) => {
  const [st, set] = createSignal<State>({
    status: 'disconnected',
    present: true,
    held: false,
    probe: null,
    version: null,
    name: null,
    ...over,
  });
  const s = {
    status: () => st().status,
    present: () => st().present,
    held: () => st().held,
    probe: () => st().probe,
    version: () => st().version,
    name: () => st().name,
    updateOnly: () => st().status === 'connected' && st().version !== null && st().version!.protoVer !== PROTO_VER,
  } as unknown as BoxSession;
  return { s, set: (o: Partial<State>) => set((p) => ({ ...p, ...o })) };
};

const box = (protoVer = PROTO_VER): Probe => ({ kind: 'box', version: version(protoVer), device: null, baud: 6_000_000 });

describe('boxIcon', () => {
  const cases: [string, Partial<State>, unknown][] = [
    ['a connected box on the current wire', { status: 'connected', held: true, version: version() }, BsBoxSeamFill],
    ['a box nobody holds that answers', { probe: box() }, BsBoxSeam],
    ['a box nobody holds on an older wire', { probe: box(MIN_PROTO_VER) }, BsExclamationCircle],
    ['a port still being checked', {}, BsBoxSeam],
    ['a box connecting', { status: 'connecting' }, BsArrowRepeat],
    ['a box updating', { status: 'flashing', held: true }, BsArrowRepeat],
    ['a connected box on an older wire', { status: 'connected', held: true, version: version(MIN_PROTO_VER) }, BsExclamationCircle],
    ['a held box not answering', { status: 'lost', held: true }, BsExclamationCircle],
    ['a remembered box unplugged', { held: true, present: false, status: 'lost' }, BsExclamationCircle],
    ['an update that failed', { status: 'error', held: true }, BsExclamationCircle],
    ['a box another tab holds', { probe: { kind: 'busy' } }, BsExclamationCircle],
    ['a box below the oldest this page opens', { probe: { kind: 'old-firmware', version: version(4) } }, BsExclamationCircle],
    ['a box newer than this page', { probe: { kind: 'new-firmware', version: version(99) } }, BsExclamationCircle],
    ['a box an update left silent', { held: true, probe: { kind: 'silent' } }, BsExclamationCircle],
  ];
  for (const [what, state, icon] of cases) {
    it(`marks ${what}`, () => {
      expect(boxIcon(session(state).s)).toBe(icon);
    });
  }
});

const stand = (initial: BoxEntry[], opts: { supported?: boolean } = {}) => {
  const [entries, setEntries] = createSignal(initial);
  const [sel, setSel] = createSignal(initial[0]?.key ?? null);
  const select = vi.fn((k: string) => setSel(k));
  const add = vi.fn(async () => ({ ok: false, verdict: { kind: 'no-port' } }));
  const boxes = {
    supported: opts.supported ?? true,
    secure: true,
    entries,
    selected: () => entries().find((e) => e.key === sel()) ?? null,
    select,
    add,
  } as unknown as Boxes;
  return { boxes, select, add, setEntries };
};

afterEach(cleanup);

const tabs = (r: ReturnType<typeof render>) => [...r.container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];

describe('BoxList', () => {
  const mount = (boxes: Boxes, props: { onPick?: () => void; disabled?: boolean } = {}) =>
    render(() => (
      <BoxesContext.Provider value={boxes}>
        <BoxList {...props} />
      </BoxesContext.Provider>
    ));

  it('lists each box by name as a tab, and marks the one selected', () => {
    const a = session({ status: 'connected', held: true, version: version(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const { boxes } = stand([
      { key: 'aa', session: a.s },
      { key: 'bb', session: b.s },
    ]);
    const r = mount(boxes);
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Left', 'Right']);
    expect(tabs(r).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
  });

  it('leaves out ports that never answered as a box', () => {
    const a = session({ probe: box(), name: 'Left' });
    const sim = session({ probe: { kind: 'silent' } });
    const { boxes } = stand([
      { key: 'port:1', session: sim.s },
      { key: 'aa', session: a.s },
    ]);
    const r = mount(boxes);
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Left']);
  });

  it('a click selects the box and moves the mark, nothing more', () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const onPick = vi.fn();
    const { boxes, select, add } = stand([
      { key: 'aa', session: a.s },
      { key: 'bb', session: b.s },
    ]);
    const r = mount(boxes, { onPick });
    fireEvent.click(tabs(r)[1]);
    expect(select).toHaveBeenCalledWith('bb');
    expect(onPick).toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(tabs(r)[1].getAttribute('aria-selected')).toBe('true');
  });

  it('a row follows its box as it changes', () => {
    const a = session({ status: 'connected', held: true, version: version(), name: 'Left' });
    const { boxes } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes);
    const row = tabs(r)[0];
    const before = row.innerHTML;
    a.set({ status: 'lost' });
    expect(tabs(r)[0].innerHTML).not.toBe(before);
    a.set({ name: 'Desk' });
    expect(tabs(r)[0].textContent).toBe('Desk');
  });

  it('a box plugged in appears, and one taken away leaves', () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const { boxes, setEntries } = stand([{ key: 'aa', session: a.s }]);
    const first = { key: 'aa', session: a.s };
    setEntries([first]);
    const r = mount(boxes);
    const row = tabs(r)[0];
    setEntries([first, { key: 'bb', session: b.s }]);
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Left', 'Right']);
    // Left keeps its element, so keyboard focus on it survives another box arriving.
    expect(tabs(r)[0]).toBe(row);
    setEntries([{ key: 'bb', session: b.s }]);
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Right']);
  });

  it('Add a box opens the chooser, then hands over like a picked box', async () => {
    const { boxes, add } = stand([]);
    const onPick = vi.fn();
    const r = mount(boxes, { onPick });
    fireEvent.click(r.getByRole('button', { name: 'Add a box' }));
    expect(add).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(onPick).toHaveBeenCalled();
  });

  it('offers no Add a box where the browser cannot reach a port', () => {
    const { boxes } = stand([], { supported: false });
    const r = mount(boxes);
    expect(r.queryByRole('button', { name: 'Add a box' })).toBeNull();
  });

  it('locks every row and Add a box while disabled', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes, select } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes, { disabled: true });
    fireEvent.click(tabs(r)[0]);
    expect(select).not.toHaveBeenCalled();
    expect((r.getByRole('button', { name: 'Add a box' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
