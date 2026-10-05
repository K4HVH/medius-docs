import { type Component, For, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  BsBoxSeam,
  BsBoxSeamFill,
  BsDpad,
  BsDpadFill,
  BsExclamationCircle,
  BsKeyboard,
  BsKeyboardFill,
  BsMouse2,
  BsMouse2Fill,
  BsPlusLg,
  BsUsbDrive,
  BsUsbDriveFill,
} from 'solid-icons/bs';
import type { IconTypes } from 'solid-icons';
import { Menu, MenuItem } from '../../../components/navigation/Menu';
import { Tabs, type TabOption } from '../../../components/navigation/Tabs';
import { speaksCurrentWire } from '../../../dashboard/serial';
import { type BoxEntry, type BoxSession, NEW_BOX, useBoxes } from './context';
import { BOX_ICONS, type BoxIcon } from './store';

const ICONS: Record<BoxIcon, { label: string; idle: IconTypes; connected: IconTypes }> = {
  box: { label: 'Box', idle: BsBoxSeam, connected: BsBoxSeamFill },
  mouse: { label: 'Mouse', idle: BsMouse2, connected: BsMouse2Fill },
  keyboard: { label: 'Keyboard', idle: BsKeyboard, connected: BsKeyboardFill },
  controller: { label: 'Controller', idle: BsDpad, connected: BsDpadFill },
  usb: { label: 'USB device', idle: BsUsbDrive, connected: BsUsbDriveFill },
};

export function boxIcon(s: BoxSession, icon: BoxIcon = 'box'): Component {
  const { idle, connected } = ICONS[icon];
  const status = s.status();
  if (status === 'connected') return s.updateOnly() ? BsExclamationCircle : connected;
  if (status === 'flashing') return connected;
  if (status === 'connecting') return idle;
  if (status !== 'disconnected' || !s.present()) return BsExclamationCircle;
  const p = s.probe();
  if (!p) return idle;
  return p.kind === 'box' && speaksCurrentWire(p.version) ? idle : BsExclamationCircle;
}

const ADD: TabOption = { value: NEW_BOX, label: 'Add box', icon: BsPlusLg };
const listed = (e: BoxEntry) => !e.key.startsWith('port:');

export const BoxList = (props: { onPick?: () => void; disabled?: boolean }) => {
  const boxes = useBoxes();
  const options = new WeakMap<BoxEntry, TabOption>();
  // Each row's tab to its icon menu, for a right-click or the menu key anywhere on the row.
  const menus = new Map<Element, () => void>();

  const iconMenu =
    (e: BoxEntry): Component =>
    () => {
      const [open, setOpen] = createSignal(false);
      const glyphs: Partial<Record<BoxIcon, Element>> = {};
      let hit!: HTMLSpanElement;
      const tab = () => hit.closest<HTMLElement>('[role="tab"]');
      const button = (icon: BoxIcon) => glyphs[icon]?.closest('button');
      const show = () => {
        if (props.disabled) return;
        setOpen(true);
        button(boxes.icon(e.key))?.focus({ preventScroll: true });
      };
      // Back to the selected box, which the tab keys move from.
      const hide = () => {
        setOpen(false);
        tab()
          ?.closest('[role="tablist"]')
          ?.querySelector<HTMLElement>('[aria-selected="true"]')
          ?.focus({ preventScroll: true });
      };
      const step = (by: number) => {
        const row = BOX_ICONS.map(button);
        const at = row.findIndex((b) => b === document.activeElement);
        row[(at + by + row.length) % row.length]?.focus();
      };
      onMount(() => {
        const t = tab();
        if (!t) return;
        menus.set(t, show);
        onCleanup(() => menus.delete(t));
      });
      return (
        // The menu renders elsewhere in the page, but its events still bubble through here to the tab.
        <span
          class="box-icon"
          onClick={(ev) => ev.stopPropagation()}
          onKeyDown={(ev) => {
            ev.stopPropagation();
            if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
            ev.preventDefault();
            step(ev.key === 'ArrowRight' ? 1 : -1);
          }}
          onFocusOut={(ev) => {
            const to = ev.relatedTarget as Node | null;
            // Focus moving to this row's tab is a click on the icon, which closes the menu itself.
            if (open() && !button('box')?.closest('[role="menu"]')?.contains(to) && !tab()?.contains(to)) setOpen(false);
          }}
        >
          <Menu
            open={open()}
            onOpenChange={(o) => (o ? show() : hide())}
            openOn="click"
            closeOnContentClick={false}
            class="box-icon-menu"
            trigger={
              <span ref={hit} class="box-icon__hit">
                <Dynamic component={boxIcon(e.session, boxes.icon(e.key))} />
              </span>
            }
          >
            <For each={BOX_ICONS}>
              {(icon) => (
                <MenuItem
                  class={boxes.icon(e.key) === icon ? 'box-icon-menu__current' : undefined}
                  onClick={() => {
                    boxes.setIcon(e.key, icon);
                    hide();
                  }}
                >
                  <Dynamic
                    component={ICONS[icon].idle}
                    title={ICONS[icon].label}
                    ref={(el) => (glyphs[icon] = el)}
                  />
                </MenuItem>
              )}
            </For>
          </Menu>
        </span>
      );
    };

  // One option object per box for its life, so Tabs keeps the row and its focus.
  const optionFor = (e: BoxEntry): TabOption => {
    let o = options.get(e);
    if (!o) {
      o = {
        get value() {
          return e.key;
        },
        get label() {
          return e.session.name() || e.key;
        },
        icon: iconMenu(e),
      };
      options.set(e, o);
    }
    return o;
  };
  const all = createMemo(() => {
    const rows = boxes.entries().filter(listed).map(optionFor);
    return boxes.supported && boxes.secure ? [...rows, ADD] : rows;
  });
  const value = () => {
    const s = boxes.selected();
    return s && listed(s) ? s.key : NEW_BOX;
  };

  return (
    <div
      onContextMenu={(ev) => {
        const show = menus.get((ev.target as Element).closest('[role="tab"]')!);
        if (!show) return;
        ev.preventDefault();
        show();
      }}
    >
      <Tabs
        class="box-tabs"
        orientation="vertical"
        variant="subtle"
        options={all()}
        value={value()}
        disabled={props.disabled}
        onChange={(key) => {
          boxes.select(key);
          props.onPick?.();
        }}
      />
    </div>
  );
};
