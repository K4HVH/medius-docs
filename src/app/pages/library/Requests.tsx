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

      <div id="version-timeout" data-search-target>
        <Card>
          <CardHeader title="When no reply comes" subtitle="The query timeout and its error" />
          <p>
            Silence for the full one-second{' '}
            <a
              href="https://docs.rs/medius/latest/medius/constant.DEFAULT_QUERY_TIMEOUT.html"
              target="_blank"
              rel="noreferrer"
            ><code>DEFAULT_QUERY_TIMEOUT</code></a> returns{' '}
            <A href="/library/types/errors"><code>QueryTimeout</code></A>;{' '}
            <A href="/library/types/errors"><code>NoReply</code></A> means an answer came back but was
            unparseable or the wrong kind.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, Error};

let device = Device::find()?;
match device.query_version() {
    Ok(v) => println!("connected: {v}"),
    Err(Error::QueryTimeout) => eprintln!("box didn't answer in time"),
    Err(e) => return Err(e),
}`}</code></pre>

          <div class="callout callout--info">
            <p>
              The timeout is fixed in the public sync API; the <A href="#async">async</A> path uses
              the same one-second default.
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

      <div id="mock" data-search-target>
        <Card>
          <CardHeader title="Trying it with no box" subtitle="Query a MockBox in tests" />
          <pre><code>cargo add medius --features mock</code></pre>

          <p>
            The <code>mock</code> feature gives a scriptable{' '}
            <a
              href="https://docs.rs/medius/latest/medius/struct.MockBox.html"
              target="_blank"
              rel="noreferrer"
            ><code>MockBox</code></a>: set its version and health, pass it to{' '}
            <code>Device::with_mock</code>. <code>MockBox::new().silent()</code> never answers, to
            exercise the <A href="#version-timeout"><code>QueryTimeout</code></A> path.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, Health, MockBox, Version};

let mock = MockBox::new()
    .with_version(Version { proto_ver: 1, fw_major: 1, fw_minor: 2, fw_patch: 3 })
    .with_health(Health {
        link_up: true,
        mouse_attached: true,
        clone_configured: true,
        injection_active: false,
    });

let device = Device::with_mock(mock);
assert_eq!(device.query_version()?.fw_major, 1);
assert!(device.query_health()?.clone_configured);`}</code></pre>
        </Card>
      </div>

      <div id="complete-example" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Find the box, read version and health, check readiness" />
          <p>
            Drop into <code>src/main.rs</code>: finds the box, reads both queries, reports inject
            readiness.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    let v = device.query_version()?;
    let h = device.query_health()?;

    println!("connected: {v}");
    println!(
        "health: link_up={} mouse_attached={} clone_configured={} injection_active={}",
        h.link_up, h.mouse_attached, h.clone_configured, h.injection_active,
    );

    if h.link_up && h.mouse_attached && h.clone_configured {
        println!("chain is live, safe to inject");
    } else {
        println!("not ready yet");
    }

    Ok(())
}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Requests;
