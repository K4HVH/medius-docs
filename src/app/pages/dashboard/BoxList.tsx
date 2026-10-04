import { type Component, Show, createMemo } from 'solid-js';
import { BsArrowRepeat, BsBoxSeam, BsBoxSeamFill, BsExclamationCircle, BsPlusLg } from 'solid-icons/bs';
import { Tabs, type TabOption } from '../../../components/navigation/Tabs';
import { speaksCurrentWire } from '../../../dashboard/serial';
import { type BoxEntry, type BoxSession, useBoxes } from './context';

export function boxIcon(s: BoxSession): Component {
  const status = s.status();
  if (status === 'connecting' || status === 'flashing') return BsArrowRepeat;
  if (status === 'connected') return s.updateOnly() ? BsExclamationCircle : BsBoxSeamFill;
  if (status !== 'disconnected' || !s.present()) return BsExclamationCircle;
  const p = s.probe();
  if (!p) return BsBoxSeam;
  return p.kind === 'box' && speaksCurrentWire(p.version) ? BsBoxSeam : BsExclamationCircle;
}

export const BoxList = (props: { onPick?: () => void; disabled?: boolean }) => {
  const boxes = useBoxes();
  const options = new WeakMap<BoxEntry, TabOption>();
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
        get icon() {
          return boxIcon(e.session);
        },
      };
      options.set(e, o);
    }
    return o;
  };
  const listed = createMemo(() => boxes.entries().filter((e) => !e.key.startsWith('port:')).map(optionFor));
  const pick = () => props.onPick?.();

  return (
    <>
      <Tabs
        orientation="vertical"
        variant="subtle"
        options={listed()}
        value={boxes.selected()?.key ?? ''}
        disabled={props.disabled}
        onChange={(key) => {
          boxes.select(key);
          pick();
        }}
      />
      <Show when={boxes.supported && boxes.secure}>
        <div class="tabs tabs--subtle tabs--vertical" style={{ 'margin-top': 'var(--g-spacing-xs)' }}>
          <button
            type="button"
            class="tabs__tab"
            disabled={props.disabled}
            onClick={() => void boxes.add().then(pick)}
          >
            <span class="tabs__tab-icon">
              <BsPlusLg />
            </span>
            <span class="tabs__tab-label">Add a box</span>
          </button>
        </div>
      </Show>
    </>
  );
};
