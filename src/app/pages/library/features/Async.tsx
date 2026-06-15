import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Async: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Async" subtitle="AsyncDevice on any executor" />
        <p>
          <code>AsyncDevice</code> is <A href="/library/connection"><code>Device</code></A> with its two
          queries as futures, behind the off-by-default <code>async</code> flag.
        </p>
        <pre><code>cargo add medius --features async</code></pre>
        <p>
          Reply waits use <a href="https://crates.io/crates/flume" target="_blank" rel="noreferrer"><code>flume</code></a>, so futures run under any executor, no <a href="https://tokio.rs" target="_blank" rel="noreferrer"><code>tokio</code></a>.
        </p>
        <pre><code>cargo add futures</code></pre>
        <p>
          <code>Result</code> is the fallible return type (see <A href="/library/types/errors">Errors</A>).
        </p>
      </Card>

      <div id="why-async" data-search-target>
        <Card>
          <CardHeader title="Why only two calls are async" subtitle="Queries await a reply, everything else fires and forgets" />
          <p>
            <code>query_version</code> and <code>query_health</code> are the only <code>async fn</code>s, because a{' '}
            <A href="/native/commands/requests#requests"><code>QUERY</code></A> blocks for its correlated{' '}
            <A href="/native/commands/requests#resp"><code>RESP</code></A> and returns the{' '}
            <A href="/library/types"><code>Version</code> and <code>Health</code></A> structs; every other method
            is <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
          </p>
          <p>
            <span class="api-badge api-badge--responded">Blocks</span> marks a call you <code>.await</code>;{' '}
            <span class="api-badge api-badge--executed">Fire-and-forget</span> marks one that returns at once.
          </p>

          <div class="api-response-label">METHOD SPLIT</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Async (you <code>.await</code> it)</th>
                <th>Stays sync (no <code>.await</code>)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/requests#version"><code>query_version</code></A></td>
                <td>
                  <A href="/library/movement#move-rel"><code>move_rel</code></A>,{' '}
                  <A href="/library/movement#wheel"><code>wheel</code></A>,{' '}
                  <A href="/library/buttons#methods"><code>button</code></A>,{' '}
                  <A href="/library/buttons#methods"><code>press</code></A>
                </td>
              </tr>
              <tr>
                <td><A href="/library/requests#health"><code>query_health</code></A></td>
                <td>
                  <A href="/library/buttons#methods"><code>soft_release</code></A>,{' '}
                  <A href="/library/buttons#methods"><code>force_release</code></A>,{' '}
                  <A href="/library/admin#reset"><code>reset</code></A>,{' '}
                  <A href="/library/admin#reboot"><code>reboot</code></A>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="construction" data-search-target>
        <Card>
          <CardHeader title="Constructing an AsyncDevice" subtitle="open, into_async, into_inner" />

          <pre class="api-signature">fn open(path: impl AsRef&lt;Path&gt;) -&gt; Result&lt;AsyncDevice&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn into_async(self) -&gt; AsyncDevice</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn into_inner(self) -&gt; Device</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>

          <div class="api-response-label">CONSTRUCTORS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Constructor</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>open</code></td>
                <td>
                  Takes a serial-port path, opens it, and runs the handshake. It blocks like{' '}
                  <A href="/library/connection#open"><code>Device::open</code></A>, then hands back an{' '}
                  <code>AsyncDevice</code>.
                </td>
              </tr>
              <tr>
                <td><code>into_async</code></td>
                <td>
                  Reinterprets an already-open{' '}
                  <A href="/library/connection"><code>Device</code></A> as an <code>AsyncDevice</code>. It's
                  zero-cost over the same <code>Link</code> core, no new connection.
                </td>
              </tr>
              <tr>
                <td><code>into_inner</code></td>
                <td>Hands the sync <code>Device</code> back, so you can reach the diagnostics methods.</td>
              </tr>
            </tbody>
          </table>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// reinterpret an already-open Device (handshake ran during find)
let device = Device::find()?.into_async();

// or open a path directly (this one runs the handshake and blocks)
let device = AsyncDevice::open("/dev/ttyACM0")?;`}</code></pre>

          <div class="callout callout--info">
            <p>
              <A href="/library/diagnostics#counters"><code>counters</code></A> and{' '}
              <A href="/library/diagnostics#logs"><code>logs</code></A> live on{' '}
              <A href="/library/connection"><code>Device</code></A>, not <code>AsyncDevice</code>; call{' '}
              <code>into_inner()</code> for the sync handle.
            </p>
          </div>
        </Card>
      </div>

      <div id="queries" data-search-target>
        <Card>
          <CardHeader title="Awaiting a query" subtitle="query_version and query_health as futures" />

          <pre class="api-signature">async fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">async fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Each future awaits the correlated <A href="/native/commands/requests#resp"><code>RESP</code></A>{' '}
            with the default timeout, then resolves to its struct.
          </p>

          <div class="api-response-label">RETURNS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Method</th>
                <th>Resolves to</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>query_version().await</code></td>
                <td><A href="/library/types/structs#version"><code>Version</code></A></td>
                <td>Firmware identity.</td>
              </tr>
              <tr>
                <td><code>query_health().await</code></td>
                <td><A href="/library/types/structs#health"><code>Health</code></A></td>
                <td>Whether the box is wired and ready.</td>
              </tr>
            </tbody>
          </table>

          <p>
            <code>.await</code> is only legal inside an <code>async</code> function or block.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`async fn run(device: &AsyncDevice) -> medius::Result<()> {
    let v = device.query_version().await?;
    let h = device.query_health().await?;
    println!("{v}, link_up={}", h.link_up);
    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="block-on" data-search-target>
        <Card>
          <CardHeader title="Driving futures without a runtime" subtitle="futures::executor::block_on" />
          <p>
            <a href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html" target="_blank" rel="noreferrer"><code>block_on</code></a>{' '}
            runs one future to completion on the current thread, no runtime needed.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;

let device = Device::find()?.into_async();
let v = block_on(device.query_version())?;
println!("{v}");`}</code></pre>

          <div class="callout callout--info">
            <p>
              Inside an async <code>main</code>, <code>.await</code> the same future instead; it runs unchanged under{' '}
              <a href="https://tokio.rs" target="_blank" rel="noreferrer"><code>tokio</code></a>,{' '}
              <a href="https://crates.io/crates/async-std" target="_blank" rel="noreferrer"><code>async-std</code></a>, or{' '}
              <a href="https://crates.io/crates/smol" target="_blank" rel="noreferrer"><code>smol</code></a>.
            </p>
          </div>
        </Card>
      </div>

      <div id="timeouts" data-search-target>
        <Card>
          <CardHeader title="When the box is silent" subtitle="Default timeout and QueryTimeout" />
          <p>
            A query waits <A href="/library/connection"><code>DEFAULT_QUERY_TIMEOUT</code></A> (1 second), then returns <code>Err(Error::QueryTimeout)</code>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`match device.query_health().await {
    Ok(h) => println!("{h:?}"),
    Err(medius::Error::QueryTimeout) => eprintln!("no reply in time"),
    Err(e) => return Err(e),
}`}</code></pre>

          <div class="callout callout--info">
            <p>
              <code>QueryTimeout</code> means silence; <code>NoReply</code> means a reply arrived but didn't parse.
              Both are on the <A href="/library/types/errors">Errors</A> page.
            </p>
          </div>
        </Card>
      </div>

      <div id="concurrency" data-search-target>
        <Card>
          <CardHeader title="Running queries concurrently" subtitle="join and cloning across tasks" />
          <p>
            <a href="https://docs.rs/futures/latest/futures/future/fn.join.html" target="_blank" rel="noreferrer"><code>futures::future::join</code></a> polls both queries together.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let (v, h) = futures::future::join(
    device.query_version(),
    device.query_health(),
).await;
let v = v?;
let h = h?;
println!("{v}, link_up={}", h.link_up);`}</code></pre>

          <p>
            <code>AsyncDevice</code> is <code>Clone</code> over a shared <code>Link</code>, so hand a clone to another task.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let mover = device.clone();
mover.move_rel(40, 0)?;                     // fire-and-forget, no .await
let v = device.query_version().await?;      // awaited on the other handle`}</code></pre>

          <div class="callout callout--info">
            <p>
              Mutators never block; only the two queries need <code>.await</code>.
            </p>
          </div>
        </Card>
      </div>

      <div id="mock" data-search-target>
        <Card>
          <CardHeader title="Testing async code" subtitle="AsyncDevice over a MockBox" />
          <p>
            With <A href="/library/features/mock"><code>mock</code></A> on alongside <code>async</code>,{' '}
            <code>with_mock</code> drives an <code>AsyncDevice</code> over a fake box, skipping the handshake.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{Device, MockBox, Version};

let mock = MockBox::new().with_version(Version {
    proto_ver: 1,
    fw_major: 1,
    fw_minor: 2,
    fw_patch: 3,
});
let device = Device::with_mock(mock).into_async();
let v = block_on(device.query_version())?;
assert_eq!((v.fw_major, v.fw_minor, v.fw_patch), (1, 2, 3));`}</code></pre>

          <p>
            A <code>silent</code> box never answers, so the query resolves to{' '}
            <code>Err(Error::QueryTimeout)</code>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{Device, Error, MockBox};

let device = Device::with_mock(MockBox::new().silent()).into_async();
let err = block_on(device.query_version()).unwrap_err();
assert!(matches!(err, Error::QueryTimeout));`}</code></pre>
        </Card>
      </div>

      <div id="full-example" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Open, query concurrently, move, all in one file" />
          <p>
            Open the first box, run both queries together, fire a move, reset, then hand the sync handle back
            to read counters.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{Device, Result};

fn main() -> Result<()> {
    let device = Device::find()?.into_async();

    let (v, h) = block_on(futures::future::join(
        device.query_version(),
        device.query_health(),
    ));
    let v = v?;
    let h = h?;
    println!("connected: {v}");
    println!("link_up={} mouse_attached={}", h.link_up, h.mouse_attached);

    device.move_rel(40, 0)?;   // fire-and-forget, no .await
    device.reset()?;

    // counters live on the sync Device, so hand it back
    let device = device.into_inner();
    println!("counters: {:?}", device.counters());
    Ok(())
}`}</code></pre>

          <div class="callout callout--info">
            <p>
              The other features are <A href="/library/features/mock"><code>mock</code></A>,{' '}
              <A href="/library/features/flash"><code>flash</code></A>, and{' '}
              <A href="/library/features/tracing"><code>tracing</code></A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Async;
