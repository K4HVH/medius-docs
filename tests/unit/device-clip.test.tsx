import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import {
  type ClipEntry,
  CLIP_SET_AUTOLOCK,
  CLIP_SET_LOOP,
  CLIP_SET_RETAIN,
  CLIP_SET_RIDE,
  ClipState,
  Direction,
} from '../../src/dashboard/protocol';

const mock = vi.hoisted(() => ({
  setClip: (_v: unknown) => {},
  setImperfect: (_on: boolean) => {},
  setHealth: (_over: Record<string, boolean>) => {},
  sets: [] as { id: number; value: number }[],
  appended: [] as unknown[][],
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  const { createSignal } = await import('solid-js');
  const [clip, setClip] = createSignal<unknown>(null);
  mock.setClip = setClip;
  const [imperfect, setImperfect] = createSignal(false);
  mock.setImperfect = setImperfect;
  const base = {
    linkUp: true,
    mouseAttached: true,
    cloneConfigured: true,
    injectionActive: false,
    rateConfident: true,
    lockOn: false,
    catchOn: false,
    kbdAttached: true,
  };
  const [health, setHealth] = createSignal(base);
  mock.setHealth = (over) => setHealth({ ...base, ...over });
  const link = {
    clipSet: async (id: number, value: number) => {
      mock.sets.push({ id, value });
    },
    clipCtrl: async () => {},
    clipAppend: async (entries: unknown[]) => {
      mock.appended.push(entries);
    },
    clipTrigger: async () => {},
    clipUntrigger: async () => {},
  };
  const values: Record<string, () => unknown> = {
    clip,
    moveRide: () => 0,
    imperfect: () => ({ allowed: imperfect(), overCapacity: false, cloneImperfect: false }),
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      updateOnly: () => false,
      health,
      link: () => link,
      poll: (key: string) => () => values[key]?.() ?? null,
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
  xfers: 0,
  xferErrs: 0,
  gated: 0,
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
  mock.appended = [];
  mock.setImperfect(false);
  mock.setHealth({});
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

const button = (container: HTMLElement, name: string): HTMLButtonElement => {
  const el = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  if (!el) throw new Error(`no button named ${name}`);
  return el as HTMLButtonElement;
};

const hasRadio = (container: HTMLElement, label: string): boolean =>
  [...container.querySelectorAll('input[type=radio]')].some(
    (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === label,
  );

const draftChips = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('.chip__label')].map((e) => e.textContent ?? '');

// What Send to box handed the link, which is the entry the pickers built.
const sent = async (container: HTMLElement): Promise<ClipEntry[]> => {
  fireEvent.click(button(container, 'Send to box'));
  await settle();
  return (mock.appended.at(-1) ?? []) as ClipEntry[];
};

describe('DeviceClip clone gate', () => {
  it('plays on any clone: a keyboard alone gets the whole card', () => {
    mock.setHealth({ mouseAttached: false, kbdAttached: true, cloneConfigured: true });
    mock.setClip(status());
    const { queryByText, getByText } = render(() => <DeviceClip />);
    expect(queryByText(/Clips need/)).toBeNull();
    expect(getByText('Send to box')).toBeTruthy();
  });

  it('stands down with no clone up, and asks for a device, not a mouse', () => {
    mock.setHealth({ cloneConfigured: false });
    mock.setClip(status());
    const { getByText, queryByText } = render(() => <DeviceClip />);
    expect(getByText('Clips need a cloned device. Plug one into USB3.')).toBeTruthy();
    expect(queryByText('Send to box')).toBeNull();
  });
});

describe('DeviceClip draft ticks', () => {
  it('builds a pan tick', async () => {
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Pan'));
    await settle();
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect(draftChips(container)).toContain('pan 1');
    expect(await sent(container)).toEqual([{ kind: 'tick', pan: 1 }]);
  });

  it('offers raw report and control transfer ticks only while imperfect clones are on', async () => {
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    expect(hasRadio(container, 'Pan')).toBe(true);
    expect(hasRadio(container, 'Raw report')).toBe(false);
    expect(hasRadio(container, 'Control transfer')).toBe(false);
    mock.setImperfect(true);
    await settle();
    expect(hasRadio(container, 'Raw report')).toBe(true);
    expect(hasRadio(container, 'Control transfer')).toBe(true);
  });

  it('says why two tick kinds are missing while imperfect clones are off', async () => {
    mock.setClip(status());
    const { queryByText } = render(() => <DeviceClip />);
    const note = 'Raw report and control transfer ticks need imperfect clones, on the Device tab.';
    expect(queryByText(note)).toBeTruthy();
    mock.setImperfect(true);
    await settle();
    expect(queryByText(note)).toBeNull();
  });

  it('says where a raw report lands, and the line follows the direction', async () => {
    mock.setImperfect(true);
    mock.setClip(status());
    const { container, queryByText } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Raw report'));
    await settle();
    expect(queryByText('The report reaches the game PC.')).toBeTruthy();
    expect(queryByText('The report reaches the device.')).toBeNull();
    fireEvent.click(radio(container, 'Out'));
    await settle();
    expect(queryByText('The report reaches the device.')).toBeTruthy();
    expect(queryByText('The report reaches the game PC.')).toBeNull();
  });

  it('reads the setup packet back in words, and the out data line follows bmRequestType', async () => {
    mock.setImperfect(true);
    mock.setClip(status());
    const { container, getByLabelText, queryByText } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Control transfer'));
    await settle();
    expect(queryByText('Device to host, standard, to the device: GET_DESCRIPTOR.')).toBeTruthy();
    expect(queryByText('Unused: this request reads, it does not write.')).toBeTruthy();
    fireEvent.input(getByLabelText('bmRequestType'), { target: { value: '0x21' } });
    fireEvent.input(getByLabelText('bRequest'), { target: { value: '9' } });
    await settle();
    expect(queryByText('Host to device, class, to an interface.')).toBeTruthy();
    expect(queryByText('The data stage this request carries to the device.')).toBeTruthy();
    expect(queryByText('Unused: this request reads, it does not write.')).toBeNull();
    fireEvent.input(getByLabelText('bmRequestType'), { target: { value: 'zz' } });
    await settle();
    expect(queryByText('bmRequestType must be a number.')).toBeTruthy();
  });

  it('takes the raw report fields away when imperfect clones turn off under them', async () => {
    // Left showing, Add would still build a tick the box discards as it plays.
    mock.setImperfect(true);
    mock.setClip(status());
    const { container, queryByLabelText } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Raw report'));
    await settle();
    expect(queryByLabelText('Bytes (hex)')).toBeTruthy();
    mock.setImperfect(false);
    await settle();
    expect(queryByLabelText('Bytes (hex)')).toBeNull();
    expect(radio(container, 'Move').checked).toBe(true);
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect(draftChips(container)).toContain('move 10,0');
  });

  it('builds a raw report tick from the endpoint, direction and hex bytes', async () => {
    mock.setImperfect(true);
    mock.setClip(status());
    const { container, getByLabelText } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Raw report'));
    await settle();
    fireEvent.input(getByLabelText('Bytes (hex)'), { target: { value: '10 ff 05' } });
    fireEvent.click(radio(container, 'Out'));
    await settle();
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect(draftChips(container)).toContain('raw out 1, 3 B');
    expect(await sent(container)).toEqual([
      { kind: 'tick', raw: [{ ep: 1, dir: Direction.Negative, bytes: new Uint8Array([0x10, 0xff, 0x05]) }] },
    ]);
  });

  it('refuses a raw report it cannot send, and says which field is wrong', async () => {
    mock.setImperfect(true);
    mock.setClip(status());
    const { container, getByLabelText, findByRole } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Raw report'));
    await settle();

    fireEvent.click(button(container, 'Add'));
    expect((await findByRole('alert')).textContent).toBe('Enter the bytes to put on the endpoint.');

    fireEvent.input(getByLabelText('Bytes (hex)'), { target: { value: '0g' } });
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe('Bytes must be hex.');

    // 507 bytes is one more than an entry holds beside its own header.
    fireEvent.input(getByLabelText('Bytes (hex)'), { target: { value: 'aa'.repeat(507) } });
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe('A tick must encode to at most 512 bytes.');
    expect(draftChips(container).some((c) => c.startsWith('raw'))).toBe(false);

    // The largest one that fits goes in, and the refusal clears.
    fireEvent.input(getByLabelText('Bytes (hex)'), { target: { value: 'aa'.repeat(506) } });
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect(draftChips(container)).toContain('raw in 1, 506 B');
    expect(container.querySelector('[role=alert]')).toBeNull();
  });

  it('builds a control transfer tick from the setup fields and the out data', async () => {
    mock.setImperfect(true);
    mock.setClip(status());
    const { container, getByLabelText } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Control transfer'));
    await settle();
    fireEvent.input(getByLabelText('bmRequestType'), { target: { value: '0x21' } });
    fireEvent.input(getByLabelText('bRequest'), { target: { value: '9' } });
    fireEvent.input(getByLabelText('wValue'), { target: { value: '0x0300' } });
    fireEvent.input(getByLabelText('wLength'), { target: { value: '2' } });
    fireEvent.input(getByLabelText('Out data (hex)'), { target: { value: '04 01' } });
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect(draftChips(container)).toContain('transfer out 0, 2 B');
    expect(await sent(container)).toEqual([
      {
        kind: 'tick',
        transfers: [
          {
            ep: 0,
            setup: { bmRequestType: 0x21, bRequest: 9, wValue: 0x0300, wIndex: 0, wLength: 2 },
            out: new Uint8Array([0x04, 0x01]),
          },
        ],
      },
    ]);
  });

  it('refuses a control transfer whose out data does not fit its request', async () => {
    mock.setImperfect(true);
    mock.setClip(status());
    const { container, getByLabelText, findByRole } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, 'Control transfer'));
    await settle();
    const mismatch = 'Out data must be wLength bytes, and blank for a request that reads.';

    // The default request reads 18 bytes, so any out data is wrong for it.
    fireEvent.input(getByLabelText('Out data (hex)'), { target: { value: '00' } });
    fireEvent.click(button(container, 'Add'));
    expect((await findByRole('alert')).textContent).toBe(mismatch);

    // A request that writes 2 bytes, given 1.
    fireEvent.input(getByLabelText('bmRequestType'), { target: { value: '0x21' } });
    fireEvent.input(getByLabelText('wLength'), { target: { value: '2' } });
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe(mismatch);

    fireEvent.input(getByLabelText('wLength'), { target: { value: 'two' } });
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe('Every setup field must be a number.');

    fireEvent.input(getByLabelText('wLength'), { target: { value: '1' } });
    fireEvent.input(getByLabelText('Out data (hex)'), { target: { value: 'zz' } });
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe('Out data must be hex.');
    expect(draftChips(container).some((c) => c.startsWith('transfer'))).toBe(false);
  });
});

describe('DeviceClip transfer counters', () => {
  it('shows completed, failed and discarded items since the clip was loaded', async () => {
    // The box counts since boot, so the first status is the baseline and only the growth shows.
    mock.setClip(status({ xfers: 100, xferErrs: 7, gated: 3 }));
    const { container } = render(() => <DeviceClip />);
    await settle();
    expect(draftChips(container).some((c) => /transfer|discarded/.test(c))).toBe(false);

    mock.setClip(status({ xfers: 104, xferErrs: 8, gated: 5 }));
    await settle();
    const chips = draftChips(container);
    expect(chips).toContain('4 transfers');
    expect(chips).toContain('1 failed transfer');
    expect(chips).toContain('2 discarded items');
  });

  it('shows each counter for its own growth alone', async () => {
    mock.setClip(status({ xfers: 1, xferErrs: 1, gated: 1 }));
    const { container } = render(() => <DeviceClip />);
    await settle();
    mock.setClip(status({ xfers: 1, xferErrs: 1, gated: 4 }));
    await settle();
    expect(draftChips(container).filter((c) => /transfer|discarded/.test(c))).toEqual(['3 discarded items']);
    mock.setClip(status({ xfers: 1, xferErrs: 3, gated: 4 }));
    await settle();
    expect(draftChips(container)).toContain('2 failed transfers');
  });
});
