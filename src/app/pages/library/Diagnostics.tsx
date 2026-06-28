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
            <code>logs</code> and <code>counters</code> are lock-free, read-only views on{' '}
            <A href="/library/connection"><code>Device</code></A> and{' '}
            <A href="/library/features/async"><code>AsyncDevice</code></A>.
          </p>
          <p>See also: <A href="/library/guides/testing#testing">testing with MockBox</A>.</p>
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
              <tr>
                <td><code>recv_async().await</code></td>
                <td><code>Result&lt;LogLine&gt;</code></td>
                <td>Awaits</td>
                <td>Await the next line (<code>async</code> feature), runtime-agnostic.</td>
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

    </>
  );
};

export default Diagnostics;
