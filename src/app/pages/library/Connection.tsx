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
        <p>
          A full open-handshake-use-release program is at the{' '}
          <A href="/library/connection#complete-example">bottom of the page</A>.
        </p>
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
            <A href="/library/connection#handshake">handshake</A>. Auto-detect matches on{' '}
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

      <div id="choosing-a-port" data-search-target>
        <Card>
          <CardHeader title="Choosing a port" subtitle="When more than one box is plugged in" />
          <p>
            <code>find</code> grabs the first match. With more than one box, <code>find_medius</code>{' '}
            lists every match as a{' '}
            <A href="/library/types/structs#port-info"><code>PortInfo</code></A> (<code>path</code>,{' '}
            <code>vid</code>, <code>pid</code>) without opening, then <code>open</code> the chosen one.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, find_medius};

let ports = find_medius();
for port in &ports {
    println!("{} (vid={:#06x} pid={:#06x})", port.path, port.vid, port.pid);
}

// open a chosen one (here, the first):
let port = ports.first().ok_or(medius::Error::NotFound)?;
let dev = Device::open(&port.path)?;`}</code></pre>
        </Card>
      </div>

      <div id="handshake" data-search-target>
        <Card>
          <CardHeader title="Handshake" subtitle="Confirming a Medius box at a protocol you speak" />
          <p>
            <code>open</code> and <code>find</code> send a{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> and check its{' '}
            <code>proto_ver</code>.
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
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, Error};

let dev = match Device::find() {
    Ok(dev) => dev,
    Err(Error::NotFound) => {
        eprintln!("no box plugged in");
        return;
    }
    Err(Error::BadProtoVer { got }) => {
        eprintln!("box speaks proto {got}, this crate speaks 1; update one of them");
        return;
    }
    Err(e) => {
        eprintln!("could not connect: {e}");
        return;
    }
};`}</code></pre>
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

      <div id="threading" data-search-target>
        <Card>
          <CardHeader title="Threading model" subtitle="Thread-safe, cheap to clone" />
          <p>
            <code>Device</code> is <code>Send + Sync</code> and clones cheaply (an <a href="https://doc.rust-lang.org/std/sync/struct.Arc.html" target="_blank" rel="noreferrer"><code>Arc</code></a> inside), so one connection shares across threads.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::thread;

// clone is cheap (bumps an Arc); the port is not re-opened:
let worker = device.clone();
let handle = thread::spawn(move || {
    worker.move_rel(10, 0)
});
handle.join().unwrap()?;`}</code></pre>
        </Card>
      </div>

      <div id="reconnect" data-search-target>
        <Card>
          <CardHeader title="Losing and regaining the link" subtitle="Auto-reconnect, and the manual call" />
          <p>
            On a dropped link the reader thread reconnects on its own: rescan by VID/PID, reopen,
            re-apply <A href="/library/buttons#methods">held button overrides</A>, and bump the{' '}
            <A href="/library/diagnostics#counters"><code>reconnects</code></A> counter, backing off
            between tries. <code>Device::reconnect</code> forces the same routine, detailed on{' '}
            <A href="/library/lifecycle#reconnect">lifecycle</A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// force a rescan-reopen-reapply now; the reader thread runs this same routine
// automatically on a dropped link:
device.reconnect()?;`}</code></pre>
        </Card>
      </div>

      <div id="release" data-search-target>
        <Card>
          <CardHeader title="Releasing the device" subtitle="Drop it; no close() call" />
          <p>
            No <code>close</code> method: the last{' '}
            <A href="/library/connection#threading"><code>Arc</code>-backed handle</A>'s{' '}
            <a href="https://doc.rust-lang.org/std/ops/trait.Drop.html" target="_blank" rel="noreferrer"><code>Drop</code></a>{' '}
            tears the connection down.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Step</th><th>What drop does</th></tr>
            </thead>
            <tbody>
              <tr><td>Signal</td><td>Sets the stop flag the reader and keepalive threads watch.</td></tr>
              <tr><td>Join</td><td>Waits for both threads to exit, so none are left running.</td></tr>
              <tr><td>Close</td><td>Releases the serial port as the transport drops.</td></tr>
            </tbody>
          </table>
          <p>
            For immediate hand-off call{' '}
            <A href="/library/admin#reset"><code>reset</code></A> before drop.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// hand the mouse back right now, not a second from now:
device.reset()?;   // box returns to passthrough immediately
drop(device);      // tears down threads and closes the port`}</code></pre>
        </Card>
      </div>

      <div id="complete-example" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Open, handshake, use, release" />
          <p>
            Open, handshake, move, click, hand back with <code>reset</code>, print the{' '}
            <A href="/library/diagnostics#counters">counters</A>, and drop.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device, Error};

fn main() -> medius::Result<()> {
    // open by path if one is given, else auto-detect:
    let device = match std::env::args().nth(1) {
        Some(path) => Device::open(path)?,
        None => match Device::find() {
            Ok(device) => device,
            Err(Error::NotFound) => {
                eprintln!("no box found; plug one in");
                return Ok(());
            }
            Err(Error::BadProtoVer { got }) => {
                eprintln!("box speaks proto {got}, this crate speaks 1");
                return Ok(());
            }
            Err(e) => return Err(e),
        },
    };

    let version = device.query_version()?;
    println!("connected: {version}");

    device.move_rel(40, 0)?;       // 40 units right
    device.press(Button::Left)?;   // hold left
    device.soft_release(Button::Left)?;

    device.reset()?;               // back to passthrough now

    println!("counters: {:?}", device.counters());
    Ok(())
    // device drops here: threads stop, port closes
}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Connection;
