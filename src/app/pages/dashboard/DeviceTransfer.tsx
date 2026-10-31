import { A } from '@solidjs/router';
import { For, Show, createSignal } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { TextField } from '../../../components/inputs/TextField';
import {
  type TransferResult,
  TRANSFER_OUT_MAX,
  TRANSFER_TIMEOUT_DEFAULT_MS,
  TRANSFER_TIMEOUT_MAX_MS,
  TRANSFER_TIMEOUT_MIN_MS,
  TransferStage,
  TransferStatus,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Panel } from '../../shell/Panel';
import { SETUP_DEFAULT, SETUP_FIELDS, decodeSetup, outDataBlurb, parseHex, parseNum, toHex } from './hex';

const STATUS_LABEL: Record<number, string> = {
  [TransferStatus.Ok]: 'OK',
  [TransferStatus.Busy]: 'Busy',
  [TransferStatus.Suspended]: 'Suspended',
  [TransferStatus.Error]: 'Error',
  [TransferStatus.Refused]: 'Refused',
  [TransferStatus.Stall]: 'Stalled',
  [TransferStatus.NoAnswer]: 'No answer',
  [TransferStatus.NoDevice]: 'No device',
};
const STATUS_BLURB: Record<number, string> = {
  [TransferStatus.Ok]: 'The real device completed the transfer.',
  [TransferStatus.Busy]:
    "The game PC's requests on this endpoint go first. One held the endpoint until the timeout, or the game PC took it over with its next request or a bus event.",
  [TransferStatus.Suspended]: 'The game PC has put the clone to sleep, and the real device with it. Nothing was sent.',
  [TransferStatus.Error]: 'The real device sent corrupt packets three times over, or a packet longer than the box asked for, or the box had no free channel to send it on.',
  [TransferStatus.Refused]:
    "The box didn't send it: the real device has no control endpoint with that number, another transfer was still running, imperfect clones are off, or the box had no room for it at that moment.",
  [TransferStatus.Stall]: 'The real device stalled the request.',
  [TransferStatus.NoAnswer]:
    "The real device didn't answer within the timeout, its answer was lost between the box's chips, or part of it waited over a second to reach this page.",
  [TransferStatus.NoDevice]: 'No device plugged into the box.',
};
const STAGE_LABEL: Record<number, string> = {
  [TransferStage.Setup]: 'Setup stage',
  [TransferStage.Data]: 'Data stage',
  [TransferStage.Status]: 'Status stage',
};

const hexByte = (v: number) => `0x${v.toString(16).padStart(2, '0')}`;
const statusLabel = (s: number) => STATUS_LABEL[s] ?? `Status ${hexByte(s)}`;
const stageLabel = (s: number) => STAGE_LABEL[s] ?? `Stage ${s}`;

// Refused, Busy and Suspended come from the box or the game PC, not the real device.
const statusVariant = (s: number): 'success' | 'warning' | 'error' | 'neutral' => {
  if (s === TransferStatus.Ok) return 'success';
  if (s === TransferStatus.Refused || s === TransferStatus.Busy || s === TransferStatus.Suspended) return 'warning';
  return STATUS_LABEL[s] ? 'error' : 'neutral';
};

const DeviceTransfer = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const allowed = () => imperfect()?.allowed === true;

  const [ep, setEp] = createSignal(0);
  const [setup, setSetup] = createSignal<Record<string, string>>(SETUP_DEFAULT);
  const [out, setOut] = createSignal('');
  const [timeoutMs, setTimeoutMs] = createSignal(TRANSFER_TIMEOUT_DEFAULT_MS);
  const [result, setResult] = createSignal<TransferResult | null>(null);
  const cmd = createCommand();
  const bm = () => parseNum(setup().type);

  const refuse = (why: string) => {
    setResult(null);
    cmd.run(() => Promise.reject(new Error(why)));
  };

  const run = () => {
    const s = setup();
    const fields = SETUP_FIELDS.map((f) => parseNum(s[f.key]));
    if (fields.some((f) => f === null)) return refuse('Every setup field must be a number.');
    const [type, req, value, index, length] = fields as number[];
    const writes = (type & 0x80) === 0;
    const data = writes ? parseHex(out()) : new Uint8Array(0);
    if (data === null) return refuse('Out data must be hex.');
    if (writes && length > TRANSFER_OUT_MAX) return refuse(`A request that writes carries ≤${TRANSFER_OUT_MAX} bytes.`);
    if (data.length !== (writes ? length : 0)) return refuse('Out data must be wLength bytes.');
    setResult(null);
    cmd.run(async () => {
      setResult(await dash.link()!.transfer(ep(), type, req, value, index, length, data, timeoutMs()));
    });
  };

  return (
    <Show when={dash.status() === 'connected'}>
      <Panel id="control-transfer" title="Control transfer">
        <Show
          when={allowed()}
          fallback={
            <p class="mut">
              Control transfers need <A href="/dashboard#imperfect-clone">imperfect clones</A>, on Device's Options tab.
            </p>
          }
        >
          <div class="fields">
            <div class="fw-s">
              <NumberInput
                label="Endpoint"
                value={ep()}
                min={0}
                max={15}
                precision={0}
                onChange={(v) => setEp(v ?? 0)}
              />
            </div>
            <For each={SETUP_FIELDS}>
              {(f) => (
                <div class="fw-s">
                  <TextField
                    label={f.label}
                    value={setup()[f.key]}
                    onInput={(v) => setSetup((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={f.placeholder}
                  />
                </div>
              )}
            </For>
          </div>

          <p class="mut">
            <Show when={bm() !== null} fallback="bmRequestType must be a number.">
              {decodeSetup(bm()!, parseNum(setup().req))}
            </Show>
          </p>

          <TextField label="Out data (hex)" value={out()} onInput={setOut} placeholder="e.g. 00 01" />
          <p class="mut">{outDataBlurb(bm())}</p>

          <div class="acts">
            <div class="fw-s">
              <NumberInput
                label="Timeout"
                suffix="ms"
                value={timeoutMs()}
                min={TRANSFER_TIMEOUT_MIN_MS}
                max={TRANSFER_TIMEOUT_MAX_MS}
                precision={0}
                onChange={(v) => setTimeoutMs(v ?? TRANSFER_TIMEOUT_DEFAULT_MS)}
              />
            </div>
            <Button variant="primary" disabled={cmd.busy()} onClick={run}>
              {cmd.busy() ? 'Running...' : 'Run'}
            </Button>
          </div>

          <div aria-live="polite" class="step">
            <Show when={cmd.error()}>
              <div class="callout callout--danger" role="alert">
                {cmd.error()}
              </div>
            </Show>
            <Show when={result()}>
              {(r) => (
                <>
                  <div class="chips">
                    <Chip variant={statusVariant(r().status)}>{statusLabel(r().status)}</Chip>
                    <Chip variant="neutral">{stageLabel(r().stage)}</Chip>
                    <Chip variant="neutral">{r().data.length} B in</Chip>
                  </div>
                  <Show when={STATUS_BLURB[r().status]}>{(blurb) => <p class="mut">{blurb()}</p>}</Show>
                  <Show when={r().data.length > 0}>
                    <pre class="diagram reply">
                      {toHex(r().data)}
                    </pre>
                  </Show>
                </>
              )}
            </Show>
          </div>
        </Show>
      </Panel>
    </Show>
  );
};

export default DeviceTransfer;
