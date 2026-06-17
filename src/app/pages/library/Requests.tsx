import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Requests: Component = () => {
  return (
    <>
      <div id="requests-overview" data-search-target>
        <Card>
          <CardHeader title="Requests" subtitle="Asking the box a question and waiting for the answer" />
          <p>
            Unlike <A href="/native/injection#fire-and-forget">fire-and-forget</A>, these two methods
            are blocking queries: a question frame out, one answer frame back.
          </p>
          <p>See also: the <A href="/library/examples#version-health">worked example</A>.</p>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="query_version" subtitle="Firmware identity, round-trip" />
          <pre class="api-signature">fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#version"><code>Version</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;          // or Device::open("/dev/ttyACM0")?
let v = device.query_version()?;
println!("{v}");                       // fw 1.2.3
println!("proto {}", v.proto_ver);     // proto 1`}</code></pre>

          <div class="callout callout--info">
            <p>
              <code>Device::find()</code> already runs a version query during the handshake;
              calling <code>query_version</code> again just re-reads it.
            </p>
          </div>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="query_health" subtitle="Is the mouse-to-box-to-PC chain live" />
          <pre class="api-signature">fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#health"><code>Health</code></A>, four booleans from one
            status byte. <code>link_up</code>, <code>mouse_attached</code>, and{' '}
            <code>clone_configured</code> must all be true before{' '}
            <A href="/native/injection">injection</A> has anywhere to land.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
let h = device.query_health()?;
if h.link_up && h.mouse_attached && h.clone_configured {
    // chain is live, safe to inject
} else {
    eprintln!("not ready: {h:?}");
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="Async queries" subtitle="The same two queries on AsyncDevice" />
          <pre class="api-signature">async fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <pre class="api-signature">async fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <pre><code>cargo add medius --features async</code></pre>

          <p>
            With the <code>async</code> feature, <code>Device::into_async()</code> yields an{' '}
            <A href="/library/features/async"><code>AsyncDevice</code></A> whose two queries are futures;
            other methods stay synchronous. The crate is runtime-agnostic (no tokio), so drive a future
            with anything, such as{' '}
            <a
              href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html"
              target="_blank"
              rel="noreferrer"
            ><code>futures::executor::block_on</code></a>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::Device;

let device = Device::find()?.into_async();
let v = block_on(device.query_version())?;
let h = block_on(device.query_health())?;
println!("{v} link_up={}", h.link_up);`}</code></pre>
        </Card>
      </div>

    </>
  );
};

export default Requests;
