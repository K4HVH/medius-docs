import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Introduction: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Medius Rust Library" subtitle="Official Rust client" />
        <p>
          The <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer"><code>medius</code></a> crate
          injects input on top of a real mouse over a USB-serial link.
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
              <td>Crate version</td>
              <td><code>0.1.0</code></td>
            </tr>
            <tr>
              <td><a href="https://doc.rust-lang.org/edition-guide/rust-2024/index.html" target="_blank" rel="noreferrer">Edition</a></td>
              <td><code>2024</code></td>
            </tr>
            <tr>
              <td><a href="https://doc.rust-lang.org/cargo/reference/rust-version.html" target="_blank" rel="noreferrer">MSRV</a> (minimum supported Rust version)</td>
              <td><code>1.85</code></td>
            </tr>
            <tr>
              <td>License</td>
              <td><a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer"><code>MIT</code></a></td>
            </tr>
            <tr>
              <td>Transport</td>
              <td>4 Mbaud, framed-only</td>
            </tr>
            <tr>
              <td>Thread safety</td>
              <td><code>Send + Sync</code> (clone freely)</td>
            </tr>
            <tr>
              <td>Safety</td>
              <td><code>#![forbid(unsafe_code)]</code></td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div id="call-kinds" data-search-target>
        <Card>
          <CardHeader title="Three kinds of call" subtitle="Fire-and-forget, blocking query, no round-trip" />
          <p>
            The badge under each signature says which.
          </p>

          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>
          <p>
            Writes one frame, returns once the bytes are out, no reply.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.move_rel(100, -50)?; // one frame out, no reply`}</code></pre>

          <p>
            <span class="api-badge api-badge--responded">Blocks</span>
          </p>
          <p>
            Sends a <code>QUERY</code> and waits for the correlated <code>RESP</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let v = device.query_version()?; // waits for the box to reply`}</code></pre>

          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>
            Reads state the library already holds; can't fail on the link.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let c = device.counters(); // local snapshot, no network`}</code></pre>
        </Card>
      </div>

      <div id="installation" data-search-target>
        <Card>
          <CardHeader title="Installation" />
          <pre><code>cargo add medius</code></pre>
          <p>With optional features:</p>
          <pre><code>cargo add medius --features async,mock</code></pre>
          <table class="api-params">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/features/async"><code>async</code></A></td>
                <td>Runtime-agnostic <code>AsyncDevice</code>, async queries.</td>
              </tr>
              <tr>
                <td><A href="/library/features/mock"><code>mock</code></A></td>
                <td>In-process fake box for tests.</td>
              </tr>
              <tr>
                <td><A href="/library/features/flash"><code>flash</code></A></td>
                <td><a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer"><code>esptool</code></a> firmware flashing.</td>
              </tr>
              <tr>
                <td><A href="/library/features/tracing"><code>tracing</code></A></td>
                <td>Tracing instrumentation across the connection lifecycle.</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="quick-start" data-search-target>
        <Card>
          <CardHeader title="Quick start" subtitle="Connect and inject in a dozen lines" />
          <p>
            Every method returns a <A href="/library/types/errors"><code>Result</code></A>, so <code>?</code> does the rest.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, Button};

fn main() -> medius::Result<()> {
    let device = Device::find()?;
    device.move_rel(100, -50)?;
    device.press(Button::Left)?;
    device.soft_release(Button::Left)?;
    device.wheel(3)?;
    Ok(())
}`}</code></pre>
          <table class="api-params">
            <thead>
              <tr>
                <th>Method</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/connection#open"><code>find</code></A></td>
                <td>Scans the serial ports, opens the box, and runs the handshake.</td>
              </tr>
              <tr>
                <td><A href="/library/movement#move-rel"><code>move_rel</code></A></td>
                <td>Injects movement by <code>dx</code> and <code>dy</code> steps.</td>
              </tr>
              <tr>
                <td><A href="/library/buttons#methods"><code>press</code></A> / <A href="/library/buttons#methods"><code>soft_release</code></A></td>
                <td>Holds a button down, then lets go of your injected hold.</td>
              </tr>
              <tr>
                <td><A href="/library/movement#wheel"><code>wheel</code></A></td>
                <td>Scrolls.</td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              There's no plain <code>release</code>. A press is an override the box holds; clear it
              with <code>soft_release</code> (a physical hold survives), <code>force_release</code>{' '}
              (masks a physical hold too), or <code>reset</code> (clears every override). Full model
              on the <A href="/library/buttons">buttons</A> page.
            </p>
          </div>
        </Card>
      </div>

      <div id="open-the-box" data-search-target>
        <Card>
          <CardHeader title="Opening the box" subtitle="find() to auto-discover, open() for a known port" />
          <pre class="api-signature">fn find() -&gt; Result&lt;Device&gt;</pre>
          <pre class="api-signature">fn open(path: impl AsRef&lt;Path&gt;) -&gt; Result&lt;Device&gt;</pre>
          <p>
            <span class="api-badge api-badge--responded">Blocks</span>
          </p>
          <p>
            Both run the version handshake before returning.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let device = Device::find()?;                 // auto-discover by VID/PID
let device = Device::open("/dev/ttyACM0")?;  // a known port (COM3 on Windows)`}</code></pre>
          <div class="callout callout--info">
            <p>
              For several boxes at once,{' '}
              <A href="/library/connection"><code>find_medius()</code></A> returns a{' '}
              <a href="https://doc.rust-lang.org/std/vec/struct.Vec.html" target="_blank" rel="noreferrer"><code>Vec</code></a>{' '}
              of every match to pick from and pass to <code>open</code>.
            </p>
          </div>
        </Card>
      </div>

      <div id="no-hardware" data-search-target>
        <Card>
          <CardHeader title="Try it without hardware" subtitle="The mock box" />
          <p>
            An in-process <A href="/library/features/mock"><code>MockBox</code></A> records frames and auto-answers queries; needs <code>--features mock</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, MockBox, FrameType};

let mock = MockBox::new();
let device = Device::with_mock(mock.clone());
device.move_rel(10, 0)?;
assert!(mock.saw(FrameType::Move));`}</code></pre>
          <div class="callout callout--info">
            <p>
              <code>with_mock</code> skips the handshake;{' '}
              <A href="/library/features/mock"><code>Device::open_mock</code></A> exercises it.
              Builder methods (<code>with_version</code>, <code>with_health</code>,{' '}
              <code>silent</code>, <code>push_log</code>) are on the{' '}
              <A href="/library/features/mock">mock</A> page.
            </p>
          </div>
        </Card>
      </div>

      <div id="threads" data-search-target>
        <Card>
          <CardHeader title="Sharing across threads" subtitle="Clone the device" />
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>
            <code>Device</code> is <code>Clone</code> over a shared link, so a clone is a cheap
            reference bump. Clones share one serial connection and keepalive across any number of
            threads.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let d2 = device.clone();
std::thread::spawn(move || {
    let _ = d2.move_rel(5, 0);
});`}</code></pre>
        </Card>
      </div>

      <div id="reading-state" data-search-target>
        <Card>
          <CardHeader title="Reading box state" subtitle="version and health" />
          <pre class="api-signature">fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <pre class="api-signature">fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p>
            <span class="api-badge api-badge--responded">Blocks</span>
          </p>
          <p>
            Read <code>health</code> after connecting to confirm the link is up before injecting.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let v = device.query_version()?;
let h = device.query_health()?;
if h.link_up && h.mouse_attached {
    println!("{v}, mouse present");
}`}</code></pre>
          <div class="callout callout--info">
            <p>
              <A href="/library/types/structs#health"><code>Health</code></A> carries{' '}
              <code>link_up</code>, <code>mouse_attached</code>, <code>clone_configured</code>, and{' '}
              <code>injection_active</code>. Field tables are on the{' '}
              <A href="/library/types">types</A> page; the queries under{' '}
              <A href="/library/requests">requests</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="Async" subtitle="AsyncDevice and block_on" />
          <p>
            <span class="api-badge api-badge--responded">Blocks</span>
          </p>
          <p>
            <A href="/library/features/async"><code>into_async</code></A> makes the two queries <code>async fn</code>s; needs <code>--features async</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let device = Device::find()?.into_async();
device.move_rel(10, 0)?; // still synchronous, no .await
let v = futures::executor::block_on(device.query_version())?;`}</code></pre>
        </Card>
      </div>

      <div id="lifecycle" data-search-target>
        <Card>
          <CardHeader title="Keepalive and reconnect" subtitle="What the background threads do" />
          <p>
            A live <code>Device</code> runs two background threads, a frame reader and a <A href="/library/lifecycle"><code>DEFAULT_KEEPALIVE_CADENCE</code></A> keepalive.
          </p>
          <div class="callout callout--info">
            <p>
              A press holds only while a <code>Device</code> is alive; dropping the last handle clears
              the override and returns the box to passthrough. Full detail on the{' '}
              <A href="/library/lifecycle">keepalive and reconnect</A> page.
            </p>
          </div>
        </Card>
      </div>

      <div id="complete-example" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Connect, inspect, inject, measure" />
          <p>
            Open, print version and health, inject a move and click, reset, then print counters.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device};

fn main() -> medius::Result<()> {
    let device = match std::env::args().nth(1) {
        Some(path) => Device::open(path)?,
        None => Device::find()?,
    };

    let version = device.query_version()?;
    let health = device.query_health()?;
    println!("connected: {version}");
    println!(
        "health: link_up={} mouse_attached={} clone_configured={} injection_active={}",
        health.link_up, health.mouse_attached, health.clone_configured, health.injection_active,
    );

    device.move_rel(40, 0)?;

    device.press(Button::Left)?;
    device.soft_release(Button::Left)?;

    device.reset()?;

    println!("counters: {:?}", device.counters());
    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="getting-started" data-search-target>
        <Card>
          <CardHeader title="Getting started" />
          <div class="docs-grid">
            <A href="/library/connection" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Connection" subtitle="Open, find, handshake" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="api" data-search-target>
        <Card>
          <CardHeader title="API" />
          <div class="docs-grid">
            <A href="/library/movement" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Movement" subtitle="move_rel, wheel" />
              </Card>
            </A>
            <A href="/library/buttons" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Buttons" subtitle="press, release, force-release" />
              </Card>
            </A>
            <A href="/library/requests" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Requests" subtitle="query_version, query_health" />
              </Card>
            </A>
            <A href="/library/admin" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Admin" subtitle="reset, reboot" />
              </Card>
            </A>
            <A href="/library/lifecycle" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Keepalive & reconnect" subtitle="Holding the link open" />
              </Card>
            </A>
            <A href="/library/diagnostics" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Logs & counters" subtitle="logs, counters" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="features" data-search-target>
        <Card>
          <CardHeader title="Features" />
          <div class="docs-grid">
            <A href="/library/features/async" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="async" subtitle="AsyncDevice" />
              </Card>
            </A>
            <A href="/library/features/mock" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="mock" subtitle="In-process fake box" />
              </Card>
            </A>
            <A href="/library/features/flash" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="flash" subtitle="esptool flashing" />
              </Card>
            </A>
            <A href="/library/features/tracing" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="tracing" subtitle="Structured diagnostics" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="reference" data-search-target>
        <Card>
          <CardHeader title="Reference" />
          <div class="docs-grid">
            <A href="/library/types" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Types & errors" subtitle="Enums, Result, Error" />
              </Card>
            </A>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Introduction;
