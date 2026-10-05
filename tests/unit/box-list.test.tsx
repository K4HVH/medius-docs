import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { type Component, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  BsBoxSeam,
  BsBoxSeamFill,
  BsDpad,
  BsExclamationCircle,
  BsKeyboardFill,
  BsMouse2,
  BsMouse2Fill,
  BsUsbDrive,
  BsUsbDriveFill,
} from 'solid-icons/bs';
import { BoxList, boxIcon } from '../../src/app/pages/dashboard/BoxList';
import { NEW_BOX } from '../../src/app/pages/dashboard/boxes';
import { BoxesContext, type BoxEntry, type Boxes, type BoxSession } from '../../src/app/pages/dashboard/context';
import type { BoxIcon } from '../../src/app/pages/dashboard/store';
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
    ['a box connecting', { status: 'connecting' }, BsBoxSeam],
    ['a box updating', { status: 'flashing', held: true }, BsBoxSeamFill],
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

  const picked: [string, Partial<State>, BoxIcon, unknown][] = [
    ['a connected mouse box filled', { status: 'connected', held: true, version: version() }, 'mouse', BsMouse2Fill],
    ['a mouse box nobody holds in outline', { probe: box() }, 'mouse', BsMouse2],
    ['a mouse box connecting in outline', { status: 'connecting' }, 'mouse', BsMouse2],
    ['a keyboard box updating filled', { status: 'flashing', held: true }, 'keyboard', BsKeyboardFill],
    ['a controller box still being checked in outline', {}, 'controller', BsDpad],
    ['a connected USB box filled', { status: 'connected', held: true, version: version() }, 'usb', BsUsbDriveFill],
    ['a USB box nobody holds in outline', { probe: box() }, 'usb', BsUsbDrive],
    ['a mouse box not answering with the warning', { status: 'lost', held: true }, 'mouse', BsExclamationCircle],
    ['a mouse box on an older wire with the warning', { probe: box(MIN_PROTO_VER) }, 'mouse', BsExclamationCircle],
  ];
  for (const [what, state, choice, icon] of picked) {
    it(`draws ${what}`, () => {
      expect(boxIcon(session(state).s, choice)).toBe(icon);
    });
  }
});

const stand = (initial: BoxEntry[], opts: { supported?: boolean } = {}) => {
  const [entries, setEntries] = createSignal(initial);
  const [sel, setSel] = createSignal(initial[0]?.key ?? null);
  const select = vi.fn((k: string) => setSel(k));
  const add = vi.fn(async () => ({ ok: false, verdict: { kind: 'no-port' } }));
  const [icons, setIcons] = createSignal<Record<string, BoxIcon>>({});
  const setIcon = vi.fn((k: string, i: BoxIcon) => setIcons((m) => ({ ...m, [k]: i })));
  const boxes = {
    supported: opts.supported ?? true,
    secure: true,
    entries,
    selected: () => (sel() === NEW_BOX ? null : (entries().find((e) => e.key === sel()) ?? null)),
    select,
    add,
    icon: (k: string) => icons()[k] ?? 'box',
    setIcon,
  } as unknown as Boxes;
  return { boxes, select, add, setEntries, setIcon };
};

afterEach(cleanup);

const tabs = (r: ReturnType<typeof render>) => [...r.container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
const iconOf = (tab: HTMLElement) => tab.querySelector('.box-icon__hit') as HTMLElement;
const menu = () => document.querySelector('[role="menu"]');
const items = () => screen.queryAllByRole('menuitem') as HTMLButtonElement[];
const item = (name: string) => screen.getByRole('menuitem', { name }) as HTMLButtonElement;
const names = () => items().map((i) => i.querySelector('svg title')?.textContent);
const drawn = (c: Component) => render(() => <Dynamic component={c} />).container.querySelector('svg')!.innerHTML;

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
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Left', 'Right', 'Add box']);
    expect(tabs(r).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('leaves out ports that never answered as a box', () => {
    const a = session({ probe: box(), name: 'Left' });
    const sim = session({ probe: { kind: 'silent' } });
    const { boxes } = stand([
      { key: 'port:1', session: sim.s },
      { key: 'aa', session: a.s },
    ]);
    const r = mount(boxes);
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Left', 'Add box']);
  });

  it('a click selects the box and opens nothing', () => {
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
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Left', 'Right', 'Add box']);
    // Same element, so focus survives.
    expect(tabs(r)[0]).toBe(row);
    setEntries([{ key: 'bb', session: b.s }]);
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Right', 'Add box']);
  });

  it('Add box shows the card for a new box, and opens no chooser by itself', () => {
    const a = session({ probe: box(), name: 'Left' });
    const onPick = vi.fn();
    const { boxes, select, add } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes, { onPick });
    fireEvent.click(r.getByRole('tab', { name: 'Add box' }));
    expect(select).toHaveBeenCalledWith(NEW_BOX);
    expect(onPick).toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(r.getByRole('tab', { name: 'Add box' }).getAttribute('aria-selected')).toBe('true');
  });

  it('Add box is marked while nothing listed is selected', () => {
    const sim = session({ probe: { kind: 'silent' } });
    const { boxes } = stand([{ key: 'port:1', session: sim.s }]);
    const r = mount(boxes);
    expect(tabs(r).map((t) => t.getAttribute('aria-selected'))).toEqual(['true']);
  });

  it('offers no Add box where the browser cannot reach a port', () => {
    const { boxes } = stand([], { supported: false });
    const r = mount(boxes);
    expect(r.queryByRole('tab', { name: 'Add box' })).toBeNull();
  });

  it("clicking a box's icon opens its icon menu, and selects nothing", () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const onPick = vi.fn();
    const { boxes, select } = stand([
      { key: 'aa', session: a.s },
      { key: 'bb', session: b.s },
    ]);
    const r = mount(boxes, { onPick });
    fireEvent.click(iconOf(tabs(r)[1]));
    expect(menu()).not.toBeNull();
    expect(names()).toEqual(['Box', 'Mouse', 'Keyboard', 'Controller', 'USB device']);
    expect(items().every((i) => i.childElementCount === 1 && i.firstElementChild!.tagName === 'svg')).toBe(true);
    expect(select).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    expect(tabs(r).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('clicking the icon again closes the menu, though the press first moves focus to its tab', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes);
    fireEvent.click(iconOf(tabs(r)[0]));
    tabs(r)[0].focus();
    fireEvent.click(iconOf(tabs(r)[0]));
    expect(menu()).toBeNull();
  });

  it('picking an icon keeps it for that box, redraws the row and closes the menu', () => {
    const a = session({ status: 'connected', held: true, version: version(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const { boxes, select, setIcon } = stand([
      { key: 'aa', session: a.s },
      { key: 'bb', session: b.s },
    ]);
    const r = mount(boxes);
    fireEvent.click(iconOf(tabs(r)[0]));
    fireEvent.click(item('Mouse'));
    expect(setIcon).toHaveBeenCalledWith('aa', 'mouse');
    expect(menu()).toBeNull();
    expect(iconOf(tabs(r)[0]).querySelector('svg')!.innerHTML).toBe(drawn(BsMouse2Fill));
    expect(iconOf(tabs(r)[1]).querySelector('svg')!.innerHTML).toBe(drawn(BsBoxSeam));
    expect(select).not.toHaveBeenCalled();
  });

  it('the menu marks the icon in use', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes } = stand([{ key: 'aa', session: a.s }]);
    boxes.setIcon('aa', 'keyboard');
    const r = mount(boxes);
    fireEvent.click(iconOf(tabs(r)[0]));
    expect(items().map((i) => i.classList.contains('box-icon-menu__current'))).toEqual([false, false, true, false, false]);
  });

  it('right-click or the menu key on a box opens its menu at the icon in use, and Escape goes back to the box', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes, select } = stand([{ key: 'aa', session: a.s }]);
    boxes.setIcon('aa', 'controller');
    const r = mount(boxes);
    tabs(r)[0].focus();
    expect(fireEvent.contextMenu(tabs(r)[0].querySelector('.tabs__tab-label')!)).toBe(false);
    expect(document.activeElement).toBe(item('Controller'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(tabs(r)[0]);
    expect(select).not.toHaveBeenCalled();
  });

  it('picking from another row hands focus back to the selected box, where the tab keys move from', () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const { boxes } = stand([
      { key: 'aa', session: a.s },
      { key: 'bb', session: b.s },
    ]);
    const r = mount(boxes);
    fireEvent.contextMenu(tabs(r)[1]);
    fireEvent.click(item('Mouse'));
    expect(document.activeElement).toBe(tabs(r)[0]);
  });

  it('once a menu has closed, clicks elsewhere leave focus where it is', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes);
    fireEvent.click(iconOf(tabs(r)[0]));
    fireEvent.click(item('Mouse'));
    const field = document.body.appendChild(document.createElement('input'));
    field.focus();
    fireEvent.pointerDown(field);
    expect(document.activeElement).toBe(field);
    field.remove();
  });

  it('tabbing out of the menu closes it, so a second never opens beside it', () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const { boxes } = stand([
      { key: 'aa', session: a.s },
      { key: 'bb', session: b.s },
    ]);
    const r = mount(boxes);
    fireEvent.contextMenu(tabs(r)[1]);
    tabs(r)[0].focus();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(tabs(r)[0]);
    fireEvent.contextMenu(tabs(r)[0]);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('a closed icon menu starts no frame loop on a scroll or resize', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes);
    fireEvent.contextMenu(tabs(r)[0]);
    fireEvent.click(item('Mouse'));
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    fireEvent.scroll(document);
    fireEvent(window, new Event('resize'));
    expect(frames).not.toHaveBeenCalled();
    frames.mockRestore();
  });

  it('an entry that takes its MAC shows the icon kept for that MAC', () => {
    const a = session({ probe: box(), name: 'Left' });
    const [key, setKey] = createSignal('port:1');
    const { boxes } = stand([
      {
        get key() {
          return key();
        },
        session: a.s,
      },
    ]);
    boxes.setIcon('aa', 'mouse');
    const r = mount(boxes);
    expect(tabs(r).map((t) => t.textContent)).toEqual(['Add box']);
    setKey('aa');
    expect(iconOf(tabs(r)[0]).querySelector('svg')!.innerHTML).toBe(drawn(BsMouse2));
  });

  it('keys and clicks in the menu stay in the menu', () => {
    const a = session({ probe: box(), name: 'Left' });
    const b = session({ probe: box(), name: 'Right' });
    const { boxes, select } = stand([
      { key: 'aa', session: a.s },
      { key: 'bb', session: b.s },
    ]);
    const r = mount(boxes);
    fireEvent.contextMenu(tabs(r)[0]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item('Mouse'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(item('USB device'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item('Box'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Mouse'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    fireEvent.click(menu()!);
    expect(select).not.toHaveBeenCalled();
    expect(tabs(r).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('Add box has no icon menu', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes, select } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes);
    const addTab = r.getByRole('tab', { name: 'Add box' });
    expect(fireEvent.contextMenu(addTab)).toBe(true);
    fireEvent.click(addTab.querySelector('.tabs__tab-icon')!);
    expect(menu()).toBeNull();
    expect(select).toHaveBeenCalledWith(NEW_BOX);
  });

  it('a locked list opens no icon menu', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes, { disabled: true });
    fireEvent.click(iconOf(tabs(r)[0]));
    fireEvent.contextMenu(tabs(r)[0]);
    expect(menu()).toBeNull();
  });

  it('locks every row while disabled', () => {
    const a = session({ probe: box(), name: 'Left' });
    const { boxes, select } = stand([{ key: 'aa', session: a.s }]);
    const r = mount(boxes, { disabled: true });
    fireEvent.click(tabs(r)[0]);
    fireEvent.click(r.getByRole('tab', { name: 'Add box' }));
    expect(select).not.toHaveBeenCalled();
    expect(tabs(r).every((t) => t.disabled)).toBe(true);
  });
});
