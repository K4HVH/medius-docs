import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Imperfect: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Imperfect" subtitle="Opt into cloning an over-capacity device" />
        <p>
          By default the box refuses a device it can't clone faithfully.{' '}
          <A href="/library/imperfect#set-imperfect-allowed"><code>set_imperfect_allowed</code></A>{' '}
          opts into cloning it anyway, the rest faithful and the over-capacity interface dead.{' '}
          <A href="/library/imperfect#imperfect"><code>imperfect</code></A> reads the state back. See
          the native <A href="/native/commands/imperfect"><code>IMPERFECT</code></A> command for the wire
          contract.
        </p>
      </Card>

      <div id="set-imperfect-allowed" data-search-target>
        <Card>
          <CardHeader title="set_imperfect_allowed" subtitle="Opt in or out" />
          <pre class="api-signature">fn set_imperfect_allowed(&self, allow: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>true</code> opts into cloning an over-capacity device, <code>false</code> is
            faithful-only (the default). The box persists it and applies it on the next clone, so
            re-plug the device or reboot the box for the change to land.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>allow</code></td><td><code>bool</code></td><td>Clone an over-capacity device anyway, or stay faithful-only.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
device.set_imperfect_allowed(true)?;   // re-plug the device for it to take effect`}</code></pre>
        </Card>
      </div>

      <div id="imperfect" data-search-target>
        <Card>
          <CardHeader title="imperfect" subtitle="Read the imperfect-clone state" />
          <pre class="api-signature">fn imperfect(&self) -&gt; Result&lt;ImperfectStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns an{' '}
            <A href="/library/types/structs#imperfect-status"><code>ImperfectStatus</code></A>: the
            opt-in toggle, whether the attached device is over-capacity, and whether the live clone went
            over-capacity anyway with one interface dead.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
let status = device.imperfect()?;
if status.over_capacity && !status.allowed {
    // the device was refused; opt in to clone it imperfectly
    device.set_imperfect_allowed(true)?;
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="set fires, imperfect awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>set_imperfect_allowed</code> fire-and-forget (no await) and makes{' '}
            <code>imperfect</code> a future, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::AsyncDevice;

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.set_imperfect_allowed(true)?;       // sync, no await
let status = device.imperfect().await?;    // awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Imperfect;
