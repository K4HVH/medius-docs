import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import {
  type CatchFilter,
  type TrafficEvent,
  CatchClass,
  ClockDomain,
  Direction,
} from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

const mock = vi.hoisted(() => ({
  setEvents: (_v: unknown[]) => {},
  caught: [] as unknown[],
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  const { createSignal } = await import('solid-js');
  const [events, setEvents] = createSignal<unknown[]>([]);
  mock.setEvents = setEvents;
  const state = () => ({
    tableFull: false,
    dropped: 0,
    clock: { offsetUs: 0, ratePpb: 0, delayUs: 0, ageMs: null },
    entries: mock.caught.map((f) => ({ ...(f as object), dropped: 0 })),
  });
  const link = {
    uncatch: async () => {},
    catch: async (f: unknown) => {
      mock.caught.push(f);
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
      inputEvents: events,
      clearInputEvents: () => {},
    }),
  };
});

import DeviceEventCatch from '../../src/app/pages/dashboard/DeviceEventCatch';

afterEach(() => {
  cleanup();
  mock.caught = [];
  mock.setEvents([]);
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

const radio = (container: HTMLElement, name: string): HTMLInputElement => {
  const el = [...container.querySelectorAll('input[type=radio]')].find(
    (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === name,
  );
  if (!el) throw new Error(`no radio labelled ${name}`);
  return el as HTMLInputElement;
};

// The log only renders while a subscription is live, so every case starts one.
const watching = async (preset = 'Raw endpoints') => {
  const view = render(() => <DeviceEventCatch />);
  fireEvent.click(radio(view.container, preset));
  fireEvent.click(view.getByText('Watch'));
  await settle();
  return { ...view, log: () => view.container.querySelector('pre.diagram')?.textContent ?? '' };
};

const show = async (...evs: TrafficEvent[]) => {
  mock.setEvents(evs.map((traffic, i) => ({ seq: i, ev: { kind: 'traffic', traffic } })));
  await settle();
};

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
    const { log } = await watching();
    const out = { dir: Direction.Negative, bytes: new Uint8Array([0x21, 0x09, 0x00, 0x03, 0x00, 0x00, 0x02, 0x00]) };
    await show(
      traffic({ ...out, flags: 0xfd }),
      traffic({ ...out, flags: 0xfe }),
      traffic({ ...out, flags: 0xff }),
      traffic({ ...out, flags: 0xfc }),
    );
    // Newest first. An OUT transfer's event carries the setup packet alone, so one group of bytes.
    const bodies = log().split('\n').map((line) => line.replace(/^#\d+ D\+[\d.]+ms {2}/, ''));
    expect(bodies).toEqual([
      'clip-transfer out 0x0 REFUSED [21 09 00 03 00 00 02 00]',
      'clip-transfer out 0x0 NO DEVICE [21 09 00 03 00 00 02 00]',
      'clip-transfer out 0x0 NAK [21 09 00 03 00 00 02 00]',
      'clip-transfer out 0x0 STALL [21 09 00 03 00 00 02 00]',
    ]);
  });

  it('splits a control transaction the same way, and names the handshake the game PC got', async () => {
    const { log } = await watching();
    const setup = [0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00];
    await show(
      traffic({ cls: CatchClass.Control, flags: 0x01, bytes: new Uint8Array(setup) }),
      traffic({ cls: CatchClass.Control, flags: 0x02, bytes: new Uint8Array(setup) }),
      traffic({ cls: CatchClass.Control, flags: 0x00, bytes: new Uint8Array([...setup, 0x12, 0x01]) }),
    );
    const bodies = log().split('\n').map((line) => line.replace(/^#\d+ D\+[\d.]+ms {2}/, ''));
    expect(bodies).toEqual([
      'control in 0x0 [80 06 00 01 00 00 12 00] [12 01]',
      'control in 0x0 NAK [80 06 00 01 00 00 12 00]',
      'control in 0x0 STALL [80 06 00 01 00 00 12 00]',
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
    const box = container.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: 'Enter' });
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
