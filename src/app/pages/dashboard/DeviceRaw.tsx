// The box drops every raw report while imperfect clones are off, so the controls hide then.

import { A } from '@solidjs/router';
import { Show, createSignal } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { TextField } from '../../../components/inputs/TextField';
import { Direction } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Panel } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';
import { RAW_DIR_BLURB, parseHex } from './hex';

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
      <Panel id="raw-report" title="Raw report">
        <Show
          when={allowed()}
          fallback={
            <p class="mut">
              Raw reports need <A href="/dashboard#imperfect-clone">imperfect clones</A>, on Device's Options tab.
            </p>
          }
        >
          <div class="acts">
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
            <div class="grow">
              <TextField label="Bytes (hex)" value={bytes()} onInput={setBytes} placeholder="e.g. 01 00 05 00" />
            </div>
          </div>

          <div class="labelled">
            <span class="field-l">Direction</span>
            <Segmented
              name="raw-dir"
              label="Direction"
              value={dir()}
              onChange={setDir}
              options={[
                { value: String(Direction.Positive), label: 'In' },
                { value: String(Direction.Negative), label: 'Out' },
              ]}
            />
          </div>
          <p class="mut">{RAW_DIR_BLURB[Number(dir())]}</p>

          <div class="acts">
            <Button variant="primary" disabled={cmd.busy()} onClick={send}>
              Send
            </Button>
          </div>
          <Show when={cmd.error()}>
            <div class="callout callout--danger" role="alert">
              {cmd.error()}
            </div>
          </Show>
        </Show>
      </Panel>
    </Show>
  );
};

export default DeviceRaw;
