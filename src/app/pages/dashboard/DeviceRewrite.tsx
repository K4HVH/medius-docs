// The box drops a rule while imperfect clones are off, so the controls hide then. Removal keys on
// match and mask, which the summary lacks, so a rule is read back in full first.

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
  REWRITE_MATCH_MAX,
  REWRITE_POOL,
  REWRITE_TAB_MAX,
  RewriteAction,
  rewriteActionName,
  rewriteClassName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { chips, label, muted, row, section } from './ui';
import {
  TRAFFIC_CLASS_BLURB,
  TRAFFIC_CLASS_OPTIONS,
  displayName,
  parseHex,
  parseMatchMask,
  trafficDirWord,
  trafficIdLabel,
} from './hex';

// On Control, Patch and Replace reach only an Out request's data.
const ACTION_BLURB: Record<number, string> = {
  [RewriteAction.Pass]: 'Leaves the packet untouched.',
  [RewriteAction.Drop]: 'Discards the packet.',
  [RewriteAction.Patch]: 'Writes the payload at the offset, keeping the length.',
  [RewriteAction.Replace]: 'The packet becomes the payload.',
  [RewriteAction.Answer]: 'Replies with the payload without asking the device.',
  [RewriteAction.Stall]: 'Stalls the request.',
  [RewriteAction.Nak]: 'On EP0, no reply until the host gives up. On other control endpoints, a stall.',
  [RewriteAction.ReplyPatch]: "Overwrites an In request's reply at the offset, keeping the length.",
  [RewriteAction.ReplyReplace]: "An In request's reply becomes the payload.",
};
const CONTROL_ACTION_BLURB: Partial<Record<number, string>> = {
  [RewriteAction.Patch]: "Overwrites an Out request's data at the offset, keeping the length.",
  [RewriteAction.Replace]: "Overwrites the start of an Out request's data, keeping the length.",
};
const classBlurb = (cls: number): string =>
  cls === CatchClass.HidIn
    ? `${TRAFFIC_CLASS_BLURB[cls]} Rewrite mouse motion at Emit: the box recomputes it on any report it changes.`
    : TRAFFIC_CLASS_BLURB[cls];
const actionBlurb = (cls: number, a: RewriteAction): string =>
  (cls === CatchClass.Control ? CONTROL_ACTION_BLURB[a] : undefined) ?? ACTION_BLURB[a];

// The box validates the pair; this only filters the menu.
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

const carriesPayload = (a: RewriteAction): boolean =>
  a === RewriteAction.Patch ||
  a === RewriteAction.Replace ||
  a === RewriteAction.Answer ||
  a === RewriteAction.ReplyPatch ||
  a === RewriteAction.ReplyReplace;
const readsOffset = (a: RewriteAction): boolean =>
  a === RewriteAction.Patch || a === RewriteAction.ReplyPatch;

// A chip ellipsises past 250px, so match and payload lengths stay out of the name.
const describe = (e: RewriteRuleInfo): string => {
  const where = e.id === CATCH_ID_ANY ? 'any' : e.id;
  const head = `${displayName(rewriteActionName(e.action))} ${rewriteClassName(e.cls)} ${where} ${trafficDirWord(e.dir)}`;
  return e.hits ? `${head}, ${e.hits} ${e.hits === 1 ? 'hit' : 'hits'}` : head;
};

// Combobox returns a string or an array; the action picker is single-select.
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

  // A new class can lack the action; fall back to Pass, which every class takes.
  const chooseClass = (v: string) => {
    setRwClass(v);
    if (!actionsFor(Number(v)).includes(action())) setRwAction(String(RewriteAction.Pass));
  };

  const buildRule = (): RewriteRule | string => {
    const head = parseMatchMask(rwMatch(), rwMask(), REWRITE_MATCH_MAX);
    if (typeof head === 'string') return head;
    const payload = carriesPayload(action()) ? parseHex(rwPayload()) : new Uint8Array(0);
    if (payload === null) return 'Payload must be hex.';
    return {
      cls: cls(),
      id: rwAnyId() === 'any' ? CATCH_ID_ANY : rwId(),
      dir: Number(rwDir()),
      action: action(),
      off: readsOffset(action()) ? rwOff() : 0,
      ...head,
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
          <CardHeader title="Rewrite rules" subtitle="Change relayed traffic" />

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
            <RadioGroup name="rw-class" value={rwClass()} onChange={chooseClass} options={TRAFFIC_CLASS_OPTIONS} />
            <p style={{ ...muted, 'margin-top': '4px' }}>{classBlurb(cls())}</p>

            <div style={section}>
              <div style={label}>Id</div>
              <RadioGroup
                name="rw-anyid"
                value={rwAnyId()}
                onChange={setRwAnyId}
                options={[
                  { value: 'any', label: 'Every id' },
                  { value: 'one', label: 'One id' },
                ]}
              />
              <Show when={rwAnyId() === 'one'}>
                <div style={{ ...section, 'max-width': '11rem' }}>
                  <NumberInput
                    label={trafficIdLabel(cls())}
                    value={rwId()}
                    min={0}
                    max={65534}
                    precision={0}
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
              <p style={{ ...muted, 'margin-top': '4px' }}>{actionBlurb(cls(), action())}</p>
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
              Match and mask: same length, at most {REWRITE_MATCH_MAX} bytes. Blank matches every
              packet on that address.
            </p>

            <Show when={carriesPayload(action())}>
              <div style={{ ...section, ...row, 'align-items': 'flex-end' }}>
                <Show when={readsOffset(action())}>
                  <div style={{ 'max-width': '8rem' }}>
                    <NumberInput label="Offset" value={rwOff()} min={0} max={65534} precision={0} onChange={(v) => setRwOff(v ?? 0)} />
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
                The box refused the last rule: it holds {REWRITE_TAB_MAX} rules and {REWRITE_POOL} bytes of
                rule payload. Remove or shorten one, then retry.
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
                fallback={<p>None.</p>}
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
