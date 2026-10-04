import { type Component, createMemo } from 'solid-js';
import { BsBoxSeam, BsBoxSeamFill, BsExclamationCircle, BsPlusLg } from 'solid-icons/bs';
import { Tabs, type TabOption } from '../../../components/navigation/Tabs';
import { speaksCurrentWire } from '../../../dashboard/serial';
import { type BoxEntry, type BoxSession, NEW_BOX, useBoxes } from './context';

export function boxIcon(s: BoxSession): Component {
  const status = s.status();
  if (status === 'connected') return s.updateOnly() ? BsExclamationCircle : BsBoxSeamFill;
  if (status === 'flashing') return BsBoxSeamFill;
  if (status === 'connecting') return BsBoxSeam;
  if (status !== 'disconnected' || !s.present()) return BsExclamationCircle;
  const p = s.probe();
  if (!p) return BsBoxSeam;
  return p.kind === 'box' && speaksCurrentWire(p.version) ? BsBoxSeam : BsExclamationCircle;
}

const ADD: TabOption = { value: NEW_BOX, label: 'Add box', icon: BsPlusLg };
const listed = (e: BoxEntry) => !e.key.startsWith('port:');

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
  const all = createMemo(() => {
    const rows = boxes.entries().filter(listed).map(optionFor);
    return boxes.supported && boxes.secure ? [...rows, ADD] : rows;
  });
  const value = () => {
    const s = boxes.selected();
    return s && listed(s) ? s.key : NEW_BOX;
  };

  return (
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
  );
};
