import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import {
  Direction,
  LOCK_ID_ALL,
  LOCK_SCALE_BLOCK,
  LOCK_SCALE_PASS,
  LockAxis,
  LockClass,
} from '../../src/dashboard/protocol';

type Entry = { cls: number; id: number; direction: number; scale: number };

const settle = () => new Promise((r) => setTimeout(r, 20));

const findByTextIn = async (root: HTMLElement, text: string): Promise<HTMLElement> => {
  const el = [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!el) throw new Error(`no button labelled ${text}`);
  return el;
};

const mock = vi.hoisted(() => ({
  sent: [] as { cls: number; id: number; dir: number; scale: number }[],
  entries: [] as { cls: number; id: number; direction: number; scale: number }[],
}));

vi.mock('@solidjs/router', () => ({
  A: (p: { children: unknown }) => p.children,
}));

// The page drives one verb now: lock and unlock are the two ends of the scale, so the mock records the
// scale rather than which button was pressed, which is what actually reaches the wire.
vi.mock('../../src/app/pages/dashboard/context', () => {
  const link = {
    scale: async (t: { cls: number; id: number }, dir: number, scale: number) => {
      mock.sent.push({ cls: t.cls, id: t.id, dir, scale });
    },
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      updateOnly: () => false,
      health: () => null,
      link: () => link,
      poll: () => () => ({ entries: mock.entries }),
      refreshPoll: () => {},
    }),
  };
});

import DeviceLock from '../../src/app/pages/dashboard/DeviceLock';

afterEach(() => {
  cleanup();
  mock.sent = [];
  mock.entries = [];
});

describe('DeviceLock', () => {
  it('locks the X axis by default', async () => {
    const { container } = render(() => <DeviceLock />);
    fireEvent.click(await findByTextIn(container, 'Lock'));
    await settle();
    expect(mock.sent).toEqual([
      { cls: LockClass.Axis, id: LockAxis.X, dir: 0, scale: LOCK_SCALE_BLOCK },
    ]);
  });

  it('picking a class selects a real usage, never the class wildcard', async () => {
    // Defaulting the picker to the wildcard made the Lock button act on every usage in the class,
    // and on firmware that predates the axis blanket it made the axis case do nothing at all.
    const { getByText, container } = render(() => <DeviceLock />);
    for (const cls of ['Button', 'Key', 'Media', 'Axis']) {
      mock.sent = [];
      fireEvent.click(getByText(cls));
      fireEvent.click(await findByTextIn(container, 'Lock'));
      await settle();
      expect(mock.sent).toHaveLength(1);
      expect(mock.sent[0].id).not.toBe(LOCK_ID_ALL);
    }
  });

  // The list is read off the document, and it only exists once the dropdown is open.
  const openOptions = async (container: HTMLElement): Promise<string[]> => {
    fireEvent.click(container.querySelector('.dd-b') as HTMLElement);
    await new Promise((r) => setTimeout(r, 20));
    return [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '');
  };

  it('sends every-axis as one frame per axis, not as the class wildcard', async () => {
    // The box has no blanket representation for the mouse classes: it expands one into per-target
    // bits. Firmware that predates the axis blanket drops the wildcard on arrival, so the three
    // frames are both equivalent and the only form that works everywhere.
    const { getByText, container } = render(() => <DeviceLock />);
    fireEvent.click(getByText('Axis'));
    const options = await openOptions(container);
    expect(options[0]).toMatch(/every axis/i);
    fireEvent.click(document.querySelectorAll('[role="option"]')[0] as HTMLElement);
    mock.sent = [];
    fireEvent.click(await findByTextIn(container, 'Lock'));
    await settle();
    expect(mock.sent).toEqual([
      { cls: LockClass.Axis, id: LockAxis.X, dir: 0, scale: LOCK_SCALE_BLOCK },
      { cls: LockClass.Axis, id: LockAxis.Y, dir: 0, scale: LOCK_SCALE_BLOCK },
      { cls: LockClass.Axis, id: LockAxis.Wheel, dir: 0, scale: LOCK_SCALE_BLOCK },
      { cls: LockClass.Axis, id: LockAxis.Pan, dir: 0, scale: LOCK_SCALE_BLOCK },
    ]);
    expect(mock.sent.some((f) => f.id === LOCK_ID_ALL)).toBe(false);
  });

  it('offers AC Pan as a lockable axis alongside X, Y and the wheel', async () => {
    const { getByText, container } = render(() => <DeviceLock />);
    fireEvent.click(getByText('Axis'));
    const options = await openOptions(container);
    expect(options.join('|')).toMatch(/pan/i);
  });

  it('still offers the blanket for the classes the box does implement it for', async () => {
    // Pins the test above to real content: if the option list came back empty for any reason, the
    // axis assertion would pass for the wrong reason.
    const { getByText, container } = render(() => <DeviceLock />);
    fireEvent.click(getByText('Button'));
    const options = await openOptions(container);
    expect(options.join('|')).toMatch(/every button/i);
  });

  it('the filter box narrows the list and empties again', async () => {
    // The filter is controlled by the picker, so a callback wired to the wrong event let the value
    // snap straight back and the box looked dead.
    const { container } = render(() => <DeviceLock />);
    const all = await openOptions(container);
    const input = container.querySelector('.dd-f') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'wheel' } });
    await settle();
    expect(input.value).toBe('wheel');
    const narrowed = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '');
    expect(narrowed).toContain('Wheel');
    expect(narrowed).not.toContain('X (left/right)');

    fireEvent.input(input, { target: { value: '' } });
    await settle();
    expect(input.value).toBe('');
    expect([...document.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '')).toEqual(all);
  });

  it('unlocks the same target it would lock', async () => {
    const { findByText } = render(() => <DeviceLock />);
    fireEvent.click(await findByText('Unlock'));
    await settle();
    // An unlock is a full pass, not a zero: sending 0 here would be a hard block under the scale wire.
    expect(mock.sent).toEqual([
      { cls: LockClass.Axis, id: LockAxis.X, dir: 0, scale: LOCK_SCALE_PASS },
    ]);
  });

  it('the slider sends its percentage, between the two ends', async () => {
    // The slider is a native range input at its step.
    const { container } = render(() => <DeviceLock />);
    const thumb = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(thumb).toBeTruthy();
    expect(thumb.step).toBe('5');
    // Defaults to a full pass, so Apply on an untouched slider changes nothing about the input.
    fireEvent.click(await findByTextIn(container, `Apply ${LOCK_SCALE_PASS}%`));
    await settle();
    expect(mock.sent).toEqual([
      { cls: LockClass.Axis, id: LockAxis.X, dir: 0, scale: LOCK_SCALE_PASS },
    ]);

    // One step down, and the button both relabels and sends the new value.
    mock.sent = [];
    fireEvent.input(thumb, { target: { value: String(LOCK_SCALE_PASS - 5) } });
    await settle();
    fireEvent.click(await findByTextIn(container, `Apply ${LOCK_SCALE_PASS - 5}%`));
    await settle();
    expect(mock.sent).toEqual([
      { cls: LockClass.Axis, id: LockAxis.X, dir: 0, scale: LOCK_SCALE_PASS - 5 },
    ]);
  });

  it('offers no edge to name on a media usage', async () => {
    // Media is the one class with no press and release: the box suppresses the usage whole and
    // ignores the direction byte, so offering Press here would promise a distinction it does not make.
    const { getByText, queryByText } = render(() => <DeviceLock />);
    fireEvent.click(getByText('Media'));
    await settle();
    expect(queryByText('Press')).toBeNull();
    expect(queryByText('Release')).toBeNull();
    expect(queryByText('The whole usage')).toBeTruthy();
  });

  it('drops a direction the newly picked class cannot address', async () => {
    // A radio whose selected value is no longer among its options keeps the old byte, so switching
    // from an axis on Against to a key would have sent a relative direction the box refuses.
    const { getByText, container } = render(() => <DeviceLock />);
    fireEvent.click(getByText('Against injection'));
    await settle();
    fireEvent.click(getByText('Key'));
    await settle();
    fireEvent.click(await findByTextIn(container, 'Lock'));
    await settle();
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0].dir).toBe(Direction.Both);
  });

  it('renders a blanket key lock as one chip per blocked edge, and media with no edge at all', async () => {
    // RESP(LOCKS) reports a key blanket as the commands that would rebuild it, one entry per edge,
    // and reports every media entry at Both because media has none.
    mock.entries = [
      { cls: LockClass.Key, id: LOCK_ID_ALL, direction: Direction.Positive, scale: LOCK_SCALE_BLOCK },
      { cls: LockClass.Media, id: 0xe9, direction: Direction.Both, scale: LOCK_SCALE_BLOCK },
    ] satisfies Entry[];
    const { findByText, queryByText } = render(() => <DeviceLock />);
    expect(await findByText('All keys press blocked')).toBeTruthy();
    expect(await findByText('Volume Up blocked')).toBeTruthy();
    expect(queryByText('Volume Up both blocked')).toBeNull();
  });

  it('names a block in words and a reversal once', async () => {
    mock.entries = [
      { cls: LockClass.Button, id: 1, direction: Direction.Both, scale: LOCK_SCALE_BLOCK },
      { cls: LockClass.Axis, id: LockAxis.X, direction: Direction.Both, scale: 40 },
      { cls: LockClass.Axis, id: LockAxis.Y, direction: Direction.Negative, scale: -100 },
    ] satisfies Entry[];
    const { findByText } = render(() => <DeviceLock />);
    expect(await findByText('Right blocked')).toBeTruthy();
    expect(await findByText('X (left/right) at 40%')).toBeTruthy();
    expect(await findByText('Y (up/down) negative reversed at 100%')).toBeTruthy();
  });

  it('offers the bearing-relative directions on an axis and not on a usage', async () => {
    const { getByText, queryByText } = render(() => <DeviceLock />);
    expect(queryByText('Against injection')).toBeTruthy();
    fireEvent.click(getByText('Button'));
    await settle();
    // A button has no bearing to be with or against, so the radio set drops back to the two edges.
    expect(queryByText('Against injection')).toBeNull();
    expect(queryByText('Press')).toBeTruthy();
  });
});
