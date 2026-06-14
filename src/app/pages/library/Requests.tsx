import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Requests: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Requests" subtitle="Reading the box's state" />
        <p>
          Most commands are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: you send, the box never
          answers. The exception is{' '}
          <A href="/native/commands/requests#requests"><code>QUERY</code></A>, which gets one{' '}
          <A href="/native/commands/requests#resp"><code>RESP</code></A> frame back. Both methods here
          block on that round-trip: they send the <code>QUERY</code>, wait for the matching{' '}
          <code>RESP</code>, and return the parsed reply or an error if none arrives in time.
        </p>
      </Card>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="query_version" subtitle="Firmware identity" />
          <pre class="api-signature">fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <div class="api-response-label">RETURNS</div>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>proto_ver</code></td><td>Protocol version, currently <code>1</code>.</td></tr>
              <tr><td><code>fw_major</code></td><td>Firmware major version.</td></tr>
              <tr><td><code>fw_minor</code></td><td>Firmware minor version.</td></tr>
              <tr><td><code>fw_patch</code></td><td>Firmware patch version.</td></tr>
            </tbody>
          </table>
          <p>
            Round-trip (<A href="/native/commands/requests#requests"><code>QUERY</code></A> →{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A>) with the default
            1-second timeout. The <code>what</code> selector <code>0</code> picks the firmware identity.
            Returns a <A href="/library/types#structs"><code>Version</code></A>; <code>Display</code>{' '}
            formats it as <code>fw M.m.p</code>. No reply within the timeout yields{' '}
            <A href="/library/types#errors"><code>QueryTimeout</code></A>.
          </p>
          <pre><code>{`let v = device.query_version()?;
println!("{v}");`}</code></pre>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="query_health" subtitle="Chain status" />
          <pre class="api-signature">fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <div class="api-response-label">RETURNS</div>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>True when</th></tr>
            </thead>
            <tbody>
              <tr><td><code>link_up</code></td><td>Link to the host chip is established.</td></tr>
              <tr><td><code>mouse_attached</code></td><td>A real mouse is plugged in.</td></tr>
              <tr><td><code>clone_configured</code></td><td>The PC has set up the <A href="/native/injection">cloned mouse</A>.</td></tr>
              <tr><td><code>injection_active</code></td><td>The box is feeding in <A href="/native/injection">injected</A> input.</td></tr>
            </tbody>
          </table>
          <p>
            Round-trip (<A href="/native/commands/requests#requests"><code>QUERY</code></A> →{' '}
            <A href="/native/commands/requests#health"><code>RESP(HEALTH)</code></A>) with{' '}
            <code>what</code> selector <code>1</code>. Returns a{' '}
            <A href="/library/types#structs"><code>Health</code></A>, the status byte unpacked into four
            booleans. Confirms the chain (real mouse → box → PC) is live before you rely on injection.
          </p>
          <pre><code>{`let h = device.query_health()?;
if h.mouse_attached && h.clone_configured {
    // ready to inject
}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Requests;
