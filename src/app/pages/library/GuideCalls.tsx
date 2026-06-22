import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const GuideCalls: Component = () => {
  return (
    <>
      <div id="call-kinds" data-search-target>
        <Card>
          <CardHeader title="Three kinds of call" subtitle="Fire-and-forget, blocking query, no round-trip" />
          <p>
            Every <A href="/library/connection"><code>Device</code></A> method is one of three kinds.
            The <A href="/library">API pages</A> tag each method with a badge; this is what the three
            mean.
          </p>

          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>Writes one frame, returns once the bytes are out, no reply.</p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.move_rel(100, -50)?; // one frame out, no reply`}</code></pre>

          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>Sends a <code>QUERY</code> and waits for the correlated <code>RESP</code>.</p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let v = device.query_version()?; // waits for the box to reply`}</code></pre>

          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>Reads state the library already holds; can't fail on the link.</p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let c = device.counters(); // local snapshot, no network`}</code></pre>
        </Card>
      </div>

      <div id="why-async" data-search-target>
        <Card>
          <CardHeader title="Why the queries are async" subtitle="Queries await a reply, everything else fires and forgets" />
          <p>
            With the <A href="/library/features/async"><code>async</code></A> feature, the{' '}
            <A href="/native/commands/requests#requests"><code>QUERY</code></A> methods are the{' '}
            <code>async fn</code>s, because a query blocks for its correlated{' '}
            <A href="/native/commands/requests#resp"><code>RESP</code></A>. Every other method is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>, so it stays synchronous.
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
                <td>
                  <code>query_version</code>, <code>query_health</code>,{' '}
                  <code>query_mouse_info</code>, <code>query_caps</code>, <code>query_rate</code>,{' '}
                  <code>query_stats</code>, <code>query_locks</code>, <code>query_catch</code>
                </td>
                <td>
                  <code>move_rel</code>, <code>wheel</code>, <code>button</code>, <code>press</code>,{' '}
                  <code>soft_release</code>, <code>force_release</code>, <code>reset</code>,{' '}
                  <code>reboot</code>, <code>led</code>, <code>lock</code>, <code>unlock</code>,{' '}
                  <code>catch_events</code>
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
            runs one future to completion on the current thread, so you can await a query with no async
            runtime at all.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;

let device = Device::find()?.into_async();
let v = block_on(device.query_version())?;
println!("{v}");`}</code></pre>
          <div class="callout callout--info">
            <p>
              Inside an async <code>main</code>, <code>.await</code> the same future instead; it runs
              unchanged under{' '}
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
            A query waits{' '}
            <A href="/library/connection#zero-config"><code>DEFAULT_QUERY_TIMEOUT</code></A> (1 second),
            then returns <code>Err(Error::QueryTimeout)</code>. This applies to both the sync and async
            queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`match device.query_health() {
    Ok(h) => println!("{h:?}"),
    Err(medius::Error::QueryTimeout) => eprintln!("no reply in time"),
    Err(e) => return Err(e),
}`}</code></pre>
          <div class="callout callout--info">
            <p>
              <code>QueryTimeout</code> means silence; <code>NoReply</code> means a reply arrived but
              didn't parse. Both are on the <A href="/library/types/errors">Errors</A> page.
            </p>
          </div>
        </Card>
      </div>

      <div id="smooth-motion" data-search-target>
        <Card>
          <CardHeader title="Smooth motion" subtitle="Glide instead of teleport" />
          <p>
            <A href="/library/movement#move-rel"><code>move_rel</code></A> applies one delta at once. For
            a glide rather than a jump, subdivide the move and pace the steps yourself, roughly one per
            millisecond. There's no <code>move_smooth</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::thread::sleep;
use std::time::Duration;

// Glide ~400 counts to the right over 200 steps (~200 ms at 1 kHz).
for _ in 0..200 {
    device.move_rel(2, 0)?;
    sleep(Duration::from_millis(1));
}`}</code></pre>
          <div class="callout callout--warning">
            <p>
              The library applies no rate limit. A no-sleep loop floods the 4 Mbaud link; pace your
              own steps.
            </p>
          </div>
        </Card>
      </div>

      <div id="clicking" data-search-target>
        <Card>
          <CardHeader title="Making a click" subtitle="Press, wait, release" />
          <p>
            There's no one-shot <code>click</code>:{' '}
            <A href="/library/buttons#press"><code>press</code></A>, wait, then release with{' '}
            <A href="/library/buttons#soft-release"><code>soft_release</code></A> so you don't stomp a
            physical hold.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::{thread, time::Duration};
use medius::Button;

device.press(Button::Left)?;
thread::sleep(Duration::from_millis(20));
device.soft_release(Button::Left)?;`}</code></pre>
          <p>
            <A href="/library/admin#reset"><code>reset</code></A> drops every override at once; a held
            press is re-asserted on reconnect via{' '}
            <A href="/library/lifecycle#reapply"><code>reapply</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default GuideCalls;
