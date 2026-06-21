import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const GuideConnection: Component = () => {
  return (
    <>
      <div id="choosing-a-port" data-search-target>
        <Card>
          <CardHeader title="Choosing a port" subtitle="When more than one box is plugged in" />
          <p>
            <A href="/library/connection#open"><code>find</code></A> grabs the first match. With more
            than one box, <code>find_medius</code> lists every match as a{' '}
            <A href="/library/types/structs#port-info"><code>PortInfo</code></A> (<code>path</code>,{' '}
            <code>vid</code>, <code>pid</code>) without opening, then{' '}
            <A href="/library/connection#open"><code>open</code></A> the chosen one.
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

      <div id="threading" data-search-target>
        <Card>
          <CardHeader title="Threading and Clone" subtitle="Share one connection across threads" />
          <p>
            <A href="/library/connection"><code>Device</code></A> is <code>Send + Sync</code> and clones
            cheaply (an <a href="https://doc.rust-lang.org/std/sync/struct.Arc.html" target="_blank" rel="noreferrer"><code>Arc</code></a> inside),
            so one connection serves any number of threads; a clone bumps the reference count and
            doesn't reopen the port.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::thread;

let worker = device.clone();
let handle = thread::spawn(move || {
    worker.move_rel(10, 0)
});
handle.join().unwrap()?;`}</code></pre>
        </Card>
      </div>

      <div id="concurrency" data-search-target>
        <Card>
          <CardHeader title="Running queries concurrently" subtitle="join and cloning across tasks" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> clones the same way, so hand a
            clone to another task and await both queries together with{' '}
            <a href="https://docs.rs/futures/latest/futures/future/fn.join.html" target="_blank" rel="noreferrer"><code>futures::future::join</code></a>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let (v, h) = futures::future::join(
    device.query_version(),
    device.query_health(),
).await;
let v = v?;
let h = h?;
println!("{v}, link_up={}", h.link_up);`}</code></pre>
          <div class="callout callout--info">
            <p>
              Only the queries need <code>.await</code>; mutators stay synchronous on either handle.
            </p>
          </div>
        </Card>
      </div>

      <div id="keepalive" data-search-target>
        <Card>
          <CardHeader title="Keepalive and holds" subtitle="Holding injected input past the silence window" />
          <p>
            The box clears every injected button and pending move once no frame arrives for its{' '}
            <A href="/native/injection#safety">silence window</A>. A live <code>Device</code> holds your
            overrides past that on its own: a background thread (<code>medius-keepalive</code>) sends a{' '}
            <code>QUERY(HEALTH)</code> every <code>DEFAULT_KEEPALIVE_CADENCE</code> (500 ms) while
            anything is held, so a press survives. There's no <code>keepalive()</code> to call.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>Behavior</th></tr>
            </thead>
            <tbody>
              <tr><td>Override held</td><td>Sends a <code>QUERY(HEALTH)</code> every 500 ms and drops the reply.</td></tr>
              <tr><td>Idle</td><td>No override held, so the thread sends nothing.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.press(Button::Left)?;

// No further calls. The keepalive thread sends QUERY(HEALTH) on its own,
// so the hold survives well past the 1000 ms silence window.
std::thread::sleep(std::time::Duration::from_secs(5));

device.reset()?;`}</code></pre>
          <p>
            An <em>override</em> is the box holding a button down or up itself, set by{' '}
            <A href="/library/buttons#press"><code>press</code></A> or{' '}
            <A href="/library/buttons#force-release"><code>force_release</code></A>; the library keeps a
            copy. After a dropped link, <A href="/library/lifecycle#reapply"><code>reapply</code></A> and{' '}
            <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> restore it.
          </p>
        </Card>
      </div>

      <div id="release" data-search-target>
        <Card>
          <CardHeader title="Releasing the device" subtitle="Drop it; no close() call" />
          <p>
            There's no <code>close</code>: dropping the last{' '}
            <A href="#threading"><code>Arc</code>-backed handle</A> tears the connection down. Its{' '}
            <a href="https://doc.rust-lang.org/std/ops/trait.Drop.html" target="_blank" rel="noreferrer"><code>Drop</code></a>{' '}
            stops the threads and closes the port.
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
            For immediate hand-off call <A href="/library/admin#reset"><code>reset</code></A> before drop.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// hand the mouse back right now, not a second from now:
device.reset()?;   // box returns to passthrough immediately
drop(device);      // tears down threads and closes the port`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default GuideConnection;
