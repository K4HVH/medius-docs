import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import {
  type ClipEntry,
  type ClipPacketTrigger,
  type ClipPacketTriggerEntry,
  CATCH_ID_ANY,
  CLIP_SET_AUTOLOCK,
  CLIP_SET_LOOP,
  CLIP_SET_RETAIN,
  CLIP_SET_RIDE,
  CatchClass,
  ClipOp,
  ClipState,
  Direction,
} from '../../src/dashboard/protocol';

const mock = vi.hoisted(() => ({
  setClip: (_v: unknown) => {},
  setImperfect: (_on: boolean) => {},
  setHealth: (_over: Record<string, boolean>) => {},
  setUnreadable: (_on: boolean) => {},
  // Which poll values the card asked to re-read, in order, and a hook that runs on each.
  refreshed: [] as string[],
  onRefresh: null as ((key: string) => void) | null,
  sets: [] as { id: number; value: number }[],
  appended: [] as unknown[][],
  // Every CLIP_TRIGGER call the card made, in order.
  triggerCalls: [] as { call: string; trigger?: unknown }[],
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  const { createSignal } = await import('solid-js');
  const [clip, setClip] = createSignal<unknown>(null);
  mock.setClip = setClip;
  const [imperfect, setImperfect] = createSignal(false);
  mock.setImperfect = setImperfect;
  const [unreadable, setUnreadable] = createSignal(false);
  mock.setUnreadable = setUnreadable;
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
    clipTrigger: async (trigger: unknown) => {
      mock.triggerCalls.push({ call: 'bind', trigger });
    },
    clipUntrigger: async (trigger: unknown) => {
      mock.triggerCalls.push({ call: 'unbind', trigger });
    },
    clipPacketTrigger: async (trigger: unknown) => {
      mock.triggerCalls.push({ call: 'bindPacket', trigger });
    },
    clipPacketUntrigger: async (trigger: unknown) => {
      mock.triggerCalls.push({ call: 'unbindPacket', trigger });
    },
    clipClearTriggers: async () => {
      mock.triggerCalls.push({ call: 'clear' });
    },
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
      pollUnreadable: (key: string) => () => key === 'clip' && unreadable(),
      refreshPoll: (key: string) => {
        mock.refreshed.push(key);
        mock.onRefresh?.(key);
      },
    }),
  };
});

vi.mock('@solidjs/router', () => ({
  A: (p: { href: string; children: unknown }) => {
    const a = document.createElement('a');
    a.href = p.href;
    a.textContent = String(p.children);
    return a;
  },
}));

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
  packetTriggers: [],
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
  mock.triggerCalls = [];
  mock.refreshed = [];
  mock.onRefresh = null;
  mock.setImperfect(false);
  mock.setUnreadable(false);
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

const hex = (s: string) => new Uint8Array(s.split(' ').map((b) => parseInt(b, 16)));

const packet = (over: Partial<ClipPacketTriggerEntry> = {}): ClipPacketTriggerEntry => ({
  cls: CatchClass.HidIn,
  id: 2,
  dir: Direction.Positive,
  action: ClipOp.Start,
  consume: true,
  oncePerRun: true,
  selectorLen: 1,
  match: hex('07 20'),
  mask: hex('ff 20'),
  hits: 0,
  ...over,
});

describe('DeviceClip packet triggers', () => {
  const named = (container: HTMLElement, name: string): HTMLInputElement => {
    const el = container.querySelector(`input[name="${name}"]`);
    if (!el) throw new Error(`no input named ${name}`);
    return el as HTMLInputElement;
  };
  const type = (container: HTMLElement, name: string, value: string) => {
    fireEvent.input(named(container, name), { target: { value } });
    fireEvent.blur(named(container, name));
  };
  // The card with the packet editor open.
  const mount = async (clip: Record<string, unknown> = {}) => {
    mock.setClip(status(clip));
    const view = render(() => <DeviceClip />);
    fireEvent.click(radio(view.container, 'A packet'));
    await settle();
    return view;
  };
  const bound = () => mock.triggerCalls.filter((c) => c.call === 'bindPacket').map((c) => c.trigger as ClipPacketTrigger);
  const alert = (container: HTMLElement) => container.querySelector('[role=alert]')?.textContent ?? null;
  const bind = async (container: HTMLElement) => {
    fireEvent.click(button(container, 'Bind'));
    await settle();
  };
  // The consuming once-per-run trigger of the firmware's wire vector, typed into the fields.
  const fillVector = async (container: HTMLElement) => {
    type(container, 'clip-pkt-id', '2');
    fireEvent.click(radio(container, 'In'));
    type(container, 'clip-pkt-match', '07 20');
    type(container, 'clip-pkt-mask', 'ff 20');
    fireEvent.click(radio(container, 'Start'));
    fireEvent.click(box(container, 'Consume the packet'));
    fireEvent.click(box(container, 'Once per run'));
    await settle();
    type(container, 'clip-pkt-selector', '1');
    await settle();
  };

  it('opens on an input, and swaps the input fields for the packet fields', async () => {
    mock.setClip(status());
    const { container, queryByLabelText } = render(() => <DeviceClip />);
    expect(radio(container, 'An input').checked).toBe(true);
    expect(hasRadio(container, 'Press')).toBe(true);
    expect(queryByLabelText('Match (hex)')).toBeNull();
    fireEvent.click(radio(container, 'A packet'));
    await settle();
    expect(hasRadio(container, 'Press')).toBe(false);
    expect(queryByLabelText('Match (hex)')).toBeTruthy();
    expect(['HID in', 'HID out', 'Vendor interrupt', 'Vendor bulk', 'Control', 'Emit'].every((c) => hasRadio(container, c))).toBe(true);
    expect(radio(container, 'HID in').checked).toBe(true);
  });

  it('binds a watching trigger while imperfect clones are off', async () => {
    const { container } = await mount();
    fireEvent.click(radio(container, 'Every id'));
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound()).toEqual([
      {
        cls: CatchClass.HidIn,
        id: CATCH_ID_ANY,
        dir: Direction.Both,
        action: ClipOp.Toggle,
        consume: false,
        oncePerRun: false,
        selectorLen: 0,
        match: new Uint8Array(0),
        mask: new Uint8Array(0),
      },
    ]);
  });

  it('binds a consuming once-per-run trigger from the fields', async () => {
    mock.setImperfect(true);
    const { container } = await mount();
    await fillVector(container);
    await bind(container);
    expect(alert(container)).toBeNull();
    const { hits: _hits, ...vector } = packet();
    expect(bound()).toEqual([vector]);
  });

  it('disables Consume the packet while imperfect clones are off, and says why', async () => {
    const why = 'Consuming a packet needs imperfect clones, on the Device tab. Watching one does not.';
    const { container, queryByText } = await mount();
    expect(box(container, 'Consume the packet').disabled).toBe(true);
    expect(queryByText(why)).toBeTruthy();
    mock.setImperfect(true);
    await settle();
    expect(box(container, 'Consume the packet').disabled).toBe(false);
    expect(queryByText(why)).toBeNull();
  });

  it('takes consume back when imperfect clones turn off under a ticked box', async () => {
    // Left ticked, the bind would carry a flag the box refuses, and the list would never gain it.
    mock.setImperfect(true);
    const { container, queryByText } = await mount();
    fireEvent.click(box(container, 'Consume the packet'));
    await settle();
    expect(queryByText(/A matched packet is not delivered\./)).toBeTruthy();
    mock.setImperfect(false);
    await settle();
    expect(box(container, 'Consume the packet').checked).toBe(false);
    expect(queryByText(/A matched packet is left untouched\./)).toBeTruthy();
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => t.consume)).toEqual([false]);
  });

  it('disables Consume the packet on Control, and says why', async () => {
    mock.setImperfect(true);
    const why = 'A control request always reaches the device, so there is nothing to consume.';
    const { container, queryByText } = await mount();
    fireEvent.click(box(container, 'Consume the packet'));
    fireEvent.click(radio(container, 'Control'));
    await settle();
    expect(box(container, 'Consume the packet').disabled).toBe(true);
    expect(box(container, 'Consume the packet').checked).toBe(false);
    expect(queryByText(why)).toBeTruthy();
    await bind(container);
    expect(bound().map((t) => [t.cls, t.consume])).toEqual([[CatchClass.Control, false]]);
    fireEvent.click(radio(container, 'Emit'));
    await settle();
    expect(box(container, 'Consume the packet').disabled).toBe(false);
    expect(queryByText(why)).toBeNull();
  });

  it('says when the verb runs and what becomes of the packet, as the two boxes are set', async () => {
    mock.setImperfect(true);
    const { container, queryByText, queryByLabelText } = await mount();
    expect(queryByText('The verb runs on every matching packet. A matched packet is left untouched.')).toBeTruthy();
    expect(queryByLabelText('Selector length')).toBeNull();
    fireEvent.click(box(container, 'Once per run'));
    fireEvent.click(box(container, 'Consume the packet'));
    await settle();
    expect(queryByLabelText('Selector length')).toBeTruthy();
    expect(queryByText(/first of a run of matching packets.*A matched packet is not delivered\./)).toBeTruthy();
  });

  it('follows the class with its blurb and its id label', async () => {
    const { container, queryByText, queryByLabelText } = await mount();
    expect(queryByText('Reports the device sends the game PC, by interface.')).toBeTruthy();
    expect(queryByLabelText('Interface number')).toBeTruthy();
    fireEvent.click(radio(container, 'Control'));
    await settle();
    expect(queryByText('Setup packets on a control endpoint.')).toBeTruthy();
    expect(queryByLabelText('Endpoint number (0 is EP0)')).toBeTruthy();
  });

  it('refuses a match that is not hex, unlike its mask in length, or past 16 bytes', async () => {
    const { container } = await mount();
    type(container, 'clip-pkt-match', '0g');
    await bind(container);
    expect(alert(container)).toBe('Match and mask must be hex.');
    type(container, 'clip-pkt-match', '07 20');
    type(container, 'clip-pkt-mask', 'ff');
    await bind(container);
    expect(alert(container)).toBe('Match and mask must be the same length.');
    type(container, 'clip-pkt-match', 'aa'.repeat(17));
    type(container, 'clip-pkt-mask', 'ff'.repeat(17));
    await bind(container);
    expect(alert(container)).toBe('Match and mask must be at most 16 bytes.');
    expect(bound()).toEqual([]);
    type(container, 'clip-pkt-match', 'aa'.repeat(16));
    type(container, 'clip-pkt-mask', 'ff'.repeat(16));
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound()).toHaveLength(1);
  });

  it('refuses once per run over anything wider than one stream', async () => {
    const stream = 'Once per run needs a class other than Control, one id, and In or Out.';
    mock.setImperfect(true);
    const { container } = await mount();
    await fillVector(container);

    fireEvent.click(radio(container, 'Both'));
    await bind(container);
    expect(alert(container)).toBe(stream);

    fireEvent.click(radio(container, 'In'));
    fireEvent.click(radio(container, 'Every id'));
    await bind(container);
    expect(alert(container)).toBe(stream);

    fireEvent.click(radio(container, 'Just one'));
    fireEvent.click(radio(container, 'Control'));
    await bind(container);
    expect(alert(container)).toBe(stream);
    expect(bound()).toEqual([]);

    fireEvent.click(radio(container, 'Vendor bulk'));
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => [t.cls, t.dir, t.oncePerRun])).toEqual([[CatchClass.VendorBulk, Direction.Positive, true]]);
  });

  it('takes the direction a class never carries off its picker, and says which way it travels', async () => {
    const { container, queryByText } = await mount();
    const dirs = () => ['Both', 'In', 'Out'].map((d) => radio(container, d).disabled);
    expect(dirs()).toEqual([false, false, true]);
    expect(queryByText('Every HID in report travels In.')).toBeTruthy();
    fireEvent.click(radio(container, 'HID out'));
    await settle();
    expect(dirs()).toEqual([false, true, false]);
    expect(queryByText('Every HID out report travels Out.')).toBeTruthy();
    expect(queryByText('Every HID in report travels In.')).toBeNull();
    fireEvent.click(radio(container, 'Emit'));
    await settle();
    expect(dirs()).toEqual([false, false, true]);
    expect(queryByText('Every emitted report travels In.')).toBeTruthy();
    for (const cls of ['Vendor interrupt', 'Vendor bulk', 'Control']) {
      fireEvent.click(radio(container, cls));
      await settle();
      expect(dirs()).toEqual([false, false, false]);
      expect(queryByText(/ travels (In|Out)\.$/)).toBeNull();
    }
  });

  it('falls back to Both when the class changes under a direction it never carries', async () => {
    const { container } = await mount();
    fireEvent.click(radio(container, 'Vendor bulk'));
    fireEvent.click(radio(container, 'Out'));
    await settle();
    fireEvent.click(radio(container, 'HID in'));
    await settle();
    expect(radio(container, 'Both').checked).toBe(true);
    expect(radio(container, 'Out').checked).toBe(false);
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => [t.cls, t.dir])).toEqual([[CatchClass.HidIn, Direction.Both]]);
    // A direction the new class carries stays where it was.
    fireEvent.click(radio(container, 'In'));
    fireEvent.click(radio(container, 'Emit'));
    await settle();
    expect(radio(container, 'In').checked).toBe(true);
    fireEvent.click(radio(container, 'HID out'));
    await settle();
    expect(radio(container, 'Both').checked).toBe(true);
  });

  it('refuses a match bit outside its mask, and leaves the typed bytes as they are', async () => {
    const { container } = await mount();
    type(container, 'clip-pkt-match', '07 21');
    type(container, 'clip-pkt-mask', 'ff 20');
    await bind(container);
    expect(alert(container)).toBe('Every bit set in the match must be set in the mask too, or no packet can match.');
    expect(bound()).toEqual([]);
    expect(named(container, 'clip-pkt-match').value).toBe('07 21');
    expect(named(container, 'clip-pkt-mask').value).toBe('ff 20');
    type(container, 'clip-pkt-mask', 'ff 21');
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => [Array.from(t.match), Array.from(t.mask)])).toEqual([[[0x07, 0x21], [0xff, 0x21]]]);
  });

  it('refuses once per run whose mask keeps no bit past the selector', async () => {
    mock.setImperfect(true);
    const { container } = await mount();
    await fillVector(container);
    type(container, 'clip-pkt-match', '07 00');
    type(container, 'clip-pkt-mask', 'ff 00');
    await bind(container);
    expect(alert(container)).toBe('The mask must keep at least one bit past the selector, or the run never ends.');
    expect(bound()).toEqual([]);
    // The same bytes bind without once per run: a trigger on every packet of a stream is a legal one.
    fireEvent.click(box(container, 'Once per run'));
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => t.oncePerRun)).toEqual([false]);
  });

  it('refuses a selector that leaves no match byte for the condition', async () => {
    mock.setImperfect(true);
    const { container } = await mount();
    await fillVector(container);
    type(container, 'clip-pkt-selector', '2');
    await bind(container);
    expect(alert(container)).toBe('The match must be longer than the selector.');
    expect(bound()).toEqual([]);
    type(container, 'clip-pkt-selector', '1');
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => t.selectorLen)).toEqual([1]);
  });

  it('sends no selector once Once per run is unticked', async () => {
    mock.setImperfect(true);
    const { container } = await mount();
    await fillVector(container);
    fireEvent.click(box(container, 'Once per run'));
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => [t.oncePerRun, t.selectorLen])).toEqual([[false, 0]]);
  });

  it('refuses a match the shared pool has no bytes for', async () => {
    // Seven held triggers of 16 bytes fill the pool of 112 with one slot still free.
    const held = Array.from({ length: 7 }, (_, i) =>
      packet({ id: i, consume: false, match: new Uint8Array(16).fill(i), mask: new Uint8Array(16).fill(0xff) }),
    );
    const { container, queryByText } = await mount({ packetTriggers: held });
    expect(queryByText(/Packets \(7 of 8, 112 of 112 match\s+bytes\)/)).toBeTruthy();
    type(container, 'clip-pkt-match', '07');
    type(container, 'clip-pkt-mask', 'ff');
    await bind(container);
    expect(alert(container)).toBe('Packet triggers share 112 match bytes. Remove one or shorten the match.');
    expect(bound()).toEqual([]);
    // A trigger with no match needs none of the pool.
    type(container, 'clip-pkt-match', '');
    type(container, 'clip-pkt-mask', '');
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound()).toHaveLength(1);
  });

  it('stops at eight packet triggers, and still replaces one it holds', async () => {
    const held = Array.from({ length: 8 }, (_, i) =>
      packet({ id: i, consume: false, oncePerRun: false, selectorLen: 0, match: hex('07'), mask: hex('ff') }),
    );
    const { container, queryByText } = await mount({ packetTriggers: held });
    expect(button(container, 'Bind').disabled).toBe(true);
    expect(queryByText('All 8 slots are used. Remove one first.')).toBeTruthy();
    // The key carries the match, so the same address alone is a ninth trigger.
    type(container, 'clip-pkt-id', '3');
    await settle();
    expect(button(container, 'Bind').disabled).toBe(true);
    fireEvent.click(radio(container, 'In'));
    type(container, 'clip-pkt-match', '07');
    type(container, 'clip-pkt-mask', 'ff');
    await settle();
    expect(button(container, 'Replace').disabled).toBe(false);
    expect(queryByText('All 8 slots are used. Remove one first.')).toBeNull();
    expect(queryByText(/Already bound; binding again replaces it, and a change starts its run/)).toBeTruthy();
    fireEvent.click(button(container, 'Replace'));
    await settle();
    expect(bound().map((t) => t.id)).toEqual([3]);
  });

  it('keeps the input slots and the packet slots apart', async () => {
    const held = Array.from({ length: 8 }, (_, i) => packet({ id: i }));
    mock.setClip(status({ packetTriggers: held }));
    const { container } = render(() => <DeviceClip />);
    // Eight packet triggers leave all eight input bindings free.
    expect(button(container, 'Bind').disabled).toBe(false);
  });

  it('lists both kinds, each packet trigger with its hits and read back in words', async () => {
    mock.setClip(
      status({
        triggers: [{ cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Toggle, consume: true }],
        packetTriggers: [
          packet({ hits: 3 }),
          packet({
            cls: CatchClass.VendorInterrupt,
            id: CATCH_ID_ANY,
            dir: Direction.Both,
            action: ClipOp.Toggle,
            consume: false,
            oncePerRun: false,
            selectorLen: 0,
            match: new Uint8Array(0),
            mask: new Uint8Array(0),
            hits: 1,
          }),
          packet({ cls: CatchClass.Control, id: 0, dir: Direction.Negative, action: ClipOp.Stop, consume: false, oncePerRun: false, selectorLen: 0, hits: 0xffff }),
        ],
      }),
    );
    const { container, queryByText } = render(() => <DeviceClip />);
    const chipText = [...container.querySelectorAll('.chip__label')].map((e) => e.textContent ?? '');
    expect(chipText).toContain('F1 press -> Toggle (consume)');
    expect(chipText).toContain('Start HID in 2');
    expect(chipText).toContain('Toggle vendor interrupt any');
    expect(chipText).toContain('Stop control 0');
    expect(queryByText('Inputs (1 of 8)')).toBeTruthy();
    expect(queryByText(/Packets \(3 of 8, 4 of 112 match\s+bytes\)/)).toBeTruthy();

    const rows = [...container.querySelectorAll('[data-packet-trigger]')].map((r) => ({
      chips: [...r.querySelectorAll('.chip__label')].map((e) => e.textContent),
      words: r.querySelector('p')?.textContent,
    }));
    expect(rows).toEqual([
      {
        chips: ['Start HID in 2', '3 hits'],
        words: 'HID in, interface 2, in, bytes 07 20 under ff 20: start, once per run (selector 1), consumes the packet',
      },
      {
        chips: ['Toggle vendor interrupt any', '1 hit'],
        words: 'Vendor interrupt, every endpoint, both directions, every packet: toggle',
      },
      {
        chips: ['Stop control 0', '65535+ hits'],
        words: 'Control, endpoint 0, out, bytes 07 20 under ff 20: stop',
      },
    ]);
  });

  it('says No triggers bound only while neither kind holds one', async () => {
    mock.setClip(status());
    const { queryByText } = render(() => <DeviceClip />);
    expect(queryByText('No triggers bound.')).toBeTruthy();
    mock.setClip(status({ packetTriggers: [packet()] }));
    await settle();
    expect(queryByText('No triggers bound.')).toBeNull();
    expect(queryByText(/Inputs \(/)).toBeNull();
  });

  it('removes a packet trigger by the entry the box listed', async () => {
    const held = [packet({ id: 1 }), packet({ id: 2, hits: 5 })];
    mock.setClip(status({ packetTriggers: held }));
    const { container } = render(() => <DeviceClip />);
    const rows = [...container.querySelectorAll('[data-packet-trigger]')];
    fireEvent.click(rows[1].querySelector('.chip__remove') as HTMLElement);
    await settle();
    expect(mock.triggerCalls).toEqual([{ call: 'unbindPacket', trigger: held[1] }]);
  });

  it('clears both kinds with one frame', async () => {
    mock.setClip(
      status({
        triggers: [{ cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Toggle, consume: false }],
        packetTriggers: [packet(), packet({ id: 3 })],
      }),
    );
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(button(container, 'Clear triggers'));
    await settle();
    expect(mock.triggerCalls).toEqual([{ call: 'clear' }]);
  });

  it('offers Clear triggers while either kind holds one', async () => {
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    expect(button(container, 'Clear triggers').disabled).toBe(true);
    mock.setClip(status({ packetTriggers: [packet()] }));
    await settle();
    expect(button(container, 'Clear triggers').disabled).toBe(false);
    mock.setClip(status({ triggers: [{ cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Toggle, consume: false }] }));
    await settle();
    expect(button(container, 'Clear triggers').disabled).toBe(false);
  });

  it('keeps the id and selector fields to whole numbers, and sends what they show', async () => {
    mock.setImperfect(true);
    const { container } = await mount();
    await fillVector(container);
    type(container, 'clip-pkt-match', '07 20 01');
    type(container, 'clip-pkt-mask', 'ff 20 ff');
    type(container, 'clip-pkt-id', '2.5');
    type(container, 'clip-pkt-selector', '1.5');
    await settle();
    expect(named(container, 'clip-pkt-id').value).toBe('3');
    expect(named(container, 'clip-pkt-selector').value).toBe('2');
    await bind(container);
    expect(alert(container)).toBeNull();
    expect(bound().map((t) => [t.id, t.selectorLen])).toEqual([[3, 2]]);
  });

  it('says the any-input binding takes the packet triggers with it', async () => {
    mock.setClip(
      status({ triggers: [{ cls: 0xff, id: 0xffff, edge: Direction.Both, action: ClipOp.Stop, consume: false }] }),
    );
    const { queryByText } = render(() => <DeviceClip />);
    expect(queryByText(/clears every trigger, packet triggers included/)).toBeTruthy();
  });
});

describe('DeviceClip bind verification', () => {
  const named = (container: HTMLElement, name: string): HTMLInputElement =>
    container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  const type = (container: HTMLElement, name: string, value: string) => {
    fireEvent.input(named(container, name), { target: { value } });
    fireEvent.blur(named(container, name));
  };
  const alert = (container: HTMLElement) => container.querySelector('[role=alert]')?.textContent ?? null;
  const optIn = 'The box did not take this trigger. It refuses a consuming trigger while imperfect clones are off.';
  const sentOf = () => mock.triggerCalls.filter((c) => c.call === 'bindPacket').map((c) => c.trigger as ClipPacketTrigger);
  const other = (i: number, len = 1) =>
    packet({ id: 10 + i, consume: false, oncePerRun: false, selectorLen: 0, match: new Uint8Array(len).fill(i), mask: new Uint8Array(len).fill(0xff) });
  // Binds the consuming once-per-run vector trigger with `held` on screen, and returns what went out.
  const bindVector = async (held: ClipPacketTriggerEntry[] = [], consume = true) => {
    mock.setImperfect(true);
    mock.setClip(status({ packetTriggers: held }));
    const view = render(() => <DeviceClip />);
    const { container } = view;
    fireEvent.click(radio(container, 'A packet'));
    await settle();
    type(container, 'clip-pkt-id', '2');
    fireEvent.click(radio(container, 'In'));
    type(container, 'clip-pkt-match', '07 20');
    type(container, 'clip-pkt-mask', 'ff 20');
    fireEvent.click(radio(container, 'Start'));
    if (consume) fireEvent.click(box(container, 'Consume the packet'));
    fireEvent.click(box(container, 'Once per run'));
    await settle();
    type(container, 'clip-pkt-selector', '1');
    await settle();
    const bindButton = [...container.querySelectorAll('button')].find((b) => /^(Bind|Replace)$/.test(b.textContent?.trim() ?? ''));
    fireEvent.click(bindButton as HTMLElement);
    await settle();
    const sent = sentOf();
    expect(sent).toHaveLength(1);
    return { ...view, sent: sent[0] };
  };
  // The next RESP(CLIP) the card receives.
  const reply = async (packets: ClipPacketTriggerEntry[]) => {
    mock.setClip(status({ packetTriggers: packets }));
    await settle();
  };

  it('re-reads the status once the bind is out, and waits for that read', async () => {
    const { container } = await bindVector();
    expect(mock.refreshed).toContain('clip');
    // The status on screen at the send predates the bind, so it is no answer.
    await settle();
    expect(alert(container)).toBeNull();
  });

  it('does not take a status read before the bind went out as its answer', async () => {
    // A poll already in flight answers with the pre-bind list. The card re-reads before it starts
    // waiting, so that answer lands before the wait and is not taken for the box's reply.
    let stale = true;
    mock.onRefresh = (key) => {
      if (key !== 'clip' || !stale) return;
      stale = false;
      mock.setClip(status({ packetTriggers: [] }));
    };
    const { container, sent } = await bindVector();
    expect(stale).toBe(false);
    expect(alert(container)).toBeNull();
    await reply([{ ...sent, hits: 0 }]);
    expect(alert(container)).toBeNull();
  });

  it('shows nothing when the next status holds the trigger as it was sent', async () => {
    const { container, sent } = await bindVector();
    await reply([{ ...sent, hits: 0 }]);
    expect(alert(container)).toBeNull();
    // One status answers one bind: a later one without it says nothing about that bind.
    await reply([]);
    expect(alert(container)).toBeNull();
  });

  it('says the box did not take a consuming trigger the next status leaves out', async () => {
    const { container } = await bindVector();
    mock.refreshed = [];
    await reply([]);
    expect(alert(container)).toBe(optIn);
    // The opt-in is read again, so Consume stands down if the box has it off.
    expect(mock.refreshed).toContain('imperfect');
  });

  it('says so when the box keeps a trigger under that key with other flags', async () => {
    // The replace went out consuming; the box kept the watching one it held.
    const held = packet({ consume: false, hits: 4 });
    const { container, sent } = await bindVector([held]);
    expect(sent.consume).toBe(true);
    await reply([held]);
    expect(alert(container)).toBe(optIn);
  });

  it('names a table that filled before the bind landed', async () => {
    const { container } = await bindVector(Array.from({ length: 7 }, (_, i) => other(i)));
    await reply(Array.from({ length: 8 }, (_, i) => other(i)));
    expect(alert(container)).toBe(
      'The box did not take this trigger. All 8 packet trigger slots are used. Remove one first.',
    );
  });

  it('names a match pool that filled before the bind landed', async () => {
    const { container } = await bindVector([other(0)]);
    await reply(Array.from({ length: 7 }, (_, i) => other(i, 16)));
    expect(alert(container)).toBe(
      'The box did not take this trigger. Packet triggers share 112 match bytes. Remove one or shorten the match.',
    );
  });

  it('says only that the box did not take a watching trigger it had room for', async () => {
    const { container, sent } = await bindVector([], false);
    expect(sent.consume).toBe(false);
    await reply([]);
    expect(alert(container)).toBe('The box did not take this trigger.');
  });

  it('drops the check when the triggers change from here before the next status', async () => {
    const { container } = await bindVector([other(0)]);
    fireEvent.click(button(container, 'Clear triggers'));
    await settle();
    expect(mock.triggerCalls.at(-1)).toEqual({ call: 'clear' });
    await reply([]);
    expect(alert(container)).toBeNull();
  });
});

describe('DeviceClip clip status', () => {
  it('stands down on a status it cannot read, and names the update that fixes it', async () => {
    mock.setClip(null);
    mock.setUnreadable(true);
    const { container, queryByText } = render(() => <DeviceClip />);
    const text = container.textContent ?? '';
    expect(text).toContain('This box\'s firmware sends clip status in an older layout than this dashboard reads.');
    expect(text).toContain('Update the firmware to use clip playback.');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/dashboard/update');
    for (const empty of ['Idle', 'B free', 'B loaded', 'No triggers bound.', 'Reading status...']) {
      expect(text).not.toContain(empty);
    }
    expect(queryByText('Clear')).toBeNull();
    expect(queryByText('Clear triggers')).toBeNull();
    expect(queryByText('Send to box')).toBeNull();
  });

  it('shows the card again once a status decodes', async () => {
    mock.setClip(null);
    mock.setUnreadable(true);
    const { container, queryByText } = render(() => <DeviceClip />);
    mock.setUnreadable(false);
    mock.setClip(status({ state: ClipState.Playing }));
    await settle();
    expect(container.textContent).not.toContain('older layout');
    expect(queryByText('Playing')).toBeTruthy();
  });

  it('reads Reading status, not an idle empty clip, before the first status lands', async () => {
    mock.setClip(null);
    const { container, queryByText } = render(() => <DeviceClip />);
    expect(queryByText('Reading status...')).toBeTruthy();
    for (const empty of ['Idle', 'B free', 'No triggers bound.']) expect(container.textContent).not.toContain(empty);
  });
});

// A number field by its label, the nth one of that name inside `root`.
const numberField = (root: ParentNode, label: string, nth = 0): HTMLInputElement => {
  const labels = [...root.querySelectorAll('label.number-input__label')].filter((l) => l.textContent?.trim() === label);
  const el = labels[nth]?.parentElement?.querySelector('input');
  if (!el) throw new Error(`no number field labelled ${label}`);
  return el as HTMLInputElement;
};
// Types a fraction and leaves the field, which is when a number field takes what was typed.
const typeFraction = async (el: HTMLInputElement) => {
  fireEvent.input(el, { target: { value: '2.5' } });
  fireEvent.blur(el);
  await settle();
};

describe('DeviceClip whole-number fields', () => {
  it.each([
    ['dx', { dx: 3, dy: 0 }],
    ['dy', { dx: 10, dy: 3 }],
  ])('keeps the move tick\'s %s to a whole number, and sends what it shows', async (field, xy) => {
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    const el = numberField(container, field);
    await typeFraction(el);
    expect(el.value).toBe('3');
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect(await sent(container)).toEqual([{ kind: 'tick', xy }]);
  });

  it.each([
    ['Wheel', 'Detents', { kind: 'tick', wheel: 3 }],
    ['Pan', 'Detents', { kind: 'tick', pan: 3 }],
    ['Wait', 'Ticks', { kind: 'gap', ticks: 3 }],
  ])('keeps the %s tick\'s %s to a whole number, and sends what it shows', async (kind, field, entry) => {
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, kind));
    await settle();
    const el = numberField(container, field);
    await typeFraction(el);
    expect(el.value).toBe('3');
    fireEvent.click(button(container, 'Add'));
    await settle();
    expect(await sent(container)).toEqual([entry]);
  });

  it.each([
    ['Raw report', 'clip-raw-ep'],
    ['Control transfer', 'clip-xfer-ep'],
  ])('keeps the %s endpoint to a whole number, and sends what it shows', async (kind, name) => {
    mock.setImperfect(true);
    mock.setClip(status());
    const { container } = render(() => <DeviceClip />);
    fireEvent.click(radio(container, kind));
    await settle();
    const el = container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
    await typeFraction(el);
    expect(el.value).toBe('3');
    if (kind === 'Raw report') {
      fireEvent.input(container.querySelector('input[name="clip-raw-bytes"]')!, { target: { value: '01' } });
    }
    fireEvent.click(button(container, 'Add'));
    await settle();
    const [tick] = (await sent(container)) as { raw?: { ep: number }[]; transfers?: { ep: number }[] }[];
    expect((tick.raw ?? tick.transfers)![0].ep).toBe(3);
  });
});
