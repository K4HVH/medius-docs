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
          <code>AsyncDevice</code> is <A href="/library/connection"><code>Device</code></A> with its
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
        <p>See also: <A href="/library/guides/calls#call-kinds">call kinds &amp; timeouts</A>, <A href="/library/guides/connection#threading">concurrency</A>, <A href="/library/guides/testing#testing">testing</A>.</p>
      </Card>

      <div id="construction" data-search-target>
        <Card>
          <CardHeader title="Constructing an AsyncDevice" subtitle="open, find, into_async, into_inner" />

          <pre class="api-signature">fn open(path: impl AsRef&lt;Path&gt;) -&gt; Result&lt;AsyncDevice&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn find() -&gt; Result&lt;AsyncDevice&gt;</pre>
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
                <td><code>find</code></td>
                <td>
                  Discovers the first medius box by USB id, opens it, and runs the handshake. Blocks
                  like <A href="/library/connection#open"><code>Device::find</code></A>, then hands
                  back an <code>AsyncDevice</code>.
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
                <td>Hands the sync <code>Device</code> back.</td>
              </tr>
            </tbody>
          </table>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// discover and open in one call (runs the handshake, blocks)
let device = AsyncDevice::find()?;

// or by path:
let device = AsyncDevice::open("/dev/ttyACM0")?;

// or reinterpret an already-open Device:
let device = Device::find()?.into_async();`}</code></pre>

          <div class="callout callout--info">
            <p>
              Everything else on <A href="/library/connection"><code>Device</code></A> is mirrored on{' '}
              <code>AsyncDevice</code> and stays synchronous — including{' '}
              <A href="/library/diagnostics#counters"><code>counters</code></A>,{' '}
              <A href="/library/diagnostics#logs"><code>logs</code></A>,{' '}
              <A href="/library/lifecycle#from-async"><code>reapply</code></A>, and{' '}
              <A href="/library/lifecycle#from-async"><code>reconnect</code></A>. Only the queries
              are futures.
            </p>
          </div>
        </Card>
      </div>

      <div id="queries" data-search-target>
        <Card>
          <CardHeader title="Awaiting a query" subtitle="every query method is a future" />

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

    </>
  );
};

export default Async;
