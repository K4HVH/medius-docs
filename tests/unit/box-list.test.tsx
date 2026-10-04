import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { BoxList, rowView } from '../../src/app/pages/dashboard/BoxList';
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
  progress: { phase: string; written?: number; total?: number } | null;
  identifying: boolean;
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
    progress: null,
    identifying: false,
    ...over,
  });
  const identify = vi.fn(async () => {});
  const s = {
    status: () => st().status,
    present: () => st().present,
    held: () => st().held,
    probe: () => st().probe,
    version: () => st().version,
    name: () => st().name,
    updateOnly: () => st().status === 'connected' && st().version !== null && st().version!.protoVer !== PROTO_VER,
    updateProgress: () => st().progress,
    identifying: () => st().identifying,
    identify,
  } as unknown as BoxSession;
  return { s, set: (o: Partial<State>) => set((p) => ({ ...p, ...o })), identify };
};

const box = (protoVer = PROTO_VER): Probe => ({ kind: 'box', version: version(protoVer), device: null, baud: 6_000_000 });

describe('rowView', () => {
  const cases: [string, Partial<State>, { name: string; detail: string; tone: string; canIdentify: boolean }][] = [
    ['a remembered box that is unplugged', { held: true, present: false, status: 'lost', name: 'Desk' }, { name: 'Desk', detail: 'Not plugged in', tone: 'muted', canIdentify: false }],
    ['an update in progress', { status: 'flashing', name: 'Desk', progress: { phase: 'writing', written: 42, total: 100 } }, { name: 'Desk', detail: 'Updating 42%', tone: 'primary', canIdentify: false }],
    ['an update between writes', { status: 'flashing', name: 'Desk', progress: { phase: 'connecting' } }, { name: 'Desk', detail: 'Updating', tone: 'primary', canIdentify: false }],
    ['connecting', { status: 'connecting' }, { name: 'Box', detail: 'Connecting...', tone: 'neutral', canIdentify: false }],
    ['a held box that stopped answering', { status: 'lost', held: true, name: 'Desk' }, { name: 'Desk', detail: 'Not answering', tone: 'danger', canIdentify: false }],
    ['a held box on the current wire', { status: 'connected', held: true, version: version(), name: 'Desk' }, { name: 'Desk', detail: 'v3.4.4', tone: 'success', canIdentify: true }],
    ['a held box on an older wire', { status: 'connected', held: true, version: version(MIN_PROTO_VER), name: 'Desk' }, { name: 'Desk', detail: 'Update needed', tone: 'warning', canIdentify: true }],
    ['an update that failed with the link open', { status: 'error', held: true, name: 'Desk' }, { name: 'Desk', detail: 'Update failed', tone: 'danger', canIdentify: false }],
    ['a port still being probed', {}, { name: 'Box', detail: 'Checking...', tone: 'neutral', canIdentify: false }],
    ['an answering box nobody holds', { probe: box(), name: 'Desk' }, { name: 'Desk', detail: 'v3.4.4', tone: 'hollow', canIdentify: true }],
    ['an answering box on an older wire', { probe: box(MIN_PROTO_VER), name: 'Desk' }, { name: 'Desk', detail: 'Update needed', tone: 'hollow', canIdentify: true }],
    ['a box below the oldest this page opens', { probe: { kind: 'old-firmware', version: version(4) }, name: 'Desk' }, { name: 'Desk', detail: 'Needs setup', tone: 'warning', canIdentify: false }],
    ['a box newer than this page', { probe: { kind: 'new-firmware', version: version(99) }, name: 'Desk' }, { name: 'Desk', detail: 'Reload needed', tone: 'warning', canIdentify: false }],
    ['a port another program holds', { probe: { kind: 'busy' } }, { name: 'Box', detail: 'In use', tone: 'warning', canIdentify: false }],
    ['a port that never answered', { probe: { kind: 'silent' } }, { name: 'Box', detail: 'Not answering', tone: 'hollow', canIdentify: false }],
    ['a port that would not open for another reason', { probe: { kind: 'other', message: 'x' } }, { name: 'Box', detail: "Can't open", tone: 'warning', canIdentify: false }],
  ];
  for (const [what, state, want] of cases) {
    it(`shows ${what}`, () => {
      expect(rowView(session(state).s)).toEqual(want);
    });
  }
});

const stand = (entries: BoxEntry[]) => {
  const [sel, setSel] = createSignal(entries[0]?.key ?? null);
  const select = vi.fn((k: string) => setSel(k));
  const add = vi.fn(async () => null);
  const boxes = {
    entries: () => entries,
    selected: () => entries.find((e) => e.key === sel()) ?? null,
    select,
    add,
  } as unknown as Boxes;
  return { boxes, select, add };
};

afterEach(cleanup);

describe('BoxList', () => {
  const mount = (boxes: Boxes) =>
    render(() => (
      <BoxesContext.Provider value={boxes}>
        <BoxList />
      </BoxesContext.Provider>
    ));

  it('lists each box by name and state, and marks the one selected', () => {
    const a = session({ status: 'connected', held: true, version: version(), name: 'Left' });
    const b = session({ probe: { kind: 'busy' } });
    const { boxes } = stand([
      { key: 'a', session: a.s },
      { key: 'b', session: b.s },
    ]);
    const r = mount(boxes);
    const rows = [...r.container.querySelectorAll('.tabs__tab')].filter((x) => !/add a box/i.test(x.textContent ?? ''));
    expect(rows.map((x) => x.textContent)).toEqual(['Leftv3.4.4', 'BoxIn use']);
    expect(rows[0].classList.contains('tabs__tab--active')).toBe(true);
    expect(rows[1].classList.contains('tabs__tab--active')).toBe(false);
  });

  it('a click selects the box, and moves the mark', () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const { boxes, select } = stand([
      { key: 'a', session: a.s },
      { key: 'b', session: b.s },
    ]);
    const r = mount(boxes);
    fireEvent.click(r.getByRole('button', { name: /right/i }));
    expect(select).toHaveBeenCalledWith('b');
    expect(r.getByRole('button', { name: /right/i }).classList.contains('tabs__tab--active')).toBe(true);
  });

  it('Identify blinks that box, and only boxes that can be opened offer it', () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: { kind: 'busy' } });
    const { boxes, select } = stand([
      { key: 'a', session: a.s },
      { key: 'b', session: b.s },
    ]);
    const r = mount(boxes);
    const identify = r.getAllByRole('button', { name: /identify/i });
    expect(identify).toHaveLength(1);
    fireEvent.click(identify[0]);
    expect(a.identify).toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('a row follows its box: a box that stops answering says so at once', () => {
    const a = session({ status: 'connected', held: true, version: version(), name: 'Left' });
    const { boxes } = stand([{ key: 'a', session: a.s }]);
    const r = mount(boxes);
    a.set({ status: 'lost' });
    expect(r.getByRole('button', { name: /left/i }).textContent).toContain('Not answering');
  });

  it('Add a box opens the chooser', () => {
    const { boxes, add } = stand([]);
    const r = mount(boxes);
    fireEvent.click(r.getByRole('button', { name: /add a box/i }));
    expect(add).toHaveBeenCalled();
  });
});
