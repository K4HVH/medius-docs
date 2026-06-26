import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Options: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Options" subtitle="Persistent box settings" />
        <p>
          Options are persistent box settings, each one set and read on its own. There are two:
          imperfect clones and movement riding. Both persist in NVS and survive a reboot. See the
          native <A href="/native/commands/option"><code>OPTION</code></A> command for the wire
          contract.
        </p>
        <table class="api-params">
          <thead><tr><th>Option</th><th>Set</th><th>Read</th></tr></thead>
          <tbody>
            <tr><td>imperfect clone</td><td><A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A></td><td><A href="/library/options#query-imperfect"><code>query_imperfect</code></A></td></tr>
            <tr><td>movement riding</td><td><A href="/library/options#set-movement-riding"><code>set_movement_riding</code></A></td><td><A href="/library/options#query-movement-riding"><code>query_movement_riding</code></A></td></tr>
          </tbody>
        </table>
      </Card>

      <div id="allow-imperfect-clones" data-search-target>
        <Card>
          <CardHeader title="allow_imperfect_clones" subtitle="Clone an over-capacity device anyway" />
          <pre class="api-signature">fn allow_imperfect_clones(&self, allow: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            By default the box refuses a device it can't clone faithfully. <code>true</code> opts into
            cloning an over-capacity device anyway, the rest faithful and the over-capacity interface
            dead; <code>false</code> is faithful-only (the default). It's persisted in NVS. When the
            setting changes for an <em>attached over-capacity</em> device the box reboots itself to
            re-clone, so it lands without unplugging anything; a normal device is unaffected (no reboot).
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
device.allow_imperfect_clones(true)?;   // reboots + re-clones if an over-capacity device is attached`}</code></pre>
        </Card>
      </div>

      <div id="set-movement-riding" data-search-target>
        <Card>
          <CardHeader title="set_movement_riding" subtitle="Inject motion only on a native move" />
          <pre class="api-signature">fn set_movement_riding(&self, window: Option&lt;Duration&gt;) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>Some(window)</code> turns movement riding on: injected cursor and wheel motion ride a
            native cursor-motion report seen within <code>window</code>, the box emits no synthetic
            motion frame, and motion left unridden past the window is dropped rather than dumped on the
            next move. So injected motion's report density matches the real mouse's, erasing the
            density tell. <code>None</code> turns it off (the default). The window rounds to whole
            milliseconds, a non-zero <code>Some</code> is at least 1 ms, and it clamps to 65535 ms;
            persisted in NVS.
          </p>
          <p>
            The tradeoff is deliberate: pure idle injection, moving the cursor while the user holds
            still, stops working while riding is on. Button, key, and media injection are unaffected.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>window</code></td><td><code>Option&lt;Duration&gt;</code></td><td><code>Some</code> with the ride window, or <code>None</code> to turn it off.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::time::Duration;
use medius::Device;

let device = Device::find()?;
device.set_movement_riding(Some(Duration::from_millis(20)))?;  // ride native moves
device.set_movement_riding(None)?;                             // back to gapless fill`}</code></pre>
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

      <div id="query-movement-riding" data-search-target>
        <Card>
          <CardHeader title="query_movement_riding" subtitle="Read the ride window" />
          <pre class="api-signature">fn query_movement_riding(&self) -&gt; Result&lt;Option&lt;Duration&gt;&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns the current ride window as a <code>Duration</code>, or <code>None</code> when
            movement riding is off.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
match device.query_movement_riding()? {
    Some(window) => println!("riding, window {window:?}"),
    None => println!("off"),
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="setters fire, queries await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>allow_imperfect_clones</code> and <code>set_movement_riding</code> fire-and-forget (no
            await) and makes <code>query_imperfect</code> and <code>query_movement_riding</code>
            futures, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::time::Duration;
use medius::Device;

let device = Device::find()?.into_async();
device.set_movement_riding(Some(Duration::from_millis(20)))?;  // sync, no await
let window = device.query_movement_riding().await?;            // awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Options;
