import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Connection: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Connecting" subtitle="Open, find, and hand the box back" />
        <p>
          A Medius box bridges a mouse and a PC over USB-serial. The <code>medius</code> crate is the
          Rust client and <code>Device</code> is the handle; opening one finds the box, runs the{' '}
          <A href="/native/connection">handshake</A>, and starts the background threads in one call.
        </p>
        <p>See also: <A href="/library/guides/choosing-a-port">choosing a port</A>, <A href="/library/guides/threading">threading</A>, <A href="/library/guides/keepalive">keepalive &amp; teardown</A>, the <A href="/library/examples#connect">worked example</A>, and the box <A href="/native/connection#handshake">handshake</A>.</p>
      </Card>

      <div id="open" data-search-target>
        <Card>
          <CardHeader title="Open a device" subtitle="Auto-detect, or a path you already have" />
          <pre class="api-signature">fn open(path: impl AsRef&lt;Path&gt;) -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn find() -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn find_medius() -&gt; Vec&lt;PortInfo&gt;</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            <code>open</code> and <code>find</code> block on the{' '}
            <A href="/native/connection#handshake">handshake</A>. Auto-detect matches on{' '}
            <A href="/native/transport">USB identity</A> (vid <code>0x1A86</code>, pid{' '}
            <code>0x55D3</code>), the WCH CH343 bridge in every box.
          </p>
          <div class="api-response-label">FUNCTIONS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Function</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>open</code></td>
                <td>Opens a serial path you already have (Linux <code>/dev/ttyACM0</code>, Windows <code>COM3</code>).</td>
              </tr>
              <tr>
                <td><code>find</code></td>
                <td>Opens the first matching port, or returns <A href="/library/types/errors"><code>Error::NotFound</code></A>.</td>
              </tr>
              <tr>
                <td><code>find_medius</code></td>
                <td>Lists every match as a <A href="/library/types/structs#port-info"><code>PortInfo</code></A> without opening one.</td>
              </tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

// auto-detect the box:
let dev = Device::find()?;

// or, open a path you already know:
let dev = Device::open("/dev/ttyACM0")?;`}</code></pre>
        </Card>
      </div>

      <div id="zero-config" data-search-target>
        <Card>
          <CardHeader title="Zero config" subtitle="No settings struct, just two defaults" />
          <p>
            Nothing to configure; two read-only defaults bound the{' '}
            <A href="/native/commands/requests#requests"><code>QUERY</code></A> wait and keepalive timer.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Constant</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>DEFAULT_QUERY_TIMEOUT</code></td>
                <td><code>1 s</code></td>
              </tr>
              <tr>
                <td><code>DEFAULT_KEEPALIVE_CADENCE</code></td>
                <td><code>500 ms</code></td>
              </tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{DEFAULT_QUERY_TIMEOUT, DEFAULT_KEEPALIVE_CADENCE};

println!("query timeout:    {:?}", DEFAULT_QUERY_TIMEOUT);   // 1s
println!("keepalive cadence: {:?}", DEFAULT_KEEPALIVE_CADENCE); // 500ms`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="Async device" subtitle="The same link, with awaitable queries" />
          <pre class="api-signature">fn AsyncDevice::open(path: impl AsRef&lt;Path&gt;) -&gt; Result&lt;AsyncDevice&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn into_async(self) -&gt; AsyncDevice</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn into_inner(self) -&gt; Device</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            Behind the <code>async</code> feature, <code>AsyncDevice</code> turns the two reply-reading
            queries into futures; the{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A> calls stay synchronous. No{' '}
            <code>AsyncDevice::find</code>: use <code>open</code> by path or{' '}
            <code>into_async</code>, full surface on the{' '}
            <A href="/library/features/async">async feature</A> page.
          </p>
          <pre><code>cargo add medius --features async</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{AsyncDevice, Device};

// open directly as async, by path:
let dev = AsyncDevice::open("/dev/ttyACM0")?;
let version = block_on(dev.query_version())?; // awaits the reply
dev.move_rel(10, 0)?;                          // fire-and-forget, stays sync

// or convert an already-open sync device:
let dev = Device::find()?.into_async();`}</code></pre>
        </Card>
      </div>

    </>
  );
};

export default Connection;
