import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Async: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Async" subtitle="AsyncDevice with any runtime" />
        <p>
          <code>AsyncDevice</code> is <A href="/library/connection"><code>Device</code></A> with its two
          reply-reading calls turned into futures you <code>.await</code>, so they don't block the thread
          while the box answers. Everything else behaves as the sync API does.
        </p>
        <p>
          It's behind the <code>async</code> feature flag, off by default. Enable it with{' '}
          <code>cargo add medius --features async</code>.
        </p>
      </Card>

      <div id="asyncdevice" data-search-target>
        <Card>
          <CardHeader title="AsyncDevice" subtitle="Construction and what stays sync" />

          <pre class="api-signature">fn open(path: impl AsRef&lt;Path&gt;) -&gt; Result&lt;AsyncDevice&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre class="api-signature">fn into_async(self) -&gt; AsyncDevice</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn into_inner(self) -&gt; Device</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>

          <p>
            <code>Result</code> is the library's fallible return type (see{' '}
            <A href="/library/types#errors">Errors</A>).
          </p>

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
                <td>Takes a serial-port path and connects directly.</td>
              </tr>
              <tr>
                <td><code>into_async</code></td>
                <td>Converts an existing <A href="/library/connection"><code>Device</code></A>.</td>
              </tr>
              <tr>
                <td><code>into_inner</code></td>
                <td>Turns an <code>AsyncDevice</code> back into a <code>Device</code>.</td>
              </tr>
            </tbody>
          </table>

          <p>
            The wait on a reply uses <a href="https://crates.io/crates/flume" target="_blank" rel="noreferrer"><code>flume</code></a>'s async receive channel, which pulls in no{' '}
            <a href="https://tokio.rs" target="_blank" rel="noreferrer"><code>tokio</code></a> dependency, so it runs under any executor (<code>tokio</code>,{' '}
            <a href="https://crates.io/crates/async-std" target="_blank" rel="noreferrer"><code>async-std</code></a>, <a href="https://crates.io/crates/smol" target="_blank" rel="noreferrer"><code>smol</code></a>).
          </p>

          <p>
            Only the two queries are async, since they're the only calls that wait for a reply: a{' '}
            <A href="/native/commands/requests#requests"><code>QUERY</code></A> gets one{' '}
            <A href="/native/commands/requests#resp"><code>RESP</code></A>.
          </p>

          <div class="api-response-label">QUERIES</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Query</th>
                <th>Returns</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/requests#version"><code>query_version().await</code></A></td>
                <td><A href="/library/types#structs"><code>Version</code></A></td>
                <td>Firmware identity.</td>
              </tr>
              <tr>
                <td><A href="/library/requests#health"><code>query_health().await</code></A></td>
                <td><A href="/library/types#structs"><code>Health</code></A></td>
                <td>Whether the box is wired and ready.</td>
              </tr>
            </tbody>
          </table>

          <p>
            Every other method is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>: the box never answers, so
            the call stays synchronous and returns once the frame is queued, unchanged from the sync
            API. These are{' '}
            <A href="/library/movement#move-rel"><code>move_rel</code></A>,{' '}
            <A href="/library/movement#wheel"><code>wheel</code></A>,{' '}
            <A href="/library/buttons#methods"><code>button</code></A>,{' '}
            <A href="/library/buttons#methods"><code>press</code></A>,{' '}
            <A href="/library/buttons#methods"><code>soft_release</code></A>,{' '}
            <A href="/library/buttons#methods"><code>force_release</code></A>,{' '}
            <A href="/library/admin#reset"><code>reset</code></A>, and{' '}
            <A href="/library/admin#reboot"><code>reboot</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let device = Device::find()?.into_async();
device.move_rel(10, 0)?;       // dx=10, dy=0: 10 units right, sync
let v = device.query_version().await?;`}</code></pre>

          <p>
            <code>find</code> opens the first box and runs the handshake (see{' '}
            <A href="/library/connection#open">Connection</A>); <code>move_rel(10, 0)</code> returns at
            once; <code>query_version().await</code> waits for the reply.
          </p>
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
