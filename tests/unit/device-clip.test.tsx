import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import {
  CLIP_SET_AUTOLOCK,
  CLIP_SET_LOOP,
  CLIP_SET_RETAIN,
  CLIP_SET_RIDE,
  ClipState,
  Direction,
} from '../../src/dashboard/protocol';

const mock = vi.hoisted(() => ({
  setClip: (_v: unknown) => {},
  sets: [] as { id: number; value: number }[],
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  const { createSignal } = await import('solid-js');
  const [clip, setClip] = createSignal<unknown>(null);
  mock.setClip = setClip;
  const health = {
    linkUp: true,
    mouseAttached: true,
    cloneConfigured: true,
    injectionActive: false,
    rateConfident: true,
    lockOn: false,
    catchOn: false,
    kbdAttached: true,
  };
  const link = {
    clipSet: async (id: number, value: number) => {
      mock.sets.push({ id, value });
    },
    clipCtrl: async () => {},
    clipAppend: async () => {},
    clipTrigger: async () => {},
    clipUntrigger: async () => {},
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      health: () => health,
      link: () => link,
      poll: (key: string) => () => (key === 'clip' ? clip() : key === 'moveRide' ? 0 : null),
      refreshPoll: () => {},
    }),
  };
});

import DeviceClip from '../../src/app/pages/dashboard/DeviceClip';

const status = (over: Record<string, unknown> = {}) => ({
  state: ClipState.Idle,
  freeBytes: 65536,
  totalBytes: 0,
  played: 0,
  ticks: 0,
  underruns: 0,
  overruns: 0,
  seqGaps: 0,
  held: [],
  autolock: 0,
  loop: false,
  retain: false,
  finalized: false,
  triggers: [],
  ...over,
});

const settle = () => new Promise((r) => setTimeout(r, 20));

const box = (container: HTMLElement, label: string): HTMLInputElement => {
  const el = [...container.querySelectorAll('input[type=checkbox]')].find((i) =>
    (i.closest('label') ?? i.parentElement)?.textContent?.trim().startsWith(label),
  );
  if (!el) throw new Error(`no checkbox labelled ${label}`);
  return el as HTMLInputElement;
};

afterEach(() => {
  cleanup();
  mock.sets = [];
});

// The trigger edge radio and the consume checkbox constrain each other, so both are reached the
// same way: by their visible label.
const radio = (container: HTMLElement, label: string): HTMLInputElement => {
  const el = [...container.querySelectorAll('input[type=radio]')].find((i) =>
    (i.closest('label') ?? i.parentElement)?.textContent?.trim() === label,
  );
  if (!el) throw new Error(`no radio labelled ${label}`);
  return el as HTMLInputElement;
};

describe('DeviceClip trigger edge and consume', () => {
  it('opens on the first class in the list, like every other picker', async () => {
    // The trigger picker opened on Key while Button sat at the top of its own radio, so the
    // selection did not match the option the list led with.
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    const classes = [...container.querySelectorAll('input[type=radio]')].filter((i) =>
      ['Button', 'Key', 'Media', 'Anything'].includes(
        (i.closest('label') ?? i.parentElement)?.textContent?.trim() ?? '',
      ),
    ) as HTMLInputElement[];
    // The build section has its own class radio first, so the trigger picker's is the later set.
    const trigger = classes.slice(-4);
    expect(trigger).toHaveLength(4);
    expect((trigger[0].closest('label') ?? trigger[0].parentElement)?.textContent?.trim()).toBe(
      'Button',
    );
    expect(trigger[0].checked).toBe(true);
  });

  it('places no restriction between the edge and consume', async () => {
    // The box stores the consume flag on any edge and reports it back, so the picker has to be
    // able to build every binding the box can hold. Blocking the pair here would leave a state the
    // list can display when another client sets it but this card cannot create.
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    const consume = box(container, 'Consume');
    expect(radio(container, 'Release').disabled).toBe(false);
    fireEvent.click(consume);
    await settle();
    expect(radio(container, 'Release').disabled).toBe(false);
    fireEvent.click(radio(container, 'Release'));
    await settle();
    expect(consume.disabled).toBe(false);
    expect(consume.checked).toBe(true);
  });

  it('claims the lock in the list only for a binding that can take one', async () => {
    // The box installs it on the press branch only, so saying "locks input" against a release
    // binding would be the readout describing something that never happens.
    mock.setClip(
      status({
        triggers: [
          { cls: 1, id: 0x3a, edge: Direction.Positive, action: 5, consume: true },
          { cls: 1, id: 0x3b, edge: Direction.Both, action: 5, consume: true },
          { cls: 1, id: 0x3c, edge: Direction.Negative, action: 5, consume: true },
        ],
      }),
    );
    const { container } = render(() => <DeviceClip />);
    const chips = [...container.querySelectorAll('.chip__label')].map((e) => e.textContent ?? '');
    const find = (name: string) => chips.find((c) => c.startsWith(name)) ?? '';
    expect(find('F1 press')).toContain('(consume)');
    expect(find('F2 both edges')).toContain('(consume)');
    expect(find('F3 release')).not.toContain('(consume)');
  });
});

describe('DeviceClip settings', () => {
  it('disables loop until the clip is replayable', async () => {
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    expect(box(container, 'Loop').disabled).toBe(true);
    mock.setClip(status({ retain: true }));
    expect(box(container, 'Loop').disabled).toBe(false);
  });

  it('clears loop on the box when replayable is turned off', async () => {
    // The box keeps the two flags independently, so a loop left set is a flag nothing shows that
    // takes effect again as soon as replayable comes back.
    mock.setClip(status({ retain: true, loop: true }));
    const { container } = render(() => <DeviceClip />);
    expect(box(container, 'Loop').checked).toBe(true);

    fireEvent.click(box(container, 'Replayable'));
    await settle();

    expect(mock.sets).toEqual([
      { id: CLIP_SET_RETAIN, value: 0 },
      { id: CLIP_SET_LOOP, value: 0 },
    ]);
    // And it stops showing a tick for a setting that is no longer set.
    expect(box(container, 'Loop').checked).toBe(false);
    expect(box(container, 'Loop').disabled).toBe(true);
  });

  it('leaves loop alone when replayable is turned off and loop was already off', async () => {
    mock.setClip(status({ retain: true, loop: false }));
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(box(container, 'Replayable'));
    await settle();
    expect(mock.sets).toEqual([{ id: CLIP_SET_RETAIN, value: 0 }]);
  });

  it('does not touch loop when replayable is turned on', async () => {
    mock.setClip(status({ retain: false }));
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(box(container, 'Replayable'));
    await settle();
    expect(mock.sets).toEqual([{ id: CLIP_SET_RETAIN, value: 1 }]);
  });

  it('sends the ride setting under its own id, and it is off by default', async () => {
    // A clip bypasses movement riding unless this is set, so sending the wrong id here would leave a
    // clip silently rideable (or not) with the box and the checkbox disagreeing.
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    const ride = box(container, 'Motion rides a real report');
    expect(ride.checked).toBe(false);
    fireEvent.click(ride);
    await settle();
    expect(mock.sets).toEqual([{ id: CLIP_SET_RIDE, value: 1 }]);
    // The tick follows the box's own readback once it agrees, not the click.
    mock.setClip(status({ ride: true }));
    expect(box(container, 'Motion rides a real report').checked).toBe(true);
  });

  it('masks the autolock scope to the bits the box defines', async () => {
    mock.setClip(status({ autolock: 0 }));
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(box(container, 'Aim'));
    await settle();
    expect(mock.sets).toEqual([{ id: CLIP_SET_AUTOLOCK, value: 0x01 }]);
  });

  it('keeps earlier autolock bits when a second one is ticked quickly', async () => {
    // Read-modify-write against the poll dropped the first bit when two clicks landed inside one
    // interval, because the second read still saw the pre-first value.
    mock.setClip(status({ autolock: 0 }));
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(box(container, 'Aim'));
    fireEvent.click(box(container, 'Buttons'));
    await settle();
    expect(mock.sets.at(-1)).toEqual({ id: CLIP_SET_AUTOLOCK, value: 0x05 });
  });
});
