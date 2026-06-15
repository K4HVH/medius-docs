import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Connection: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Connecting" subtitle="Open, find, and handshake" />
        <p>
          A Medius box plugs inline between a mouse and a PC: the real mouse passes through, and your
          program sends extra mouse input over a USB-serial link. The <code>medius</code> crate is the
          Rust client; <code>Device</code> is the handle. Opening one finds the box, runs the
          handshake, and starts the background threads in a single call. The wire side is{' '}
          <A href="/native/connection">native connection</A>.
        </p>
      </Card>

      <div id="open" data-search-target>
        <Card>
          <CardHeader title="Open a device" subtitle="A path you know, or auto-detect" />
          <pre class="api-signature">fn open(path: impl AsRef&lt;Path&gt;) -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn find() -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn find_medius() -&gt; Vec&lt;PortInfo&gt;</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            Auto-detect matches on USB identity: vendor ID <code>0x1A86</code>, product ID{' '}
            <code>0x55D3</code>.
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
                <td>Opens the first matching port, or returns <A href="/library/types#errors"><code>Error::NotFound</code></A>.</td>
              </tr>
              <tr>
                <td><code>find_medius</code></td>
                <td>Lists every match as a <A href="/library/types"><code>PortInfo</code></A> (path and USB identity) without opening one.</td>
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

      <div id="handshake" data-search-target>
        <Card>
          <CardHeader title="Handshake" subtitle="Confirming a Medius box at a protocol you speak" />
          <p>
            <code>open</code> and <code>find</code> both run the handshake before returning. They send
            a <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> and wait for
            the reply, whose <code>proto_ver</code> byte names the wire-protocol version the firmware
            speaks.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Property</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Protocol version required</td>
                <td><code>proto_ver == 1</code></td>
              </tr>
              <tr>
                <td>Retries</td>
                <td><code>5</code></td>
              </tr>
              <tr>
                <td>Retry interval</td>
                <td><code>250 ms</code></td>
              </tr>
            </tbody>
          </table>
          <p>
            Both timings are fixed, not configurable. The box also sends one unsolicited{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> the moment its
            link comes up, the boot hello, so the handshake usually settles on the first attempt.
          </p>
          <p>
            The handshake fails with{' '}
            <A href="/library/types#errors"><code>NoReply</code></A> when no{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> lands within the
            five attempts,{' '}
            <A href="/library/types#errors"><code>BadProtoVer {`{ got }`}</code></A> when the box
            replies with <code>proto_ver != 1</code> (<code>got</code> carries the value), or{' '}
            <A href="/library/types#errors"><code>Io</code></A> when the serial open or read itself
            fails. All three are on <A href="/library/types#errors">Errors</A>.
          </p>
        </Card>
      </div>

      <div id="zero-config" data-search-target>
        <Card>
          <CardHeader title="Zero config" subtitle="No settings struct" />
          <p>
            Nothing to configure to connect. Two timing constants back the round-trip queries and the
            keepalive, a small frame the library sends on a timer so the box knows the link is alive.{' '}
            <code>DEFAULT_QUERY_TIMEOUT</code> is how long a{' '}
            <A href="/native/commands/requests#requests"><code>QUERY</code></A> waits for its reply;{' '}
            <code>DEFAULT_KEEPALIVE_CADENCE</code> is how often the keepalive thread fires.
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
        </Card>
      </div>

      <div id="threading" data-search-target>
        <Card>
          <CardHeader title="Threading model" subtitle="Thread-safe, cheap to clone" />
          <p>
            <code>Device</code> is <code>Send + Sync</code>, every method takes <code>&amp;self</code>,
            and it clones cheaply (an <a href="https://doc.rust-lang.org/std/sync/struct.Arc.html" target="_blank" rel="noreferrer"><code>Arc</code></a> inside), so one connection can be shared across
            threads or cloned into tasks without re-opening the port.
          </p>
          <p>
            Two background threads run per device: a reader that owns the transport, and a keepalive
            thread. Dropping the last <code>Device</code> stops both. Held-state and silence-timer
            details are on the <A href="/library/lifecycle">lifecycle</A> page; the type surface is on{' '}
            <A href="/library/types">types</A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Connection;
