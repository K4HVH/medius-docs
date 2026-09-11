// The advanced control layer (§3.14): rewrite rules, descriptor patches, and the raw/transfer console.
//
// All of it is addressed in the CATCH (class, id, dir) space and admitted only under OPTION(IMPERFECT).
// The layer is inert while the opt-in is off: a rewrite rule or a raw report is dropped, a transfer is
// refused, and a patch is stored but not applied. The banner reads the opt-in back and says so.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Combobox } from '../../../components/inputs/Combobox';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import {
  type PatchEntry,
  type RewriteRule,
  type RewriteRuleInfo,
  type TransferResult,
  CatchClass,
  Direction,
  PatchSection,
  REWRITE_CLASSES,
  RewriteAction,
  TransferStatus,
  patchSectionName,
  rewriteActionName,
  rewriteClassName,
  transferStatusName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Section } from './Section';
import { chips, label, muted, row, section } from './ui';

// Bytes as spaced lowercase hex, the form every field on this page reads and writes.
const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

// Parse spaced or run-together hex into bytes; an odd nibble count or a non-hex character is a null,
// which the caller reports rather than sending a half-formed frame. An empty string is an empty array.
const parseHex = (s: string): Uint8Array | null => {
  const clean = s.replace(/0x/gi, '').replace(/[\s,]+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

// A small integer from a decimal or 0x-prefixed field; null on anything else.
const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const v = /^0x/i.test(t) ? parseInt(t.slice(2), 16) : Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
};

const num = (v: number): string => v.toString();

// The classes a rewrite rule can address, and how each names its id (§4.17).
const CLASS_OPTIONS = REWRITE_CLASSES.map((c) => ({ value: String(c), label: rewriteClassName(c) }));
const idLabel = (cls: number): string => {
  if (cls === CatchClass.HidIn) return 'Interface number';
  if (cls === CatchClass.Control) return 'Endpoint number (0 = EP0)';
  return 'Endpoint number (e.g. 1)';
};

// A report surface can pass, drop, or rewrite a packet; the control class trades Drop for the answer and
// reply actions. The box validates the pair, so this only keeps the menu honest.
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

const DIR_OPTIONS = [
  { value: String(Direction.Both), label: 'Both' },
  { value: String(Direction.Positive), label: 'In (device to PC)' },
  { value: String(Direction.Negative), label: 'Out (PC to device)' },
];
const dirName = (d: number): string =>
  d === Direction.Positive ? 'in' : d === Direction.Negative ? 'out' : 'both';

const SECTION_OPTIONS = [
  { value: String(PatchSection.Device), label: 'Device descriptor' },
  { value: String(PatchSection.Config), label: 'Configuration descriptor' },
  { value: String(PatchSection.Report), label: 'Report descriptor' },
  { value: String(PatchSection.String), label: 'String descriptor' },
  { value: String(PatchSection.Bos), label: 'BOS descriptor' },
];

// The one() coercion: Combobox hands back a string or an array, and every picker here is single-select.
const one = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

const DeviceDeveloper = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const rewrite = dash.poll('rewrite');
  const patches = dash.poll('patches');
  const allowed = () => imperfect()?.allowed === true;

  const refresh = () => {
    dash.refreshPoll('rewrite');
    dash.refreshPoll('patches');
  };

  // Rewrite-rule form.
  const [rwClass, setRwClass] = createSignal(String(CatchClass.Control));
  const [rwId, setRwId] = createSignal('0');
  const [rwDir, setRwDir] = createSignal(String(Direction.Both));
  const [rwAction, setRwAction] = createSignal(String(RewriteAction.Pass));
  const [rwOff, setRwOff] = createSignal('0');
  const [rwMatch, setRwMatch] = createSignal('');
  const [rwMask, setRwMask] = createSignal('');
  const [rwPayload, setRwPayload] = createSignal('');
  const rwCmd = createCommand(refresh);

  const cls = () => Number(rwClass());
  const action = () => Number(rwAction()) as RewriteAction;
  const actionOptions = createMemo(() =>
    actionsFor(cls()).map((a) => ({ value: String(a), label: rewriteActionName(a) })),
  );

  // Picking a class can strand an action the new class does not offer; fall back to Pass, which every
  // class takes, the way the lock editor falls back to Both.
  const chooseClass = (v: string) => {
    setRwClass(v);
    if (!actionsFor(Number(v)).includes(action())) setRwAction(String(RewriteAction.Pass));
  };

  const buildRule = (): RewriteRule | string => {
    const id = parseNum(rwId());
    if (id === null) return 'Enter a valid id.';
    const off = parseNum(rwOff()) ?? 0;
    const match = parseHex(rwMatch());
    const mask = parseHex(rwMask());
    if (match === null || mask === null) return 'Match and mask must be hex.';
    if (match.length !== mask.length) return 'Match and mask must be the same length.';
    const payload = parseHex(rwPayload());
    if (payload === null) return 'Payload must be hex.';
    return { cls: cls(), id, dir: Number(rwDir()), action: action(), off, match, mask, payload };
  };

  const submitRule = (setter: (l: ReturnType<typeof dash.link>, r: RewriteRule) => Promise<void>) => {
    const built = buildRule();
    if (typeof built === 'string') {
      rwCmd.run(() => Promise.reject(new Error(built)));
      return;
    }
    rwCmd.run(() => setter(dash.link(), built));
  };

  const addRule = () => submitRule((l, r) => l!.setRewrite(r));
  const removeRule = () => submitRule((l, r) => l!.removeRewrite(r));
  const clearTable = () => rwCmd.run(() => dash.link()!.clearRewrite());

  // Read one rule back in full and fill the form with it, so an edit is read-change-send.
  const loadRule = (index: number) =>
    rwCmd.run(async () => {
      const r = await dash.link()!.queryRewriteEntry(index);
      setRwClass(String(r.cls));
      setRwId(`0x${r.id.toString(16)}`);
      setRwDir(String(r.dir));
      setRwAction(String(r.action));
      setRwOff(num(r.off));
      setRwMatch(toHex(r.match));
      setRwMask(toHex(r.mask));
      setRwPayload(toHex(r.payload));
    });

  const ruleText = (e: RewriteRuleInfo): string => {
    const head = `${rewriteClassName(e.cls)} id 0x${e.id.toString(16)} ${dirName(e.dir)} → ${rewriteActionName(e.action)}`;
    const at = e.mlen ? ` match ${e.mlen}B` : '';
    const pl = e.plen ? ` payload ${e.plen}B @${e.off}` : '';
    return `${head}${at}${pl} · ${e.hits} hit${e.hits === 1 ? '' : 's'}`;
  };

  // Descriptor-patch form.
  const [pSection, setPSection] = createSignal(String(PatchSection.Device));
  const [pCfg, setPCfg] = createSignal('0');
  const [pIndex, setPIndex] = createSignal('0');
  const [pOff, setPOff] = createSignal('0');
  const [pBytes, setPBytes] = createSignal('');
  const pCmd = createCommand(refresh);

  const psection = () => Number(pSection()) as PatchSection;
  // The device and BOS descriptors are singletons, so cfg and index do not address them. A report
  // descriptor keys on cfg + index (the interface); a configuration on cfg; a string on index.
  const usesCfg = () => psection() === PatchSection.Config || psection() === PatchSection.Report;
  const usesIndex = () => psection() === PatchSection.Report || psection() === PatchSection.String;

  const patchArgs = (): { offset: number; bytes: Uint8Array } | string => {
    const offset = parseNum(pOff());
    if (offset === null) return 'Enter a valid offset.';
    const bytes = parseHex(pBytes());
    if (bytes === null) return 'Bytes must be hex.';
    return { offset, bytes };
  };

  const submitPatch = (remove: boolean) => {
    const a = patchArgs();
    if (typeof a === 'string') {
      pCmd.run(() => Promise.reject(new Error(a)));
      return;
    }
    const cfg = parseNum(pCfg()) ?? 0;
    const index = parseNum(pIndex()) ?? 0;
    pCmd.run(() =>
      remove
        ? dash.link()!.removePatch(psection(), cfg, index, a.offset)
        : dash.link()!.setPatch(psection(), cfg, index, a.offset, a.bytes),
    );
  };

  const applyPatches = () => pCmd.run(() => dash.link()!.applyPatch());
  const clearPatches = () => pCmd.run(() => dash.link()!.clearPatch());

  const loadPatch = (index: number) =>
    pCmd.run(async () => {
      const p: PatchEntry = await dash.link()!.queryPatchEntry(index);
      setPSection(String(p.section ?? PatchSection.Device));
      setPCfg(num(p.cfg));
      setPIndex(num(p.index));
      setPOff(num(p.offset));
      setPBytes(toHex(p.bytes));
    });

  const patchFlags = createMemo(() => {
    const p = patches();
    if (!p) return [] as { text: string; on: boolean }[];
    return [
      { text: 'Applied', on: p.applied },
      { text: 'Pending apply', on: p.pending },
      { text: 'Last apply refused', on: p.refused },
      { text: 'Store full', on: p.tableFull },
    ];
  });

  // Raw & control-transfer console.
  const [rawEp, setRawEp] = createSignal('1');
  const [rawDir, setRawDir] = createSignal(String(Direction.Positive));
  const [rawBytes, setRawBytes] = createSignal('');
  const rawCmd = createCommand();
  const sendRaw = () => {
    const ep = parseNum(rawEp());
    const bytes = parseHex(rawBytes());
    if (ep === null) {
      rawCmd.run(() => Promise.reject(new Error('Enter a valid endpoint number.')));
      return;
    }
    if (bytes === null || bytes.length === 0) {
      rawCmd.run(() => Promise.reject(new Error('Enter the bytes to put on the endpoint.')));
      return;
    }
    rawCmd.run(() => dash.link()!.raw(ep, Number(rawDir()), bytes));
  };

  const [tEp, setTEp] = createSignal('0');
  const [tType, setTType] = createSignal('0x80');
  const [tReq, setTReq] = createSignal('6');
  const [tValue, setTValue] = createSignal('0x0100');
  const [tIndex, setTIndex] = createSignal('0');
  const [tLength, setTLength] = createSignal('18');
  const [tOut, setTOut] = createSignal('');
  const [tResult, setTResult] = createSignal<TransferResult | null>(null);
  const tCmd = createCommand();
  const runTransfer = () => {
    const fields = [tEp(), tType(), tReq(), tValue(), tIndex(), tLength()].map(parseNum);
    if (fields.some((f) => f === null)) {
      tCmd.run(() => Promise.reject(new Error('Every setup field must be a number.')));
      return;
    }
    const out = parseHex(tOut());
    if (out === null) {
      tCmd.run(() => Promise.reject(new Error('OUT data must be hex.')));
      return;
    }
    const [ep, type, req, value, index, length] = fields as number[];
    setTResult(null);
    tCmd.run(async () => {
      const r = await dash.link()!.transfer(ep, type, req, value, index, length, out);
      setTResult(r);
    });
  };
  const statusVariant = (s: TransferStatus): 'success' | 'warning' | 'error' =>
    s === TransferStatus.Ok ? 'success' : s === TransferStatus.Refused ? 'warning' : 'error';

  return (
    <Show when={dash.status() === 'connected' && !dash.updateOnly()}>
      <div id="advanced-control-layer" data-search-target>
        <Card>
          <CardHeader title="Advanced control layer" subtitle="Raw injection, rewrite rules, and descriptor patches" />
          <p>
            The advanced control layer reaches every traffic class the box carries, on the same{' '}
            <A href="/native/commands/catch">(class, id, direction)</A> addresses a subscription uses. A
            rewrite rule rewrites a matched packet in flight, a descriptor patch overwrites the bytes the
            clone presents, and the console below puts raw reports and control requests on the wire.
          </p>
          <Show
            when={allowed()}
            fallback={
              <div class="callout callout--warning" style={section}>
                The layer is off. It needs imperfect clones enabled: a rewrite rule and a raw report are
                dropped, a control transfer is refused, and a descriptor patch is stored but not applied
                until then. Turn it on under{' '}
                <A href="/dashboard#imperfect-clone">Device, Imperfect clone</A>.
              </div>
            }
          >
            <div style={{ ...chips, ...section }}>
              <Chip variant="success">Advanced control layer active</Chip>
            </div>
          </Show>
        </Card>
      </div>

      <div id="rewrite-rules" data-search-target style={section}>
        <Card>
          <CardHeader title="Rewrite rules" subtitle="Rewrite a matched packet in flight" />
          <p>
            A rule matches a class, an id, and a direction, with an optional masked match over the head of
            the packet, and runs one action. The most specific rule wins. A report surface can pass, drop,
            or rewrite; the control class can also answer a request itself or rewrite the device's reply.
          </p>

          <div style={section}>
            <div style={label}>Class</div>
            <Combobox value={rwClass()} onChange={(v) => chooseClass(one(v))} options={CLASS_OPTIONS} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap' }}>
            <div style={{ ...section, flex: '1 1 200px' }}>
              <TextField
                label={idLabel(cls())}
                value={rwId()}
                onInput={setRwId}
                placeholder="0x81"
              />
            </div>
            <div style={{ ...section, flex: '1 1 200px' }}>
              <div style={label}>Direction</div>
              <RadioGroup name="rw-dir" value={rwDir()} onChange={setRwDir} options={DIR_OPTIONS} />
            </div>
          </div>

          <div style={section}>
            <div style={label}>Action</div>
            <Combobox value={rwAction()} onChange={(v) => setRwAction(one(v))} options={actionOptions()} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap' }}>
            <div style={{ ...section, flex: '1 1 140px' }}>
              <TextField label="Match (hex)" value={rwMatch()} onInput={setRwMatch} placeholder="e.g. 21 09" />
            </div>
            <div style={{ ...section, flex: '1 1 140px' }}>
              <TextField label="Mask (hex)" value={rwMask()} onInput={setRwMask} placeholder="e.g. ff ff" />
            </div>
          </div>
          <p style={muted}>Match and mask are the same length, or leave both blank to match any head.</p>

          <Show when={carriesPayload(action())}>
            <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap' }}>
              <Show when={readsOffset(action())}>
                <div style={{ ...section, flex: '0 1 140px' }}>
                  <TextField label="Offset" value={rwOff()} onInput={setRwOff} placeholder="0" />
                </div>
              </Show>
              <div style={{ ...section, flex: '1 1 220px' }}>
                <TextField
                  label="Payload (hex)"
                  value={rwPayload()}
                  onInput={setRwPayload}
                  placeholder="the bytes the action writes"
                />
              </div>
            </div>
          </Show>

          <div style={{ ...section, ...row }}>
            <Button variant="primary" disabled={rwCmd.busy() || !allowed()} onClick={addRule}>
              Add rule
            </Button>
            <Button variant="secondary" disabled={rwCmd.busy()} onClick={removeRule}>
              Remove rule
            </Button>
            <Button variant="subtle" disabled={rwCmd.busy()} onClick={clearTable}>
              Clear table
            </Button>
          </div>
          <Show when={rwCmd.error()}>
            <div class="callout callout--danger" role="alert" style={section}>
              {rwCmd.error()}
            </div>
          </Show>

          <div style={section}>
            <Section title="Live table" first>
              <Show when={rewrite()} fallback={<p>Reading the table...</p>}>
                {(t) => (
                  <>
                    <div style={{ ...chips, 'margin-bottom': 'var(--g-spacing-sm)' }}>
                      <Chip variant="neutral">Generation {t().gen}</Chip>
                      <Chip variant={t().tableFull ? 'warning' : 'neutral'}>
                        {t().entries.length} of 16
                      </Chip>
                    </div>
                    <Show when={t().entries.length > 0} fallback={<p>No rules.</p>}>
                      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                        <For each={t().entries}>
                          {(e, i) => (
                            <div
                              style={{
                                display: 'flex',
                                'justify-content': 'space-between',
                                'align-items': 'center',
                                gap: 'var(--g-spacing-sm)',
                                'flex-wrap': 'wrap',
                              }}
                            >
                              <code style={{ 'font-size': 'var(--font-size-xs, 0.8rem)' }}>{ruleText(e)}</code>
                              <Button
                                variant="subtle"
                                size="compact"
                                disabled={rwCmd.busy()}
                                onClick={() => loadRule(i())}
                              >
                                Load
                              </Button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </>
                )}
              </Show>
            </Section>
          </div>
        </Card>
      </div>

      <div id="descriptor-patches" data-search-target style={section}>
        <Card>
          <CardHeader title="Descriptor patches" subtitle="Overwrite the bytes the clone presents" />
          <p>
            A patch overwrites bytes in a served descriptor at an offset. The box keeps the set in its
            store across a reboot; applying it re-presents the clone, so the game PC sees one replug and
            then the patched descriptors. A zero-length set removes the patch at that address.
          </p>

          <div style={section}>
            <div style={label}>Descriptor</div>
            <Combobox value={pSection()} onChange={(v) => setPSection(one(v))} options={SECTION_OPTIONS} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap' }}>
            <Show when={usesCfg()}>
              <div style={{ ...section, flex: '0 1 160px' }}>
                <TextField label="Configuration" value={pCfg()} onInput={setPCfg} placeholder="0" />
              </div>
            </Show>
            <Show when={usesIndex()}>
              <div style={{ ...section, flex: '0 1 160px' }}>
                <TextField
                  label={psection() === PatchSection.String ? 'String index' : 'Interface'}
                  value={pIndex()}
                  onInput={setPIndex}
                  placeholder="0"
                />
              </div>
            </Show>
            <div style={{ ...section, flex: '0 1 140px' }}>
              <TextField label="Offset" value={pOff()} onInput={setPOff} placeholder="0" />
            </div>
          </div>

          <div style={section}>
            <TextField
              label="Bytes (hex)"
              value={pBytes()}
              onInput={setPBytes}
              placeholder="the bytes to write, or blank to remove"
            />
          </div>

          <div style={{ ...section, ...row }}>
            <Button variant="primary" disabled={pCmd.busy()} onClick={() => submitPatch(false)}>
              Set patch
            </Button>
            <Button variant="secondary" disabled={pCmd.busy()} onClick={() => submitPatch(true)}>
              Remove patch
            </Button>
            <Button variant="secondary" disabled={pCmd.busy() || !allowed()} onClick={applyPatches}>
              Apply
            </Button>
            <Button variant="subtle" disabled={pCmd.busy()} onClick={clearPatches}>
              Clear all
            </Button>
          </div>
          <Show when={!allowed()}>
            <p style={muted}>A patch is stored now and applied to the clone once imperfect clones are on.</p>
          </Show>
          <Show when={pCmd.error()}>
            <div class="callout callout--danger" role="alert" style={section}>
              {pCmd.error()}
            </div>
          </Show>

          <div style={section}>
            <Section title="Stored set" first>
              <Show when={patches()} fallback={<p>Reading the set...</p>}>
                {(p) => (
                  <>
                    <div style={{ ...chips, 'margin-bottom': 'var(--g-spacing-sm)' }}>
                      <For each={patchFlags()}>
                        {(f) => <Chip variant={f.on ? 'info' : 'neutral'}>{f.text}</Chip>}
                      </For>
                    </div>
                    <Show when={p().entries.length > 0} fallback={<p>No patches stored.</p>}>
                      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                        <For each={p().entries}>
                          {(e, i) => (
                            <div
                              style={{
                                display: 'flex',
                                'justify-content': 'space-between',
                                'align-items': 'center',
                                gap: 'var(--g-spacing-sm)',
                                'flex-wrap': 'wrap',
                              }}
                            >
                              <code style={{ 'font-size': 'var(--font-size-xs, 0.8rem)' }}>
                                {patchSectionName(e.section)} cfg {e.cfg} index {e.index} @{e.offset} ·{' '}
                                {e.len}B
                              </code>
                              <Button
                                variant="subtle"
                                size="compact"
                                disabled={pCmd.busy()}
                                onClick={() => loadPatch(i())}
                              >
                                Load
                              </Button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </>
                )}
              </Show>
            </Section>
          </div>
        </Card>
      </div>

      <div id="raw-transfer" data-search-target style={section}>
        <Card>
          <CardHeader title="Raw and control transfer" subtitle="Put a report or a control request on the wire" />

          <Section title="Raw report" first>
            <p>
              Bytes verbatim on a cloned endpoint. An IN endpoint reaches the game PC; an OUT endpoint
              reaches the device.
            </p>
            <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap' }}>
              <div style={{ ...section, flex: '0 1 120px' }}>
                <TextField label="Endpoint number" value={rawEp()} onInput={setRawEp} placeholder="1" />
              </div>
              <div style={{ ...section, flex: '0 1 160px' }}>
                <div style={label}>Direction</div>
                <RadioGroup
                  name="raw-dir"
                  value={rawDir()}
                  onChange={setRawDir}
                  options={[
                    { value: String(Direction.Positive), label: 'In' },
                    { value: String(Direction.Negative), label: 'Out' },
                  ]}
                />
              </div>
              <div style={{ ...section, flex: '1 1 240px' }}>
                <TextField label="Bytes (hex)" value={rawBytes()} onInput={setRawBytes} placeholder="e.g. 01 00 05 00" />
              </div>
            </div>
            <div style={{ ...section, ...row }}>
              <Button variant="primary" disabled={rawCmd.busy() || !allowed()} onClick={sendRaw}>
                Send
              </Button>
            </div>
            <Show when={rawCmd.error()}>
              <div class="callout callout--danger" role="alert" style={section}>
                {rawCmd.error()}
              </div>
            </Show>
          </Section>

          <Section title="Control transfer">
            <p>
              One control request against the real device, returning its status and the IN data. The setup
              fields are the eight bytes of a USB setup packet; the default runs GET_DESCRIPTOR for the
              18-byte device descriptor.
            </p>
            <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap' }}>
              <div style={{ ...section, flex: '0 1 120px' }}>
                <TextField label="Endpoint" value={tEp()} onInput={setTEp} placeholder="0" />
              </div>
              <div style={{ ...section, flex: '0 1 150px' }}>
                <TextField label="bmRequestType" value={tType()} onInput={setTType} placeholder="0x80" />
              </div>
              <div style={{ ...section, flex: '0 1 130px' }}>
                <TextField label="bRequest" value={tReq()} onInput={setTReq} placeholder="6" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap' }}>
              <div style={{ ...section, flex: '0 1 130px' }}>
                <TextField label="wValue" value={tValue()} onInput={setTValue} placeholder="0x0100" />
              </div>
              <div style={{ ...section, flex: '0 1 130px' }}>
                <TextField label="wIndex" value={tIndex()} onInput={setTIndex} placeholder="0" />
              </div>
              <div style={{ ...section, flex: '0 1 130px' }}>
                <TextField label="wLength" value={tLength()} onInput={setTLength} placeholder="18" />
              </div>
            </div>
            <div style={section}>
              <TextField
                label="OUT data (hex)"
                value={tOut()}
                onInput={setTOut}
                placeholder="for a host-to-device request; blank otherwise"
              />
            </div>
            <div style={{ ...section, ...row }}>
              <Button variant="primary" disabled={tCmd.busy() || !allowed()} onClick={runTransfer}>
                Run
              </Button>
            </div>
            <Show when={tCmd.error()}>
              <div class="callout callout--danger" role="alert" style={section}>
                {tCmd.error()}
              </div>
            </Show>
            <Show when={tResult()}>
              {(r) => (
                <div style={section}>
                  <div style={chips}>
                    <Chip variant={statusVariant(r().status)}>{transferStatusName(r().status)}</Chip>
                    <Chip variant="neutral">{r().data.length}B in</Chip>
                  </div>
                  <Show when={r().data.length > 0}>
                    <pre class="diagram" style={{ 'margin-top': 'var(--g-spacing-sm)', overflow: 'auto', margin: 0 }}>
                      {toHex(r().data)}
                    </pre>
                  </Show>
                </div>
              )}
            </Show>
          </Section>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceDeveloper;
