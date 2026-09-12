// Put bytes verbatim on one cloned endpoint.
//
// The box drops a report for an endpoint no clone serves, and drops every report while imperfect
// clones are off, so the card stands its body down rather than reporting a send that went nowhere.

import { Show, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import { Direction } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { label, muted, row, section } from './ui';
import { parseHex } from './hex';

// Where the bytes land, which is the whole meaning of the direction sitting above it.
const DIR_BLURB: Record<number, string> = {
  [Direction.Positive]: 'The report reaches the game PC.',
  [Direction.Negative]: 'The report reaches the device.',
};

const DeviceRaw = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const allowed = () => imperfect()?.allowed === true;

  const [ep, setEp] = createSignal(1);
  const [dir, setDir] = createSignal(String(Direction.Positive));
  const [bytes, setBytes] = createSignal('');
  const cmd = createCommand();

  const send = () => {
    const b = parseHex(bytes());
    if (b === null || b.length === 0) {
      cmd.run(() => Promise.reject(new Error('Enter the bytes to put on the endpoint.')));
      return;
    }
    cmd.run(() => dash.link()!.raw(ep(), Number(dir()), b));
  };

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="raw-report" data-search-target>
        <Card>
          <CardHeader title="Raw report" subtitle="Put bytes on a cloned endpoint" />

          <Show
            when={allowed()}
            fallback={
              <p style={muted}>
                Raw reports need <A href="/dashboard#imperfect-clone">imperfect clones</A>, on the
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
              <div style={{ flex: '1 1 240px' }}>
                <TextField label="Bytes (hex)" value={bytes()} onInput={setBytes} placeholder="e.g. 01 00 05 00" />
              </div>
            </div>

            <div style={section}>
              <div style={label}>Direction</div>
              <RadioGroup
                name="raw-dir"
                value={dir()}
                onChange={setDir}
                options={[
                  { value: String(Direction.Positive), label: 'In' },
                  { value: String(Direction.Negative), label: 'Out' },
                ]}
              />
              <p style={{ ...muted, 'margin-top': '4px' }}>{DIR_BLURB[Number(dir())]}</p>
            </div>

            <div style={{ ...section, ...row }}>
              <Button variant="primary" disabled={cmd.busy()} onClick={send}>
                Send
              </Button>
            </div>
            <p style={{ ...muted, 'margin-top': '4px' }}>
              The box drops a report for an endpoint no clone serves.
            </p>
            <Show when={cmd.error()}>
              <div class="callout callout--danger" role="alert" style={section}>
                {cmd.error()}
              </div>
            </Show>
          </Show>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceRaw;
