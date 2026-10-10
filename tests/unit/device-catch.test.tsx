import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import {
  type CatchFilter,
  type TrafficEvent,
  CatchClass,
  ClockDomain,
  Direction,
} from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

const mock = vi.hoisted(() => ({
  // As the session holds them: the list and its count of every event added change together.
  push: (_v: unknown[]) => {},
  clear: () => {},
  caught: [] as unknown[],
  refuse: false,
  // The box takes the subscription but leaves it out of its table.
  unknown: false,
  // Refuses every entry after this many.
  refuseAfter: -1,
  uncatches: 0,
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  const { createSignal } = await import('solid-js');
  const [events, setEvents] = createSignal<{ list: unknown[]; added: number }>({ list: [], added: 0 });
  mock.push = (evs) => setEvents((e) => ({ list: [...e.list, ...evs].slice(-200), added: e.added + evs.length }));
  mock.clear = () => setEvents((e) => ({ list: [], added: e.added }));
  const state = () => ({
    tableFull: false,
    dropped: 0,
    clock: { offsetUs: 0, ratePpb: 0, delayUs: 0, ageMs: null },
    entries: mock.caught.map((f) => ({ ...(f as object), dropped: 0 })),
  });
  const link = {
    uncatch: async () => {
      mock.uncatches += 1;
      mock.caught = [];
    },
    catch: async (f: unknown) => {
      if (mock.refuse || (mock.refuseAfter >= 0 && mock.caught.length >= mock.refuseAfter)) throw new Error('The box refused that.');
      if (!mock.unknown) mock.caught.push(f);
    },
    queryCatch: async () => state(),
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      health: () => ({ catchOn: true }),
      link: () => link,
      poll: () => state,
      refreshPoll: () => {},
      inputEvents: () => events().list,
      inputEventsAdded: () => events().added,
      clearInputEvents: () => mock.clear(),
    }),
  };
});

import DeviceEventCatch from '../../src/app/pages/dashboard/DeviceEventCatch';

afterEach(() => {
  cleanup();
  mock.refuse = false;
  mock.unknown = false;
  mock.refuseAfter = -1;
  mock.uncatches = 0;
  mock.caught = [];
  mock.clear();
});

const traffic = (over: Partial<TrafficEvent>): TrafficEvent => ({
  tsUs: 1000,
  clk: ClockDomain.Device,
  cls: CatchClass.ClipTransfer,
  id: 0,
  dir: Direction.Positive,
  flags: 0,
  trueLen: over.bytes?.length ?? 0,
  bytes: new Uint8Array(0),
  ...over,
});

const GET_REPORT = [0xa1, 0x01, 0x00, 0x03, 0x00, 0x00, 0x03, 0x00];

const radio = (container: HTMLElement, name: string): HTMLButtonElement => {
  const el = [...container.querySelectorAll('[role="radio"]')].find((b) => b.textContent?.trim() === name);
  if (!el) throw new Error(`no radio labelled ${name}`);
  return el as HTMLButtonElement;
};

const button = (container: HTMLElement, name: string): HTMLButtonElement => {
  const el = [...container.querySelectorAll('button:not([role])')].find((b) => b.textContent?.trim() === name);
  if (!el) throw new Error(`no button named ${name}`);
  return el as HTMLButtonElement;
};

// Each line of the log as its cells: the sequence number, the clock and the event.
const lines = (container: HTMLElement): string[][] =>
  [...container.querySelectorAll('[role="log"] > div')].map((r) => [...r.children].map((c) => c.textContent ?? ''));

// Every case starts a subscription, as a reader would before the box sends anything.
const watching = async (preset = 'Raw endpoints') => {
  const view = render(() => <DeviceEventCatch />);
  // The preset is a dropdown: open it and pick by name.
  const field = [...view.container.querySelectorAll('.labelled')].find((l) => l.querySelector('.field-l')?.textContent === 'Preset')!;
  fireEvent.click(field.querySelector('.dd-b')!);
  await settle();
  fireEvent.click([...field.querySelectorAll('[role="option"]')].find((o) => o.textContent === preset)!);
  fireEvent.click(button(view.container, 'Watch'));
  await settle();
  return {
    ...view,
    log: () => lines(view.container).map((l) => l.join(' ')).join('\n'),
    bodies: () => lines(view.container).map((l) => l[2]),
  };
};

let seq = 0;
const show = async (...evs: TrafficEvent[]) => {
  mock.push(evs.map((traffic) => ({ seq: seq++, ev: { kind: 'traffic', traffic } })));
  await settle();
};

describe('DeviceEventCatch log', () => {
  it('copies the log, one line a row', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = await watching();
    await show(traffic({ bytes: new Uint8Array([...GET_REPORT, 0xaa]) }));
    fireEvent.click(button(container, 'Copy'));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect((writeText.mock.calls[0] as unknown as [string])[0]).toContain('clip-transfer in 0x0 OK [a1 01 00 03 00 00 03 00] [aa]');
    await waitFor(() => expect(button(container, 'Copied')).toBeTruthy());
  });
});

describe('DeviceEventCatch clip transfers', () => {
  it('subscribes to a clip\'s transfers with the raw endpoints', async () => {
    await watching();
    const classes = (mock.caught as CatchFilter[]).map((f) => f.cls);
    expect(classes).toContain(CatchClass.ClipTransfer);
    expect(classes).toContain(CatchClass.Control);
  });

  it('names the class, the transfer status, and the setup packet apart from the data', async () => {
    const { log } = await watching();
    await show(traffic({ bytes: new Uint8Array([...GET_REPORT, 0xaa, 0xbb, 0xcc]) }));
    expect(log()).toContain('clip-transfer in 0x0 OK [a1 01 00 03 00 00 03 00] [aa bb cc]');
  });

  it('reads the flags byte of a clip transfer as a transfer status', async () => {
    const { bodies } = await watching();
    const out = { dir: Direction.Negative, bytes: new Uint8Array([0x21, 0x09, 0x00, 0x03, 0x00, 0x00, 0x02, 0x00]) };
    await show(
      traffic({ ...out, flags: 0xfd }),
      traffic({ ...out, flags: 0xfe }),
      traffic({ ...out, flags: 0xff }),
      traffic({ ...out, flags: 0xfc }),
    );
    // Oldest first. An OUT transfer's event carries the setup packet alone, so one group of bytes.
    expect(bodies()).toEqual([
      'clip-transfer out 0x0 STALL [21 09 00 03 00 00 02 00]',
      'clip-transfer out 0x0 NAK [21 09 00 03 00 00 02 00]',
      'clip-transfer out 0x0 NO DEVICE [21 09 00 03 00 00 02 00]',
      'clip-transfer out 0x0 REFUSED [21 09 00 03 00 00 02 00]',
    ]);
  });

  it('splits a control transaction the same way, and names the handshake the game PC got', async () => {
    const { bodies } = await watching();
    const setup = [0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00];
    await show(
      traffic({ cls: CatchClass.Control, flags: 0x01, bytes: new Uint8Array(setup) }),
      traffic({ cls: CatchClass.Control, flags: 0x02, bytes: new Uint8Array(setup) }),
      traffic({ cls: CatchClass.Control, flags: 0x00, bytes: new Uint8Array([...setup, 0x12, 0x01]) }),
    );
    expect(bodies()).toEqual([
      'control in 0x0 STALL [80 06 00 01 00 00 12 00]',
      'control in 0x0 NAK [80 06 00 01 00 00 12 00]',
      'control in 0x0 [80 06 00 01 00 00 12 00] [12 01]',
    ]);
  });

  // Bit 7 is the rule bit on the classes a rewrite rule acts at, beside a control handshake or the bulk
  // bits. A clip transfer's whole byte is its status, so 0xfd there is a stall, never a rule.
  it('marks a packet a rewrite rule acted on, and only on the classes a rule acts at', async () => {
    const { log, queryByText, findByText } = await watching();
    const out = [0x21, 0x09, 0x00, 0x02, 0x00, 0x00, 0x02, 0x00];
    await show(traffic({ cls: CatchClass.ClipTransfer, dir: Direction.Negative, flags: 0xfd, bytes: new Uint8Array(out) }));
    expect(log()).toContain('clip-transfer out 0x0 STALL [21 09 00 02 00 00 02 00]');
    expect(log()).not.toContain('RULE');
    expect(queryByText(/RULE marks a packet/)).toBeNull();

    await show(
      traffic({ cls: CatchClass.Control, dir: Direction.Negative, flags: 0x81, bytes: new Uint8Array([...out, 0x01, 0x00]) }),
      traffic({ cls: CatchClass.HidIn, clk: ClockDomain.Host, flags: 0x80, bytes: new Uint8Array([0x01, 0x02]) }),
      traffic({ cls: CatchClass.VendorBulk, flags: 0x81, bytes: new Uint8Array([0xaa]) }),
      traffic({ cls: CatchClass.Emit, flags: 0x00, bytes: new Uint8Array([0x03]) }),
    );
    expect(log()).toContain('control out 0x0 STALL RULE [21 09 00 02 00 00 02 00] [01 00]');
    expect(log()).toContain('hid-in in 0x0 RULE [01 02]');
    expect(log()).toContain('vendor-bulk in 0x0 end RULE [aa]');
    expect(log()).toContain('emit in 0x0 [03]');
    await findByText('RULE marks a packet a rewrite rule changed, dropped, answered or refused.');
  });

  it('shows a capture cut inside the setup packet as the bytes it is', async () => {
    const { log } = await watching();
    await show(traffic({ trueLen: 11, bytes: new Uint8Array([0xa1, 0x01, 0x00, 0x03]) }));
    expect(log()).toContain('clip-transfer in 0x0 OK [a1 01 00 03] (+7 cut)');
  });

  it('leaves every other class as one group of bytes', async () => {
    const { log } = await watching();
    await show(
      traffic({ cls: CatchClass.HidIn, clk: ClockDomain.Host, bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) }),
    );
    expect(log()).toContain('hid-in in 0x0 [01 02 03 04 05 06 07 08 09 0a]');
  });

  it('offers the class in the table builder, with what its id means', async () => {
    const { container, getByText, findByText } = render(() => <DeviceEventCatch />);
    fireEvent.click(radio(container, 'Custom table'));
    await settle();
    fireEvent.click(container.querySelector('.dd-b') as HTMLElement);
    await settle();
    const option = [...document.querySelectorAll('[role="option"]')].find(
      (o) => o.textContent?.trim() === 'clip-transfer (11)',
    );
    expect(option).toBeTruthy();
    fireEvent.click(option!);
    await findByText('The id is endpoint number (0 is EP0).');
    fireEvent.click(getByText('Add entry'));
    await settle();
    expect(getByText('clip-transfer any first 16B')).toBeTruthy();
  });
});

describe('DeviceEventCatch event log', () => {
  // A drawn line keeps its text, so a baseline that moved under it would leave the log mixing two.
  const times = (container: HTMLElement) => lines(container).map((l) => l[1]);

  it('times each line from the earliest stamp on its clock, and draws the log again when an earlier one arrives', async () => {
    const { container } = await watching();
    await show(traffic({ tsUs: 5000 }), traffic({ tsUs: 6500, clk: ClockDomain.Host }));
    await show(traffic({ tsUs: 7250 }));
    expect(times(container)).toEqual(['D+0.000ms', 'H+0.000ms', 'D+2.250ms']);
    // The box drains its queues out of tap order, so a stamp before the first can arrive after it.
    await show(traffic({ tsUs: 4000 }));
    expect(times(container)).toEqual(['D+1.000ms', 'H+0.000ms', 'D+3.250ms', 'D+0.000ms']);
  });

  it('keeps the baseline when the oldest lines leave the log', async () => {
    const { container } = await watching();
    await show(...Array.from({ length: 200 }, (_, i) => traffic({ tsUs: 1000 + i * 1000 })));
    await show(traffic({ tsUs: 201_000 }));
    expect(lines(container)).toHaveLength(200);
    expect(times(container)[0]).toBe('D+1.000ms');
    expect(times(container).at(-1)).toBe('D+200.000ms');
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

describe('DeviceEventCatch whole-number fields', () => {
  const builder = async () => {
    const view = render(() => <DeviceEventCatch />);
    fireEvent.click(radio(view.container, 'Custom table'));
    await settle();
    fireEvent.click(radio(view.container, 'One id'));
    await settle();
    return view;
  };

  it.each([
    ['Id', '0x3'],
    ['Bytes (0 = all)', 'first 3B'],
  ])('keeps %s to a whole number, and the entry carries what it shows', async (field, shown) => {
    const { container, getByText } = await builder();
    const el = numberField(container, field);
    await typeFraction(el);
    expect(el.value).toBe('3');
    fireEvent.click(getByText('Add entry'));
    await settle();
    const chips = [...container.querySelectorAll('.chip__label')].map((c) => c.textContent ?? '');
    expect(chips.some((c) => c.includes(shown))).toBe(true);
  });
});

describe('DeviceEventCatch refused', () => {
  it('a refused subscription says so and goes back to Watch, not to a log waiting on nothing', async () => {
    mock.refuse = true;
    const { container, getByRole } = await watching();
    await waitFor(() => expect(getByRole('alert').textContent).toBe('The box refused that.'));
    expect(button(container, 'Watch')).toBeTruthy();
  });
});

describe('DeviceEventCatch refused part-way', () => {
  it('drops the entries the box took before it refused one', async () => {
    mock.refuseAfter = 2;
    const { getByRole } = await watching('All input');
    await waitFor(() => expect(getByRole('alert').textContent).toBe('The box refused that.'));
    // One clear before subscribing, one after the refusal.
    expect(mock.uncatches).toBe(2);
    expect(mock.caught).toEqual([]);
  });
});

describe('DeviceEventCatch entries left out', () => {
  it('names one unknown address in the singular and several in the plural', async () => {
    mock.unknown = true;
    const one = await watching('Buttons');
    await waitFor(() => expect(one.container.textContent).toMatch(/refused 1 of 1 entry: .*doesn't know that address\./));
    cleanup();
    const many = await watching('All input');
    await waitFor(() => expect(many.container.textContent).toMatch(/refused 4 of 4 entries: .*doesn't know those addresses\./));
  });
});
