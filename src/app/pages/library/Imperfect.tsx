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
          <A href="/library/imperfect#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
          opts into cloning it anyway, the rest faithful and the over-capacity interface dead.{' '}
          <A href="/library/imperfect#query-imperfect"><code>query_imperfect</code></A> reads the state back. See
          the native <A href="/native/commands/imperfect"><code>IMPERFECT</code></A> command for the wire
          contract.
        </p>
      </Card>

      <div id="allow-imperfect-clones" data-search-target>
        <Card>
          <CardHeader title="allow_imperfect_clones" subtitle="Opt in or out" />
          <pre class="api-signature">fn allow_imperfect_clones(&self, allow: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>true</code> opts into cloning an over-capacity device, <code>false</code> is
            faithful-only (the default). The box persists it in NVS and reboots itself to re-clone with
            the new setting, so it lands without unplugging anything.
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
device.allow_imperfect_clones(true)?;   // the box reboots itself and re-clones`}</code></pre>
        </Card>
      </div>

      <div id="query-imperfect" data-search-target>
        <Card>
          <CardHeader title="query_imperfect" subtitle="Read the imperfect-clone state" />
          <pre class="api-signature">fn query_imperfect(&self) -&gt; Result&lt;ImperfectStatus&gt;</pre>
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
let status = device.query_imperfect()?;
if status.over_capacity && !status.allowed {
    // the device was refused; opt in to clone it imperfectly
    device.allow_imperfect_clones(true)?;
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="set fires, query_imperfect awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>allow_imperfect_clones</code> fire-and-forget (no await) and makes{' '}
            <code>query_imperfect</code> a future, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::AsyncDevice;

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.allow_imperfect_clones(true)?;       // sync, no await
let status = device.query_imperfect().await?;    // awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Imperfect;
