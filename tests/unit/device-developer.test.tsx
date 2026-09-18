import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import {
  type RewriteRule,
  CATCH_ID_ANY,
  CatchClass,
  ClipOp,
  Direction,
  PatchSection,
  RewriteAction,
  TransferStatus,
} from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

// One recording fake for the whole page: the link calls it records, and the poll values it reads.
const mock = vi.hoisted(() => ({
  rewrites: [] as { cls: number; id: number; dir: number; action: number; state: number }[],
  // What RESP(REWRITE_ENTRY) answers for each list index, and which indices were asked for.
  entries: {} as Record<number, unknown>,
  entryReads: [] as number[],
  patches: [] as { section: number; cfg: number; index: number; offset: number; len: number }[],
  transfers: [] as number[][],
  applied: 0,
  cleared: 0,
  transferReply: { ep: 0, status: 0, data: new Uint8Array() },
  poll: {} as Record<string, unknown>,
  // Tells the card the polled values moved, as a fresh poll reply would.
  polled: () => {},
}));

vi.mock('@solidjs/router', () => ({
  A: (p: { children: unknown }) => p.children,
  useNavigate: () => () => {},
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  const { createSignal } = await import('solid-js');
  const [polls, setPolls] = createSignal(0);
  mock.polled = () => setPolls((n) => n + 1);
  const link = {
    setRewrite: async (r: { cls: number; id: number; dir: number; action: number }) => {
      mock.rewrites.push({ ...r, state: 1 });
    },
    removeRewrite: async (r: { cls: number; id: number; dir: number; action: number }) => {
      mock.rewrites.push({ ...r, state: 0 });
    },
    clearRewrite: async () => {
      mock.cleared++;
    },
    setPatch: async (section: number, cfg: number, index: number, offset: number, bytes: Uint8Array) => {
      mock.patches.push({ section, cfg, index, offset, len: bytes.length });
    },
    removePatch: async () => {},
    applyPatch: async () => {
      mock.applied++;
    },
    clearPatch: async () => {},
    raw: async () => {},
    transfer: async (
      ep: number,
      bmRequestType: number,
      bRequest: number,
      wValue: number,
      wIndex: number,
      wLength: number,
    ) => {
      mock.transfers.push([ep, bmRequestType, bRequest, wValue, wIndex, wLength]);
      return mock.transferReply;
    },
    queryRewriteEntry: async (index: number) => {
      mock.entryReads.push(index);
      return mock.entries[index] ?? {};
    },
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      updateOnly: () => false,
      link: () => link,
      poll: (key: string) => () => {
        polls();
        return mock.poll[key];
      },
      refreshPoll: () => {},
    }),
  };
});

import DeviceDeveloper from '../../src/app/pages/dashboard/DeviceDeveloper';

const on = () => {
  mock.poll = {
    imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
    rewrite: { tableFull: false, gen: 0, entries: [] },
    patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
  };
};

afterEach(() => {
  cleanup();
  mock.rewrites = [];
  mock.entries = {};
  mock.entryReads = [];
  mock.patches = [];
  mock.transfers = [];
  mock.applied = 0;
  mock.cleared = 0;
  mock.transferReply = { ep: 0, status: 0, data: new Uint8Array() };
  mock.poll = {};
});

describe('DeviceDeveloper', () => {
  it('renders every card of the advanced control layer', () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Rewrite rules')).toBeTruthy();
    expect(getByText('Descriptor patches')).toBeTruthy();
    expect(getByText('Raw report')).toBeTruthy();
    expect(getByText('Control transfer')).toBeTruthy();
  });

  // The box drops a rule and a raw report that arrive with the opt-in off, so those two cards stand
  // their controls down entirely. A patch is stored either way, so only its apply is withheld.
  it('stands the gated controls down while imperfect clones are off', () => {
    mock.poll = {
      imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen: 0, entries: [] },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    const { getByText, container } = render(() => <DeviceDeveloper />);
    expect(getByText(/Rewrite rules need/)).toBeTruthy();
    expect(getByText(/Raw reports need/)).toBeTruthy();
    expect(getByText(/Control transfers need/)).toBeTruthy();
    const button = (name: string) =>
      [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
    expect(button('Add rule')).toBeUndefined();
    expect(button('Send')).toBeUndefined();
    expect(button('Set patch')).toBeTruthy();
    expect((button('Apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers the gated controls once imperfect clones are on', () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Add rule')).toBeTruthy();
    expect(getByText('Send')).toBeTruthy();
  });

  it('adds a rewrite rule from the form defaults (a control-class pass)', async () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(mock.rewrites).toHaveLength(1);
    expect(mock.rewrites[0]).toMatchObject({
      cls: CatchClass.Control,
      id: 0,
      dir: Direction.Both,
      action: RewriteAction.Pass,
      state: 1,
    });
  });

  // The box ranks id == CATCH_ID_ANY as a class blanket, which the bare number field cannot reach.
  it('sends the class blanket when the id is every id', async () => {
    on();
    const { getByText, container } = render(() => <DeviceDeveloper />);
    const every = [...container.querySelectorAll('input[type=radio]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === 'Every id',
    );
    fireEvent.click(every!);
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(mock.rewrites[0]).toMatchObject({ cls: CatchClass.Control, id: CATCH_ID_ANY, state: 1 });
  });

  // Scoped to the card: the patch card carries a Clear all of its own, and an empty table stands
  // this one down.
  it('clears the whole rewrite table', async () => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: {
        tableFull: false,
        gen: 0,
        entries: [
          { cls: CatchClass.Control, id: 0, dir: Direction.Both, action: RewriteAction.Pass, mlen: 0, off: 0, plen: 0, hits: 0 },
        ],
      },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    const { container } = render(() => <DeviceDeveloper />);
    const card = container.querySelector('#rewrite-rules')!;
    const clear = [...card.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Clear all');
    fireEvent.click(clear!);
    await settle();
    expect(mock.cleared).toBe(1);
  });

  it('describes each live rewrite rule by what it does', () => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: {
        tableFull: false,
        gen: 4,
        entries: [
          { cls: CatchClass.Control, id: 0, dir: Direction.Both, action: RewriteAction.Patch, mlen: 2, off: 2, plen: 1, hits: 9 },
        ],
      },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Patch control 0 both, 9 hits')).toBeTruthy();
  });

  it('applies the stored patch set and renders its flags', async () => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen: 0, entries: [] },
      patches: {
        applied: true,
        pending: false,
        refused: false,
        tableFull: false,
        entries: [{ section: PatchSection.Device, cfg: 0, index: 0, offset: 8, len: 2 }],
      },
    };
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Applied')).toBeTruthy();
    fireEvent.click(getByText('Apply'));
    await settle();
    expect(mock.applied).toBe(1);
  });

  // The helper copy on every sibling card is a function of the live selection, not a fixed string.
  // These pin that: pick another option, get another sentence.
  const radio = (container: HTMLElement, name: string): HTMLInputElement => {
    const el = [...container.querySelectorAll('input[type=radio]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === name,
    );
    if (!el) throw new Error(`no radio labelled ${name}`);
    return el as HTMLInputElement;
  };

  it('blurbs the picked rewrite class, not a fixed sentence', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Setup packets on a control endpoint.');
    expect(queryByText('Reports the game PC sends the device, by endpoint.')).toBeNull();

    fireEvent.click(radio(container, 'HID out'));
    await findByText('Reports the game PC sends the device, by endpoint.');
    expect(queryByText('Setup packets on a control endpoint.')).toBeNull();
  });

  it('blurbs the picked rewrite action', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Leaves the packet untouched.');
    expect(queryByText('The packet becomes the payload.')).toBeNull();

    const box = container.querySelectorAll('[role="combobox"]')[0] as HTMLElement;
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 20));
    const replace = [...document.querySelectorAll('[role="option"]')].find(
      (o) => o.textContent?.trim() === 'Replace',
    );
    fireEvent.click(replace!);
    await waitFor(() => {
      if (!queryByText('The packet becomes the payload.')) throw new Error('blurb did not follow');
    });
    expect(queryByText('Leaves the packet untouched.')).toBeNull();
  });

  it('blurbs what the patch offset counts from, per descriptor', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Offset into the 18-byte device descriptor.');

    fireEvent.click(radio(container, 'String descriptor'));
    await findByText('Offset into that string descriptor, its two-byte header included.');
    expect(queryByText('Offset into the 18-byte device descriptor.')).toBeNull();
  });

  // Scoped: the rewrite card carries an In/Out direction of its own.
  it('blurbs where a raw report lands, per direction', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('The report reaches the game PC.');

    fireEvent.click(radio(container.querySelector('#raw-report') as HTMLElement, 'Out'));
    await findByText('The report reaches the device.');
    expect(queryByText('The report reaches the game PC.')).toBeNull();
  });

  // A class request's bRequest is not a standard one, so the standard name must not be claimed for it.
  it('names a standard request only when the type is standard', async () => {
    on();
    const { container, findByText, queryByText } = render(() => <DeviceDeveloper />);
    await findByText('Device to host, standard, to the device: GET_DESCRIPTOR.');
    const bm = [...container.querySelectorAll('input')].find(
      (i) => (i as HTMLInputElement).value === '0x80',
    ) as HTMLInputElement;
    fireEvent.input(bm, { target: { value: '0xa1' } });
    await findByText('Device to host, class, to an interface.');
    expect(queryByText(/GET_DESCRIPTOR/)).toBeNull();
  });

  it('reads the setup packet back in words as bmRequestType changes', async () => {
    on();
    const { container, findByText, queryByText } = render(() => <DeviceDeveloper />);
    await findByText('Device to host, standard, to the device: GET_DESCRIPTOR.');
    await findByText('Unused: this request reads, it does not write.');

    const field = [...container.querySelectorAll('input')].find(
      (i) => (i as HTMLInputElement).value === '0x80',
    ) as HTMLInputElement;
    fireEvent.input(field, { target: { value: '0x21' } });
    await findByText('Host to device, class, to an interface.');
    await findByText('The data stage this request carries to the device.');
    expect(queryByText('Device to host, standard, to the device: GET_DESCRIPTOR.')).toBeNull();
  });

  it('runs a control transfer and shows the device answer', async () => {
    on();
    mock.transferReply = { ep: 0, status: TransferStatus.Ok, data: new Uint8Array([0x12, 0x01]) };
    const { getByText } = render(() => <DeviceDeveloper />);
    fireEvent.click(getByText('Run'));
    await settle();
    // The default setup is GET_DESCRIPTOR for the 18-byte device descriptor.
    expect(mock.transfers[0]).toEqual([0, 0x80, 6, 0x0100, 0, 18]);
    expect(getByText('OK')).toBeTruthy();
    expect(getByText('2 B in')).toBeTruthy();
  });
});

// The Clip action's payload is a verb and two flags, not bytes, so it has an editor of its own.
describe('DeviceRewrite clip rules', () => {
  const radio = (container: HTMLElement, name: string): HTMLInputElement => {
    const el = [...container.querySelectorAll('input[type=radio]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === name,
    );
    if (!el) throw new Error(`no radio labelled ${name}`);
    return el as HTMLInputElement;
  };
  const checkbox = (container: HTMLElement, name: string): HTMLInputElement | undefined =>
    [...container.querySelectorAll('input[type=checkbox]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === name,
    ) as HTMLInputElement | undefined;
  const field = (container: HTMLElement, name: string): HTMLInputElement | undefined => {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === name);
    return (label?.parentElement?.querySelector('input') ?? undefined) as HTMLInputElement | undefined;
  };

  const actionOptions = async (card: HTMLElement): Promise<Element[]> => {
    const box = card.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: 'Enter' });
    await settle();
    return [...document.querySelectorAll('[role="option"]')];
  };
  const pickAction = async (card: HTMLElement, name: string) => {
    const option = (await actionOptions(card)).find((o) => o.textContent?.trim() === name);
    if (!option) throw new Error(`no action named ${name}`);
    fireEvent.click(option);
    await settle();
  };

  const mount = async () => {
    on();
    const view = render(() => <DeviceDeveloper />);
    const card = view.container.querySelector('#rewrite-rules') as HTMLElement;
    return { ...view, card };
  };
  const sentRule = () => mock.rewrites[0] as unknown as RewriteRule & { state: number };

  it('offers Clip on the control class and on a report class', async () => {
    const { card } = await mount();
    expect((await actionOptions(card)).map((o) => o.textContent?.trim())).toContain('Clip');
    fireEvent.keyDown(card.querySelector('[role="combobox"]') as HTMLElement, { key: 'Escape' });
    fireEvent.click(radio(card, 'HID in'));
    await settle();
    expect((await actionOptions(card)).map((o) => o.textContent?.trim())).toContain('Clip');
  });

  it('shows a verb and two flags for Clip, and no hex payload', async () => {
    const { card, findByText } = await mount();
    fireEvent.click(radio(card, 'HID in'));
    await pickAction(card, 'Clip');
    await findByText('Runs a clip verb.');
    for (const verb of ['Start', 'Stop', 'Pause', 'Resume', 'Restart', 'Toggle']) {
      expect(radio(card, verb)).toBeTruthy();
    }
    expect(checkbox(card, 'Drop the packet')).toBeTruthy();
    expect(checkbox(card, 'On edge')).toBeTruthy();
    expect(field(card, 'Payload (hex)')).toBeUndefined();
    expect(field(card, 'Offset')).toBeUndefined();
    // The selector belongs to On edge, so it arrives with it.
    expect(field(card, 'Selector length')).toBeUndefined();
    fireEvent.click(checkbox(card, 'On edge')!);
    await settle();
    expect(field(card, 'Selector length')).toBeTruthy();
  });

  it('says when the verb runs and what becomes of the packet, as the flags stand', async () => {
    const { card, queryByText } = await mount();
    const every = 'The verb runs on every packet the rule matches.';
    const first = /^The verb runs on the first of a run of matching packets\./;
    fireEvent.click(radio(card, 'HID in'));
    await pickAction(card, 'Clip');
    await settle();
    expect(queryByText(`${every} A matched packet is left untouched.`)).toBeTruthy();
    fireEvent.click(checkbox(card, 'Drop the packet')!);
    await settle();
    expect(queryByText(`${every} A matched packet is not delivered.`)).toBeTruthy();
    expect(queryByText(`${every} A matched packet is left untouched.`)).toBeNull();
    fireEvent.click(checkbox(card, 'On edge')!);
    await settle();
    expect(queryByText(first)).toBeTruthy();
    expect(queryByText(new RegExp(every))).toBeNull();
    // Control has no Drop, so a tick left over from another class says nothing here.
    fireEvent.click(radio(card, 'Control'));
    await settle();
    expect(queryByText(/A matched packet is not delivered/)).toBeNull();
  });

  it('keeps the hex payload for the actions that carry bytes', async () => {
    const { card } = await mount();
    await pickAction(card, 'Replace');
    expect(field(card, 'Payload (hex)')).toBeTruthy();
    expect(checkbox(card, 'On edge')).toBeUndefined();
  });

  it('offers Drop the packet only where the Drop action is offered', async () => {
    const { card } = await mount();
    await pickAction(card, 'Clip');
    // The form opens on the control class, which has no Drop.
    expect(checkbox(card, 'Drop the packet')).toBeUndefined();
    fireEvent.click(radio(card, 'Emit'));
    await settle();
    expect(checkbox(card, 'Drop the packet')).toBeTruthy();
  });

  it('sends the verb and flags as the rule payload, at offset 0', async () => {
    const { card, getByText } = await mount();
    fireEvent.click(radio(card, 'HID in'));
    fireEvent.click(radio(card, 'In'));
    await pickAction(card, 'Clip');
    fireEvent.click(radio(card, 'Restart'));
    fireEvent.click(checkbox(card, 'Drop the packet')!);
    fireEvent.click(checkbox(card, 'On edge')!);
    await settle();
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: '01 10' } });
    fireEvent.input(field(card, 'Mask (hex)')!, { target: { value: 'ff ff' } });
    fireEvent.input(field(card, 'Selector length')!, { target: { value: '1' } });
    fireEvent.blur(field(card, 'Selector length')!);
    await settle();
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(sentRule()).toMatchObject({
      cls: CatchClass.HidIn,
      id: 0,
      dir: Direction.Positive,
      action: RewriteAction.Clip,
      off: 0,
      state: 1,
    });
    expect(Array.from(sentRule().payload)).toEqual([ClipOp.Restart, 0x03, 1]);
  });

  it('sends no selector once On edge is unticked', async () => {
    const { card, getByText } = await mount();
    fireEvent.click(radio(card, 'HID in'));
    await pickAction(card, 'Clip');
    fireEvent.click(checkbox(card, 'On edge')!);
    await settle();
    fireEvent.input(field(card, 'Selector length')!, { target: { value: '2' } });
    fireEvent.blur(field(card, 'Selector length')!);
    fireEvent.click(checkbox(card, 'On edge')!);
    await settle();
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(Array.from(sentRule().payload)).toEqual([ClipOp.Start, 0x00, 0]);
  });

  it('refuses a match longer than the box compares', async () => {
    const { card, getByText, findByText } = await mount();
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: 'aa'.repeat(17) } });
    fireEvent.input(field(card, 'Mask (hex)')!, { target: { value: 'ff'.repeat(17) } });
    fireEvent.click(getByText('Add rule'));
    await findByText('Match and mask must be at most 16 bytes.');
    expect(mock.rewrites).toEqual([]);
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: 'aa'.repeat(16) } });
    fireEvent.input(field(card, 'Mask (hex)')!, { target: { value: 'ff'.repeat(16) } });
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(mock.rewrites.length).toBe(1);
  });

  it('never sends a drop the class cannot take, even if it was ticked on another class', async () => {
    const { card, getByText } = await mount();
    fireEvent.click(radio(card, 'HID in'));
    await pickAction(card, 'Clip');
    fireEvent.click(checkbox(card, 'Drop the packet')!);
    fireEvent.click(radio(card, 'Control'));
    await settle();
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(sentRule().cls).toBe(CatchClass.Control);
    expect(Array.from(sentRule().payload)).toEqual([ClipOp.Start, 0x00, 0]);
  });

  it('sends no bytes left over in a field its action does not show', async () => {
    const { card, getByText } = await mount();
    await pickAction(card, 'Patch');
    fireEvent.input(field(card, 'Payload (hex)')!, { target: { value: 'aa bb' } });
    fireEvent.input(field(card, 'Offset')!, { target: { value: '4' } });
    fireEvent.blur(field(card, 'Offset')!);
    await settle();
    await pickAction(card, 'Clip');
    fireEvent.click(getByText('Add rule'));
    await settle();
    // The box refuses a clip rule with an offset, and reads a longer payload as no clip rule at all.
    expect(sentRule().off).toBe(0);
    expect(Array.from(sentRule().payload)).toEqual([ClipOp.Start, 0x00, 0]);
  });

  it('refuses On edge without one stream to have a run over', async () => {
    const { card, getByText, findByRole } = await mount();
    const needs = 'On edge needs a class other than Control, one id, and In or Out.';
    await pickAction(card, 'Clip');
    fireEvent.click(checkbox(card, 'On edge')!);
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: '01 10' } });
    fireEvent.input(field(card, 'Mask (hex)')!, { target: { value: 'ff ff' } });

    // The control class, with one id and In.
    fireEvent.click(radio(card, 'In'));
    fireEvent.click(getByText('Add rule'));
    expect((await findByRole('alert')).textContent).toBe(needs);

    // A report class, one id, but both directions.
    fireEvent.click(radio(card, 'HID in'));
    fireEvent.click(radio(card, 'Both'));
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe(needs);

    // One direction, but every id.
    fireEvent.click(radio(card, 'Out'));
    fireEvent.click(radio(card, 'Every id'));
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe(needs);
    expect(mock.rewrites).toHaveLength(0);

    // All three, and it goes.
    fireEvent.click(radio(card, 'Just one'));
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(mock.rewrites).toHaveLength(1);
    expect(Array.from(sentRule().payload)).toEqual([ClipOp.Start, 0x02, 0]);
  });

  it('refuses a selector that leaves no match bytes for the condition', async () => {
    const { card, getByText, findByRole } = await mount();
    fireEvent.click(radio(card, 'HID in'));
    fireEvent.click(radio(card, 'In'));
    await pickAction(card, 'Clip');
    fireEvent.click(checkbox(card, 'On edge')!);
    await settle();
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: '01' } });
    fireEvent.input(field(card, 'Mask (hex)')!, { target: { value: 'ff' } });
    fireEvent.input(field(card, 'Selector length')!, { target: { value: '1' } });
    fireEvent.blur(field(card, 'Selector length')!);
    await settle();
    fireEvent.click(getByText('Add rule'));
    expect((await findByRole('alert')).textContent).toBe('The match must be longer than the selector.');
    expect(mock.rewrites).toHaveLength(0);

    // A blank match with On edge is the same refusal: a selector of 0 is not below a length of 0.
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: '' } });
    fireEvent.input(field(card, 'Mask (hex)')!, { target: { value: '' } });
    fireEvent.input(field(card, 'Selector length')!, { target: { value: '0' } });
    fireEvent.blur(field(card, 'Selector length')!);
    await settle();
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect((await findByRole('alert')).textContent).toBe('The match must be longer than the selector.');
    expect(mock.rewrites).toHaveLength(0);
  });

  it('names a clip rule read back from the box by its verb and flags', async () => {
    const summary = (action: RewriteAction, plen: number, hits: number) => ({
      cls: CatchClass.HidIn, id: 2, dir: Direction.Positive, action, mlen: 2, off: 0, plen, hits,
    });
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: {
        tableFull: false,
        gen: 3,
        entries: [summary(RewriteAction.Replace, 4, 0), summary(RewriteAction.Clip, 3, 3)],
      },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    mock.entries[1] = {
      cls: CatchClass.HidIn,
      id: 2,
      dir: Direction.Positive,
      action: RewriteAction.Clip,
      off: 0,
      match: new Uint8Array([0x01, 0x10]),
      mask: new Uint8Array([0xff, 0xff]),
      payload: new Uint8Array([ClipOp.Restart, 0x03, 1]),
    };
    const { findByText, getByText } = render(() => <DeviceDeveloper />);
    await findByText('Clip restart HID in 2 in, drop, on edge, selector 1, 3 hits');
    // Only the clip rule is read in full; the other names itself from the summary.
    expect(mock.entryReads).toEqual([1]);
    expect(getByText('Replace HID in 2 in')).toBeTruthy();
  });

  it('reads a clip rule again when the table generation moves', async () => {
    const at = { cls: CatchClass.HidIn, id: 2, dir: Direction.Positive, action: RewriteAction.Clip, mlen: 0, off: 0, plen: 3, hits: 0 };
    const rule = (op: number) => ({
      cls: CatchClass.HidIn,
      id: 2,
      dir: Direction.Positive,
      action: RewriteAction.Clip,
      off: 0,
      match: new Uint8Array(0),
      mask: new Uint8Array(0),
      payload: new Uint8Array([op, 0, 0]),
    });
    const table = (gen: number) => ({
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen, entries: [at] },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    });
    mock.poll = table(3);
    mock.entries[0] = rule(ClipOp.Restart);
    const { findByText } = render(() => <DeviceDeveloper />);
    await findByText('Clip restart HID in 2 in');
    // The same address at the same index, overwritten with another verb: only the generation says so.
    mock.entries[0] = rule(ClipOp.Stop);
    mock.poll = table(4);
    mock.polled();
    await findByText('Clip stop HID in 2 in');
    expect(mock.entryReads).toEqual([0, 0]);
  });

  it('does not put one rule\'s verb on another that took its place in the list', async () => {
    // The entry at the index answers for a different address than the summary lists there, which is
    // what a table that changed between the two reads looks like.
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: {
        tableFull: false,
        gen: 9,
        entries: [
          { cls: CatchClass.Emit, id: 1, dir: Direction.Positive, action: RewriteAction.Clip, mlen: 0, off: 0, plen: 3, hits: 0 },
        ],
      },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    mock.entries[0] = {
      cls: CatchClass.HidIn,
      id: 2,
      dir: Direction.Positive,
      action: RewriteAction.Clip,
      off: 0,
      match: new Uint8Array(0),
      mask: new Uint8Array(0),
      payload: new Uint8Array([ClipOp.Stop, 0x01, 0]),
    };
    const { findByText, queryByText } = render(() => <DeviceDeveloper />);
    await findByText('Clip emit 1 in');
    await settle();
    expect(mock.entryReads).toEqual([0]);
    expect(queryByText(/Clip stop/)).toBeNull();
  });
});
