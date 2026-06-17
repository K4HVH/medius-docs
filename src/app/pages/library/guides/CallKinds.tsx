import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const CallKinds: Component = () => {
  return (
    <>
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
    </>
  );
};

export default CallKinds;
