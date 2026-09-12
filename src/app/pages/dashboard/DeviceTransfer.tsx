// Run one control request against the real device and show what it answered.
//
// The five setup fields keep their specification names and stay text: bmRequestType and wValue are
// read and written in hex wherever USB is documented, and a spinner showing 256 for 0x0100 would be
// the wrong instrument for the one card whose whole subject is the setup packet.

import { For, Show, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { TextField } from '../../../components/inputs/TextField';
import { type TransferResult, TransferStatus, transferStatusName } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { chips, muted, row, section } from './ui';
import { displayName, parseHex, parseNum, toHex } from './hex';

const SETUP = [
  { key: 'type', label: 'bmRequestType', placeholder: '0x80' },
  { key: 'req', label: 'bRequest', placeholder: '6' },
  { key: 'value', label: 'wValue', placeholder: '0x0100' },
  { key: 'index', label: 'wIndex', placeholder: '0' },
  { key: 'length', label: 'wLength', placeholder: '18' },
] as const;

// bmRequestType is a bitmap, so the one field nobody reads at a glance is the one worth reading
// back in words. Bit 7 is the direction, bits 6-5 the type, bits 4-0 the recipient.
const TYPE_NAME = ['standard', 'class', 'vendor', 'reserved'];
const RECIPIENT_NAME = ['the device', 'an interface', 'an endpoint', 'another target'];

// The standard requests, which are the ones a bRequest number alone will not tell you.
const STANDARD_REQUEST: Record<number, string> = {
  0: 'GET_STATUS',
  1: 'CLEAR_FEATURE',
  3: 'SET_FEATURE',
  5: 'SET_ADDRESS',
  6: 'GET_DESCRIPTOR',
  7: 'SET_DESCRIPTOR',
  8: 'GET_CONFIGURATION',
  9: 'SET_CONFIGURATION',
  10: 'GET_INTERFACE',
  11: 'SET_INTERFACE',
  12: 'SYNCH_FRAME',
};

const decodeSetup = (bm: number, req: number | null): string => {
  const dir = bm & 0x80 ? 'Device to host' : 'Host to device';
  const type = (bm >> 5) & 0x03;
  const recipient = RECIPIENT_NAME[Math.min(bm & 0x1f, 3)];
  const head = `${dir}, ${TYPE_NAME[type]}, to ${recipient}`;
  const named = type === 0 && req !== null ? STANDARD_REQUEST[req] : undefined;
  return named ? `${head}: ${named}.` : `${head}.`;
};

const statusVariant = (s: TransferStatus): 'success' | 'warning' | 'error' =>
  s === TransferStatus.Ok ? 'success' : s === TransferStatus.Refused ? 'warning' : 'error';

const DeviceTransfer = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const allowed = () => imperfect()?.allowed === true;

  const [ep, setEp] = createSignal(0);
  const [setup, setSetup] = createSignal<Record<string, string>>({
    type: '0x80',
    req: '6',
    value: '0x0100',
    index: '0',
    length: '18',
  });
  const [out, setOut] = createSignal('');
  const [result, setResult] = createSignal<TransferResult | null>(null);
  const cmd = createCommand();
  const bm = () => parseNum(setup().type);

  const run = () => {
    const s = setup();
    const fields = SETUP.map((f) => parseNum(s[f.key]));
    if (fields.some((f) => f === null)) {
      cmd.run(() => Promise.reject(new Error('Every setup field must be a number.')));
      return;
    }
    const data = parseHex(out());
    if (data === null) {
      cmd.run(() => Promise.reject(new Error('Out data must be hex.')));
      return;
    }
    const [type, req, value, index, length] = fields as number[];
    setResult(null);
    cmd.run(async () => {
      setResult(await dash.link()!.transfer(ep(), type, req, value, index, length, data));
    });
  };

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="control-transfer" data-search-target>
        <Card>
          <CardHeader title="Control transfer" subtitle="Run one control request against the device" />

          <Show
            when={allowed()}
            fallback={
              <p style={muted}>
                Control transfers need <A href="/dashboard#imperfect-clone">imperfect clones</A>, on the
                Device tab.
              </p>
            }
          >
            <div style={{ ...row, 'align-items': 'flex-end' }}>
              <div style={{ 'max-width': '9rem' }}>
                <NumberInput
                  label="Endpoint number"
                  value={ep()}
                  min={0}
                  max={15}
                  onChange={(v) => setEp(v ?? 0)}
                />
              </div>
              <For each={SETUP}>
                {(f) => (
                  <div style={{ 'max-width': '9rem' }}>
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

            <p style={{ ...muted, 'margin-top': '4px' }}>
              <Show when={bm() !== null} fallback="bmRequestType must be a number.">
                {decodeSetup(bm()!, parseNum(setup().req))}
              </Show>
            </p>

            <div style={section}>
              <TextField label="Out data (hex)" value={out()} onInput={setOut} placeholder="e.g. 00 01" />
              <p style={{ ...muted, 'margin-top': '4px' }}>
                {bm() !== null && (bm()! & 0x80) === 0
                  ? 'The data stage this request carries to the device.'
                  : 'Unused: this request reads, it does not write.'}
              </p>
            </div>

            <div style={{ ...section, ...row }}>
              <Button variant="primary" disabled={cmd.busy()} onClick={run}>
                Run
              </Button>
            </div>

            <div aria-live="polite">
              <Show when={cmd.error()}>
                <div class="callout callout--danger" role="alert" style={section}>
                  {cmd.error()}
                </div>
              </Show>
              <Show when={result()}>
                {(r) => (
                  <div style={section}>
                    <div style={chips}>
                      <Chip variant={statusVariant(r().status)}>
                        {displayName(transferStatusName(r().status))}
                      </Chip>
                      <Chip variant="neutral">{r().data.length} B in</Chip>
                    </div>
                    <Show when={r().data.length > 0}>
                      <pre
                        class="diagram"
                        style={{ 'max-height': '10rem', overflow: 'auto', margin: 'var(--g-spacing-sm) 0 0' }}
                      >
                        {toHex(r().data)}
                      </pre>
                    </Show>
                  </div>
                )}
              </Show>
            </div>
          </Show>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceTransfer;
