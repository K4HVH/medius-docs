import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Diagnostics: Component = () => {
  return (
    <>
      <div id="diagnostics-overview" data-search-target>
        <Card>
          <CardHeader title="Diagnostics" subtitle="Read-only views of the link" />
          <p>
            <code>logs</code> and <code>counters</code> are lock-free, read-only views, both on{' '}
            <A href="/library/connection"><code>Device</code></A>.
          </p>
        </Card>
      </div>

      <div id="logs" data-search-target>
        <Card>
          <CardHeader title="logs" subtitle="Stream of box messages" />
          <pre class="api-signature">fn logs(&self) -&gt; LogStream</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>

          <p>
            Yields each box <A href="/native/commands/admin#log"><code>LOG</code></A> frame as a{' '}
            <A href="/library/types/structs#log-line"><code>LogLine</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`for line in device.logs() {
    println!("[{:?}] {}", line.level, line.text);
}
// the loop ends here when the link drops`}</code></pre>

          <div class="callout callout--info">
            <p>
              The box emits <A href="/native/commands/admin#log"><code>LOG</code></A> frames only
              while the control link is up; with no control PC attached they are dropped, not
              buffered.
            </p>
          </div>
        </Card>
      </div>

      <div id="reading-logs" data-search-target>
        <Card>
          <CardHeader title="Reading the stream" subtitle="Blocking, polling, and draining" />
          <div class="api-response-label">METHODS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Method</th>
                <th>Returns</th>
                <th>Blocks</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>recv()</code></td>
                <td><code>Result&lt;LogLine&gt;</code></td>
                <td>Yes</td>
                <td>
                  Waits for the next line. <code>Err</code> is{' '}
                  <A href="/library/types/errors"><code>Error::Disconnected</code></A> once the link
                  is gone.
                </td>
              </tr>
              <tr>
                <td><code>try_recv()</code></td>
                <td><code>Option&lt;LogLine&gt;</code></td>
                <td>No</td>
                <td>One queued line, or <code>None</code> if nothing is waiting.</td>
              </tr>
              <tr>
                <td><code>recv_timeout(d)</code></td>
                <td><code>Option&lt;LogLine&gt;</code></td>
                <td>Up to <code>d</code></td>
                <td>The next line within the window, or <code>None</code> on timeout.</td>
              </tr>
              <tr>
                <td><code>try_iter()</code></td>
                <td>iterator</td>
                <td>No</td>
                <td>Drains every line queued right now, then stops.</td>
              </tr>
            </tbody>
          </table>

          <p>
            <code>try_iter()</code> or <code>try_recv()</code> for a per-frame loop;{' '}
            <code>recv()</code> or the blocking iterator for a dedicated log thread.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let stream = device.logs();

// once per frame: drain whatever is queued, never blocking
for line in stream.try_iter() {
    println!("[{:?}] {}", line.level, line.text);
}

// or wait a bounded window for the next line
if let Some(line) = stream.recv_timeout(Duration::from_millis(50)) {
    println!("got {}", line.text);
} else {
    // no log this window, carry on
}`}</code></pre>

          <div class="callout callout--warning">
            <p>
              The channel buffers 1024 lines and evicts the oldest when full. A slow poller drops old
              lines silently, so drain often if you can't miss any.
            </p>
          </div>
        </Card>
      </div>

      <div id="logs-without-hardware" data-search-target>
        <Card>
          <CardHeader title="Driving logs in a test" subtitle="Push log lines with a MockBox" />
          <p>
            With the <A href="/library/features/mock"><code>mock</code></A> feature,{' '}
            <code>push_log</code> on a <code>MockBox</code> emits a{' '}
            <A href="/native/commands/admin#log"><code>LOG</code></A> frame that surfaces on{' '}
            <code>logs()</code> like a real one.
          </p>

          <pre><code>cargo add medius --features mock</code></pre>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, LogLevel, MockBox};
use std::time::Duration;

#[test]
fn logs_reach_the_stream() {
    let mock = MockBox::new();
    let device = Device::with_mock(mock.clone());
    let stream = device.logs();

    mock.push_log(LogLevel::Warn, "overheating");

    let line = stream.recv_timeout(Duration::from_secs(1)).unwrap();
    assert_eq!(line.level, LogLevel::Warn);
    assert_eq!(line.text, "overheating");
}`}</code></pre>

          <p>
            Run with <code>cargo test --features mock</code>; see{' '}
            <A href="/library/features/mock"><code>MockBox</code></A> for the rest of the API.
          </p>
        </Card>
      </div>

      <div id="counters" data-search-target>
        <Card>
          <CardHeader title="counters" subtitle="Link statistics" />
          <pre class="api-signature">fn counters(&self) -&gt; CountersSnapshot</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>

          <p>
            A <code>Copy</code> snapshot of four totals that only climb, reset only on process
            restart: rising <code>crc_drops</code> means a flaky cable, <code>reconnects</code> counts
            port reopens after a dropped link. Full field reference on{' '}
            <A href="/library/types/structs#counters-snapshot"><code>CountersSnapshot</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`println!("{:?}", device.counters());`}</code></pre>
        </Card>
      </div>

      <div id="measuring-a-span" data-search-target>
        <Card>
          <CardHeader title="Measuring a span" subtitle="Diff two snapshots" />
          <p>
            Subtract two snapshots to measure one span; a jump in <code>crc_drops</code> or{' '}
            <code>reconnects</code> across it flags link trouble.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let before = device.counters();

for _ in 0..100 {
    device.move_rel(1, 0)?;
}

let after = device.counters();
println!("sent {} frames", after.frames_tx - before.frames_tx);

if after.crc_drops > before.crc_drops {
    eprintln!("flaky link: {} CRC drops", after.crc_drops - before.crc_drops);
}
if after.reconnects > before.reconnects {
    eprintln!("link dropped and reopened");
}`}</code></pre>
        </Card>
      </div>

      <div id="complete-example" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Watch logs and counters together" />
          <p>
            <code>Device</code> is <code>Clone</code>, so the log thread and main thread share one
            connection.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;
use std::thread;

fn main() -> medius::Result<()> {
    let device = match std::env::args().nth(1) {
        Some(path) => Device::open(path)?,
        None => Device::find()?,
    };

    // a background thread that prints box messages until the link drops
    let log_device = device.clone();
    thread::spawn(move || {
        for line in log_device.logs() {
            println!("[{:?}] {}", line.level, line.text);
        }
    });

    let before = device.counters();

    for _ in 0..100 {
        device.move_rel(1, 0)?;
    }

    let after = device.counters();
    println!("frames_tx   +{}", after.frames_tx - before.frames_tx);
    println!("frames_rx   +{}", after.frames_rx - before.frames_rx);
    println!("crc_drops   +{}", after.crc_drops - before.crc_drops);
    println!("reconnects  +{}", after.reconnects - before.reconnects);

    Ok(())
}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Diagnostics;
