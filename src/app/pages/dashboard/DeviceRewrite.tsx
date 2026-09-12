// Rewrite a matched packet in flight: match a class, an id and a direction, and run one action.
//
// The box drops a rule that arrives while imperfect clones are off, so the card stands its whole body
// down rather than disabling each button. Removal keys on the match and mask bytes, which the table
// summary does not carry, so a removed rule is read back in full first.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Combobox } from '../../../components/inputs/Combobox';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import {
  type RewriteRule,
  type RewriteRuleInfo,
  CATCH_ID_ANY,
  CatchClass,
  Direction,
  REWRITE_CLASSES,
  REWRITE_TAB_MAX,
  RewriteAction,
  rewriteActionName,
  rewriteClassName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { chips, label, muted, row, section } from './ui';
import { displayName, parseHex } from './hex';

const CLASS_OPTIONS = REWRITE_CLASSES.map((c) => ({
  value: String(c),
  label: displayName(rewriteClassName(c)),
}));

// What the picked class carries, and what each action does to a packet that matches. Both read out
// under their own control, the way the options card blurbs the render mode it is sitting on.
const CLASS_BLURB: Record<number, string> = {
  [CatchClass.HidIn]: 'Reports the device sends the game PC, by interface.',
  [CatchClass.HidOut]: 'Reports the game PC sends the device, by endpoint.',
  [CatchClass.VendorInterrupt]: 'Interrupt traffic on a vendor interface.',
  [CatchClass.VendorBulk]: 'Bulk traffic on a vendor interface.',
  [CatchClass.Control]: 'Setup packets on a control endpoint.',
  [CatchClass.Emit]: 'What the clone puts on the wire, injection included.',
};

const ACTION_BLURB: Record<number, string> = {
  [RewriteAction.Pass]: 'Leaves the packet untouched.',
  [RewriteAction.Drop]: 'The packet is not delivered.',
  [RewriteAction.Patch]: 'Overwrites the payload bytes at the offset, keeping the length.',
  [RewriteAction.Replace]: 'The packet becomes the payload.',
  [RewriteAction.Answer]: 'Answers from the payload without asking the device.',
  [RewriteAction.Stall]: 'Protocol STALL.',
  [RewriteAction.Nak]: 'No answer, until the host gives up.',
  [RewriteAction.ReplyPatch]: 'Overwrites the reply at the offset, keeping the length.',
  [RewriteAction.ReplyReplace]: 'The reply becomes the payload.',
};

// A report surface can pass, drop, or rewrite a packet; the control class trades Drop for the answer
// and reply actions. The box validates the pair, so this only keeps the menu honest.
const actionsFor = (cls: number): RewriteAction[] =>
  cls === CatchClass.Control
    ? [
        RewriteAction.Pass,
        RewriteAction.Patch,
        RewriteAction.Replace,
        RewriteAction.Answer,
        RewriteAction.Stall,
        RewriteAction.Nak,
        RewriteAction.ReplyPatch,
        RewriteAction.ReplyReplace,
      ]
    : [RewriteAction.Pass, RewriteAction.Drop, RewriteAction.Patch, RewriteAction.Replace];

// Which actions carry a payload, and which read the offset. Pass, Drop, Stall and Nak carry neither.
const carriesPayload = (a: RewriteAction): boolean =>
  a === RewriteAction.Patch ||
  a === RewriteAction.Replace ||
  a === RewriteAction.Answer ||
  a === RewriteAction.ReplyPatch ||
  a === RewriteAction.ReplyReplace;
const readsOffset = (a: RewriteAction): boolean =>
  a === RewriteAction.Patch || a === RewriteAction.ReplyPatch;

// HID_IN addresses an interface; every other class keys on the endpoint number, HID_OUT included.
// The catch card's id table says the same, and the box looks all of them up by EP_NUM.
const idLabel = (cls: number): string => {
  if (cls === CatchClass.HidIn) return 'Interface number';
  return cls === CatchClass.Control ? 'Endpoint number (0 is EP0)' : 'Endpoint number';
};

const dirWord = (d: number): string =>
  d === Direction.Positive ? 'in' : d === Direction.Negative ? 'out' : 'both';

// A rule names itself the way a transform does: what it does, then what it addresses. A chip is
// capped at 250px and ellipsises past it, so the match and payload lengths stay out of the name.
const describe = (e: RewriteRuleInfo): string => {
  const where = e.id === CATCH_ID_ANY ? 'any' : e.id;
  const head = `${displayName(rewriteActionName(e.action))} ${rewriteClassName(e.cls)} ${where} ${dirWord(e.dir)}`;
  return e.hits ? `${head}, ${e.hits} ${e.hits === 1 ? 'hit' : 'hits'}` : head;
};

// Combobox hands back a string or an array, and the action picker is single-select.
const one = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

const DeviceRewrite = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const rewrite = dash.poll('rewrite');
  const allowed = () => imperfect()?.allowed === true;

  const [rwClass, setRwClass] = createSignal(String(CatchClass.Control));
  const [rwAnyId, setRwAnyId] = createSignal('one');
  const [rwId, setRwId] = createSignal(0);
  const [rwDir, setRwDir] = createSignal(String(Direction.Both));
  const [rwAction, setRwAction] = createSignal(String(RewriteAction.Pass));
  const [rwOff, setRwOff] = createSignal(0);
  const [rwMatch, setRwMatch] = createSignal('');
  const [rwMask, setRwMask] = createSignal('');
  const [rwPayload, setRwPayload] = createSignal('');
  const cmd = createCommand(() => dash.refreshPoll('rewrite'));

  const cls = () => Number(rwClass());
  const action = () => Number(rwAction()) as RewriteAction;
  const actionOptions = createMemo(() =>
    actionsFor(cls()).map((a) => ({ value: String(a), label: displayName(rewriteActionName(a)) })),
  );
  const entries = () => rewrite()?.entries ?? ([] as RewriteRuleInfo[]);

  // Picking a class can strand an action the new class does not offer; fall back to Pass, which every
  // class takes, the way the lock editor falls back to Both.
  const chooseClass = (v: string) => {
    setRwClass(v);
    if (!actionsFor(Number(v)).includes(action())) setRwAction(String(RewriteAction.Pass));
  };

  const buildRule = (): RewriteRule | string => {
    const match = parseHex(rwMatch());
    const mask = parseHex(rwMask());
    if (match === null || mask === null) return 'Match and mask must be hex.';
    if (match.length !== mask.length) return 'Match and mask must be the same length.';
    const payload = parseHex(rwPayload());
    if (payload === null) return 'Payload must be hex.';
    return {
      cls: cls(),
      id: rwAnyId() === 'any' ? CATCH_ID_ANY : rwId(),
      dir: Number(rwDir()),
      action: action(),
      off: rwOff(),
      match,
      mask,
      payload,
    };
  };

  const addRule = () => {
    const built = buildRule();
    if (typeof built === 'string') {
      cmd.run(() => Promise.reject(new Error(built)));
      return;
    }
    cmd.run(() => dash.link()!.setRewrite(built));
  };

  const removeAt = (index: number) =>
    cmd.run(async () => {
      const l = dash.link()!;
      await l.removeRewrite(await l.queryRewriteEntry(index));
    });

  const clearAll = () => cmd.run(() => dash.link()!.clearRewrite());

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="rewrite-rules" data-search-target>
        <Card>
          <CardHeader title="Rewrite rules" subtitle="Rewrite a matched packet in flight" />

          <Show
            when={allowed()}
            fallback={
              <p style={muted}>
                Rewrite rules need <A href="/dashboard#imperfect-clone">imperfect clones</A>, on the
                Device tab.
              </p>
            }
          >
            <div style={label}>Class</div>
            <RadioGroup name="rw-class" value={rwClass()} onChange={chooseClass} options={CLASS_OPTIONS} />
            <p style={{ ...muted, 'margin-top': '4px' }}>{CLASS_BLURB[cls()]}</p>

            <div style={section}>
              <div style={label}>Which id</div>
              <RadioGroup
                name="rw-anyid"
                value={rwAnyId()}
                onChange={setRwAnyId}
                options={[
                  { value: 'any', label: 'Every id' },
                  { value: 'one', label: 'Just one' },
                ]}
              />
              <Show when={rwAnyId() === 'one'}>
                <div style={{ ...section, 'max-width': '11rem' }}>
                  <NumberInput
                    label={idLabel(cls())}
                    value={rwId()}
                    min={0}
                    max={65534}
                    onChange={(v) => setRwId(v ?? 0)}
                  />
                </div>
              </Show>
            </div>

            <div style={section}>
              <div style={label}>Direction</div>
              <RadioGroup
                name="rw-dir"
                value={rwDir()}
                onChange={setRwDir}
                options={[
                  { value: String(Direction.Both), label: 'Both' },
                  { value: String(Direction.Positive), label: 'In' },
                  { value: String(Direction.Negative), label: 'Out' },
                ]}
              />
            </div>

            <div style={section}>
              <div style={label}>Action</div>
              <Combobox value={rwAction()} onChange={(v) => setRwAction(one(v))} options={actionOptions()} />
              <p style={{ ...muted, 'margin-top': '4px' }}>{ACTION_BLURB[action()]}</p>
            </div>

            <div style={{ ...section, ...row }}>
              <div style={{ flex: '1 1 140px' }}>
                <TextField label="Match (hex)" value={rwMatch()} onInput={setRwMatch} placeholder="e.g. 21 09" />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <TextField label="Mask (hex)" value={rwMask()} onInput={setRwMask} placeholder="e.g. ff ff" />
              </div>
            </div>
            <p style={{ ...muted, 'margin-top': '4px' }}>
              Match and mask are the same length, 16 bytes at most. Blank matches every packet on that
              address.
            </p>

            <Show when={carriesPayload(action())}>
              <div style={{ ...section, ...row, 'align-items': 'flex-end' }}>
                <Show when={readsOffset(action())}>
                  <div style={{ 'max-width': '8rem' }}>
                    <NumberInput label="Offset" value={rwOff()} min={0} max={65534} onChange={(v) => setRwOff(v ?? 0)} />
                  </div>
                </Show>
                <div style={{ flex: '1 1 220px' }}>
                  <TextField label="Payload (hex)" value={rwPayload()} onInput={setRwPayload} placeholder="e.g. 04 00" />
                </div>
              </div>
            </Show>

            <div style={{ ...section, ...row }}>
              <Button variant="primary" disabled={cmd.busy()} onClick={addRule}>
                Add rule
              </Button>
              <Button variant="secondary" disabled={cmd.busy() || entries().length === 0} onClick={clearAll}>
                Clear all
              </Button>
            </div>

            <Show when={rewrite()?.tableFull}>
              <div class="callout callout--warning" style={section}>
                The box holds {REWRITE_TAB_MAX} rules and the table is full. Remove one before adding another.
              </div>
            </Show>
            <Show when={cmd.error()}>
              <div class="callout callout--danger" role="alert" style={section}>
                {cmd.error()}
              </div>
            </Show>

            <div style={section}>
              <div style={label}>
                Active ({entries().length} of {REWRITE_TAB_MAX})
              </div>
              <Show
                when={entries().length > 0}
                fallback={<p>No rules. Every packet passes through as the device sends it.</p>}
              >
                <div style={chips}>
                  <For each={entries()}>
                    {(e, i) => (
                      <Chip variant="info" onRemove={() => removeAt(i())}>
                        {describe(e)}
                      </Chip>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceRewrite;
