// Run one control request against the real device and show what it answered.

import { For, Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { TextField } from '../../../components/inputs/TextField';
import { type TransferResult, TransferStatus, transferStatusName } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { chips, muted, row, section } from './ui';
import { SETUP_DEFAULT, SETUP_FIELDS, decodeSetup, displayName, outDataBlurb, parseHex, parseNum, toHex } from './hex';

const statusVariant = (s: TransferStatus): 'success' | 'warning' | 'error' =>
  s === TransferStatus.Ok ? 'success' : s === TransferStatus.Refused ? 'warning' : 'error';

const DeviceTransfer = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const allowed = () => imperfect()?.allowed === true;

  const [ep, setEp] = createSignal(0);
  const [setup, setSetup] = createSignal<Record<string, string>>(SETUP_DEFAULT);
  const [out, setOut] = createSignal('');
  const [result, setResult] = createSignal<TransferResult | null>(null);
  const cmd = createCommand();
  const bm = () => parseNum(setup().type);

  const run = () => {
    const s = setup();
    const fields = SETUP_FIELDS.map((f) => parseNum(s[f.key]));
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
          <CardHeader title="Control transfer" subtitle="Ask the real device and read its answer" />

          <Show
            when={allowed()}
            fallback={
              <p style={muted}>
                Control transfers need imperfect clones, on the Device tab.
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
              <For each={SETUP_FIELDS}>
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
                {outDataBlurb(bm())}
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
