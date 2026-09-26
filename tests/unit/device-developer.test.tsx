import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import {
  type RewriteRule,
  CATCH_ID_ANY,
  CatchClass,
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
  raws: [] as unknown[][],
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
    raw: async (...args: unknown[]) => {
      mock.raws.push(args);
    },
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
import { trafficIdLabel } from '../../src/app/pages/dashboard/hex';

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
  mock.raws = [];
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

  const patchCard = (container: HTMLElement) => container.querySelector('#descriptor-patches') as HTMLElement;
  const cardButton = (card: HTMLElement, name: string) =>
    [...card.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement;
  const withPatches = (patches: Record<string, unknown>) => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen: 0, entries: [] },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [], ...patches },
    };
  };
  const ONE_PATCH = [{ section: PatchSection.Device, cfg: 0, index: 0, offset: 8, len: 2 }];

  it('applies a stored set the clone does not carry yet', async () => {
    withPatches({ pending: true, entries: ONE_PATCH });
    const { container, getByText, queryByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Not applied')).toBeTruthy();
    expect(getByText('Changes not on the clone')).toBeTruthy();
    expect(getByText('Not on the clone yet. Apply to put it on.')).toBeTruthy();
    expect(queryByText('Refused')).toBeNull();
    fireEvent.click(cardButton(patchCard(container), 'Apply'));
    await settle();
    expect(mock.applied).toBe(1);
  });

  // The box ignores an Apply of the set the clone already serves, so the button stands down and says so.
  it('stands Apply down when the clone already carries the stored set', () => {
    withPatches({ applied: true, entries: ONE_PATCH });
    const { container, getByText, queryByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Applied')).toBeTruthy();
    expect(getByText('The clone carries this set.')).toBeTruthy();
    expect(queryByText('Changes not on the clone')).toBeNull();
    const apply = cardButton(patchCard(container), 'Apply');
    expect(apply.disabled).toBe(true);
    expect(apply.title).toBe('The clone already carries this set.');
  });

  it('says an applied set edited since is not what the clone carries', () => {
    withPatches({ applied: true, pending: true, entries: ONE_PATCH });
    const { container, getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Applied')).toBeTruthy();
    expect(getByText('Changes not on the clone')).toBeTruthy();
    expect(getByText('The clone carries an earlier version of this set. Apply to update it.')).toBeTruthy();
    expect(cardButton(patchCard(container), 'Apply').disabled).toBe(false);
  });

  // An emptied set still on the clone: Apply presents it unpatched, and Clear all does too.
  it('offers Apply and Clear all for a set emptied while the clone carries it', () => {
    withPatches({ applied: true, pending: true });
    const { container, getByText } = render(() => <DeviceDeveloper />);
    const card = patchCard(container);
    expect(cardButton(card, 'Clear all').disabled).toBe(false);
    expect(cardButton(card, 'Apply').disabled).toBe(false);
    expect(getByText('The clone still carries the removed patches. Apply or Clear all takes them off.')).toBeTruthy();
    expect(getByText('Nothing stored.')).toBeTruthy();
  });

  it('shows a refused set as refused, with the way on, and stands Apply down', () => {
    withPatches({ pending: true, refused: true, entries: ONE_PATCH });
    const { container, getByText, queryByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Refused')).toBeTruthy();
    expect(getByText(/This set failed a check, so the clone runs without it/)).toBeTruthy();
    expect(queryByText('Changes not on the clone')).toBeNull();
    expect(queryByText(/Apply to put it on/)).toBeNull();
    const card = patchCard(container);
    expect(cardButton(card, 'Apply').title).toBe('This set failed a check. Change it, then apply.');
    expect(cardButton(card, 'Apply').disabled).toBe(true);
    expect(cardButton(card, 'Clear all').disabled).toBe(false);
  });

  it('has nothing to apply or clear with nothing stored or carried', () => {
    withPatches({});
    const { container, getByText } = render(() => <DeviceDeveloper />);
    const card = patchCard(container);
    expect(getByText('Nothing patched.')).toBeTruthy();
    expect(cardButton(card, 'Apply').title).toBe('Nothing stored to apply.');
    expect(cardButton(card, 'Clear all').disabled).toBe(true);
  });

  it('says what Apply and Clear all cost, with no reboot', () => {
    on();
    const { container } = render(() => <DeviceDeveloper />);
    const text = patchCard(container).textContent ?? '';
    expect(text).toContain('Apply re-clones the device with the stored set.');
    expect(text).toContain('A re-clone is a replug on the game PC');
    expect(text).not.toMatch(/reboot/i);
  });

  it('reads a full flag on either table as the last add refused for room', () => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: true, gen: 0, entries: [] },
      patches: { applied: false, pending: false, refused: false, tableFull: true, entries: [] },
    };
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText(/The box refused the last rule: it holds 32 rules and 2048 bytes of/)).toBeTruthy();
    expect(getByText(/The box refused the last patch: it holds 16 patches and 1024 bytes of patch/)).toBeTruthy();
  });

  it('says nothing about room while neither table refused an add', () => {
    on();
    const { queryByText } = render(() => <DeviceDeveloper />);
    expect(queryByText(/The box refused the last/)).toBeNull();
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
    await findByText('Class and vendor requests on EP0, and every request on higher control endpoints.');
    expect(queryByText('Reports from the game PC to the device, by endpoint.')).toBeNull();

    fireEvent.click(radio(container, 'HID out'));
    await findByText('Reports from the game PC to the device, by endpoint.');
    expect(queryByText('Class and vendor requests on EP0, and every request on higher control endpoints.')).toBeNull();
  });

  // A motion rewrite on HID in is lost on any report the box changes, so the rewrite card says where
  // motion is rewritten. The clip card shares the class blurb and does not carry that sentence.
  it('tells the rewrite card where mouse motion is rewritten, on HID in only', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    const card = container.querySelector('#rewrite-rules') as HTMLElement;
    fireEvent.click(radio(card, 'HID in'));
    await findByText(/before the box changes them\. Rewrite mouse motion at Emit/);
    fireEvent.click(radio(card, 'Emit'));
    await findByText('What the clone sends the game PC, injection included.');
    expect(queryByText(/Rewrite mouse motion at Emit/)).toBeNull();
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
      if (!queryByText("Overwrites the start of an Out request's data, keeping the length.")) {
        throw new Error('blurb did not follow');
      }
    });
    expect(queryByText('Leaves the packet untouched.')).toBeNull();
  });

  // On Control, Replace reaches only an Out request's data; on a report class the packet becomes the
  // payload. Same action, so the class alone has to swap the sentence.
  it('blurbs Replace by the class it acts on', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    const card = container.querySelector('#rewrite-rules') as HTMLElement;
    const box = card.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: 'Enter' });
    await settle();
    fireEvent.click([...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.trim() === 'Replace')!);
    await findByText("Overwrites the start of an Out request's data, keeping the length.");
    expect(queryByText('The packet becomes the payload.')).toBeNull();

    fireEvent.click(radio(card, 'HID out'));
    await findByText('The packet becomes the payload.');
    expect(queryByText(/an Out request's data/)).toBeNull();
  });

  it('blurbs what the patch offset counts from, per descriptor', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Offset into the 18-byte device descriptor.');

    fireEvent.click(radio(container, 'String descriptor'));
    await findByText(/replace the whole string/);
    expect(queryByText('Offset into the 18-byte device descriptor.')).toBeNull();
  });

  // A string patch replaces the whole string, so the card has no offset to offer for it and sends 0
  // whatever the field held before.
  it('drops the offset for a string patch and sends it as 0', async () => {
    on();
    const { container } = render(() => <DeviceDeveloper />);
    const card = container.querySelector('#descriptor-patches') as HTMLElement;
    const offset = () =>
      [...card.querySelectorAll('label.number-input__label')].find((l) => l.textContent?.trim() === 'Offset');
    const off = offset()!.parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.input(off, { target: { value: '7' } });
    fireEvent.blur(off);
    await settle();
    fireEvent.click(radio(card, 'String descriptor'));
    await settle();
    expect(offset()).toBeUndefined();
    const bytes = [...card.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Bytes (hex)');
    fireEvent.input(bytes!.parentElement!.querySelector('input')!, { target: { value: '41 42' } });
    fireEvent.click([...card.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Set patch')!);
    await settle();
    expect(mock.patches).toEqual([{ section: PatchSection.String, cfg: 0, index: 0, offset: 0, len: 2 }]);
  });

  // Scoped: the rewrite card carries an In/Out direction of its own.
  it('blurbs where a raw report lands, per direction', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Reaches the game PC.');

    fireEvent.click(radio(container.querySelector('#raw-report') as HTMLElement, 'Out'));
    await findByText('Reaches the device.');
    expect(queryByText('Reaches the game PC.')).toBeNull();
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
    await findByText('Unused: this request reads.');

    const field = [...container.querySelectorAll('input')].find(
      (i) => (i as HTMLInputElement).value === '0x80',
    ) as HTMLInputElement;
    fireEvent.input(field, { target: { value: '0x21' } });
    await findByText('Host to device, class, to an interface.');
    await findByText('Data stage sent to the device.');
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

  // No answer covers more than a silent device, and the card says which cases.
  it('says what a transfer with no answer can mean', async () => {
    on();
    mock.transferReply = { ep: 0, status: TransferStatus.Nak, data: new Uint8Array() };
    const { getByText, findByText, queryByText } = render(() => <DeviceDeveloper />);
    fireEvent.click(getByText('Run'));
    await findByText('No answer');
    expect(getByText(/no control endpoint with that number/)).toBeTruthy();
    expect(getByText(/host chip did not answer within 0\.8 s/)).toBeTruthy();
    expect(queryByText('NAK')).toBeNull();
  });
});

// Which actions a class offers, what each one carries, and what the editor refuses.
describe('DeviceRewrite actions and payloads', () => {
  const radio = (container: HTMLElement, name: string): HTMLInputElement => {
    const el = [...container.querySelectorAll('input[type=radio]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === name,
    );
    if (!el) throw new Error(`no radio labelled ${name}`);
    return el as HTMLInputElement;
  };
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

  it('offers the control actions on Control and the report actions on a report class', async () => {
    const { card } = await mount();
    expect((await actionOptions(card)).map((o) => o.textContent?.trim())).toEqual([
      'Pass', 'Patch', 'Replace', 'Answer', 'Stall', 'NAK', 'Reply patch', 'Reply replace',
    ]);
    fireEvent.keyDown(card.querySelector('[role="combobox"]') as HTMLElement, { key: 'Escape' });
    fireEvent.click(radio(card, 'HID in'));
    await settle();
    expect((await actionOptions(card)).map((o) => o.textContent?.trim())).toEqual([
      'Pass', 'Drop', 'Patch', 'Replace',
    ]);
  });

  it('shows the hex payload for the actions that carry bytes, and only for them', async () => {
    const { card } = await mount();
    expect(field(card, 'Payload (hex)')).toBeUndefined();
    await pickAction(card, 'Replace');
    expect(field(card, 'Payload (hex)')).toBeTruthy();
    expect(field(card, 'Offset')).toBeUndefined();
    await pickAction(card, 'Patch');
    expect(field(card, 'Offset')).toBeTruthy();
    // Every rule is an address, an action and bytes: the card has no checkbox and no verb picker.
    expect(card.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
    expect(card.querySelectorAll('input[name="rw-verb"]')).toHaveLength(0);
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

  it('refuses a match that is not hex, or unlike its mask in length', async () => {
    const { card, getByText, findByText } = await mount();
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: '0g' } });
    fireEvent.click(getByText('Add rule'));
    await findByText('Match and mask must be hex.');
    fireEvent.input(field(card, 'Match (hex)')!, { target: { value: '21 09' } });
    fireEvent.input(field(card, 'Mask (hex)')!, { target: { value: 'ff' } });
    fireEvent.click(getByText('Add rule'));
    await findByText('Match and mask must be the same length.');
    expect(mock.rewrites).toEqual([]);
  });

  it('sends no bytes left over in a field its action does not show', async () => {
    const { card, getByText } = await mount();
    await pickAction(card, 'Patch');
    fireEvent.input(field(card, 'Payload (hex)')!, { target: { value: 'aa bb' } });
    fireEvent.input(field(card, 'Offset')!, { target: { value: '4' } });
    fireEvent.blur(field(card, 'Offset')!);
    await settle();
    await pickAction(card, 'Stall');
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(sentRule().action).toBe(RewriteAction.Stall);
    expect(sentRule().off).toBe(0);
    expect(Array.from(sentRule().payload)).toEqual([]);
  });

  it('removes a rule by the key it reads back in full', async () => {
    const at = { cls: CatchClass.HidIn, id: 2, dir: Direction.Positive, action: RewriteAction.Drop, mlen: 2, off: 0, plen: 0, hits: 0 };
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen: 1, entries: [at] },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    mock.entries[0] = {
      cls: CatchClass.HidIn,
      id: 2,
      dir: Direction.Positive,
      action: RewriteAction.Drop,
      off: 0,
      match: new Uint8Array([0x01, 0x10]),
      mask: new Uint8Array([0xff, 0xff]),
      payload: new Uint8Array(0),
    };
    const { container } = render(() => <DeviceDeveloper />);
    const card = container.querySelector('#rewrite-rules') as HTMLElement;
    // Listing a rule reads nothing in full; removing it does, since the key carries the match.
    await settle();
    expect(mock.entryReads).toEqual([]);
    fireEvent.click(card.querySelector('.chip__remove') as HTMLElement);
    await settle();
    expect(mock.entryReads).toEqual([0]);
    expect(sentRule().state).toBe(0);
    expect(Array.from(sentRule().match)).toEqual([0x01, 0x10]);
  });
});

describe('traffic address labels', () => {
  it('names the id each class is addressed by', () => {
    expect(
      [
        CatchClass.HidIn,
        CatchClass.HidOut,
        CatchClass.VendorInterrupt,
        CatchClass.VendorBulk,
        CatchClass.Control,
        CatchClass.Emit,
      ].map(trafficIdLabel),
    ).toEqual([
      'Interface',
      'Endpoint',
      'Endpoint',
      'Endpoint',
      'Endpoint (0 is EP0)',
      'Endpoint',
    ]);
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

describe('whole-number fields on the advanced control cards', () => {
  const pick = (root: ParentNode, name: string) => {
    const el = [...root.querySelectorAll('input[type=radio]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === name,
    );
    if (!el) throw new Error(`no radio labelled ${name}`);
    fireEvent.click(el);
  };
  const text = (root: ParentNode, label: string, value: string) => {
    const l = [...root.querySelectorAll('label')].find((e) => e.textContent?.trim() === label);
    const el = l?.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.input(el, { target: { value } });
  };
  const button = (root: ParentNode, name: string) =>
    [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLElement;
  const card = (id: string) => {
    on();
    const view = render(() => <DeviceDeveloper />);
    return view.container.querySelector(`#${id}`) as HTMLElement;
  };

  it('keeps the raw report endpoint to a whole number, and sends what it shows', async () => {
    const root = card('raw-report');
    const el = numberField(root, 'Endpoint');
    await typeFraction(el);
    expect(el.value).toBe('3');
    text(root, 'Bytes (hex)', '01');
    fireEvent.click(button(root, 'Send'));
    await settle();
    expect(mock.raws.map((r) => r[0])).toEqual([3]);
  });

  it('keeps the control transfer endpoint to a whole number, and sends what it shows', async () => {
    const root = card('control-transfer');
    const el = numberField(root, 'Endpoint');
    await typeFraction(el);
    expect(el.value).toBe('3');
    fireEvent.click(button(root, 'Run'));
    await settle();
    expect(mock.transfers.map((t) => t[0])).toEqual([3]);
  });

  it.each([
    ['Configuration index', 'cfg'],
    ['Interface', 'index'],
    ['Offset', 'offset'],
  ] as const)('keeps the patch %s to a whole number, and sends what it shows', async (field, key) => {
    const root = card('descriptor-patches');
    pick(root, 'Report descriptor');
    await settle();
    const el = numberField(root, field);
    await typeFraction(el);
    expect(el.value).toBe('3');
    text(root, 'Bytes (hex)', '04');
    fireEvent.click(button(root, 'Set patch'));
    await settle();
    expect(mock.patches.map((p) => p[key])).toEqual([3]);
  });

  it('keeps the rewrite id to a whole number, and sends what it shows', async () => {
    const root = card('rewrite-rules');
    const el = numberField(root, 'Endpoint (0 is EP0)');
    await typeFraction(el);
    expect(el.value).toBe('3');
    fireEvent.click(button(root, 'Add rule'));
    await settle();
    expect(mock.rewrites.map((r) => r.id)).toEqual([3]);
  });

  it('keeps the rewrite offset to a whole number, and sends what it shows', async () => {
    const root = card('rewrite-rules');
    const box = root.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: 'Enter' });
    await settle();
    fireEvent.click([...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.trim() === 'Patch')!);
    await settle();
    const el = numberField(root, 'Offset');
    await typeFraction(el);
    expect(el.value).toBe('3');
    text(root, 'Payload (hex)', 'aa');
    fireEvent.click(button(root, 'Add rule'));
    await settle();
    expect(mock.rewrites.map((r) => (r as unknown as { off: number }).off)).toEqual([3]);
  });
});
