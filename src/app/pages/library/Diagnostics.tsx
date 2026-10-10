import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';

const Diagnostics: Component = () => {
  return (
    <>
      <PageHeader id="diagnostics-overview">
        <p>
          <code>logs</code> and <code>counters</code> are lock-free, on both{' '}
          <A href="/library/connection"><code>Device</code></A> and{' '}
          <A href="/library/features/async"><code>AsyncDevice</code></A>.
        </p>
        <p>See also: <A href="/library/guides/testing#testing">testing with MockBox</A>.</p>
      </PageHeader>

      <DocSection id="logs" title="logs" caption="Stream of box messages">
        <pre class="api-signature">fn logs(&self) -&gt; LogStream</pre>
        <p>
          <span class="api-badge api-badge--executed">No round-trip</span>
        </p>

        <p>
          Yields each box <A href="/native/commands/admin#log"><code>LOG</code></A> frame as a{' '}
          <A href="/library/types/structs#log-line"><code>LogLine</code></A>.
        </p>

        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`for line in device.logs() {
    println!("[{:?}] {}", line.level, line.text);
}
// ends when the link drops`}</code></pre>

        <div class="callout callout--info">
          <p>
            The box emits <A href="/native/commands/admin#log"><code>LOG</code></A> frames only
            while the control link is up; with no control PC they are dropped, not buffered.
          </p>
        </div>
      </DocSection>

      <DocSection id="reading-logs" title="Reading the stream" caption="Blocking, polling, and draining">
        <div class="api-response-label">METHODS</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr>
                <th>Name</th>
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
                <td>One queued line, or <code>None</code>.</td>
              </tr>
              <tr>
                <td><code>recv_timeout(d)</code></td>
                <td><code>Option&lt;LogLine&gt;</code></td>
                <td>Up to <code>d</code></td>
                <td>The next line within the window, or <code>None</code> on timeout.</td>
              </tr>
              <tr>
                <td><code>try_iter()</code></td>
                <td><code>impl Iterator</code></td>
                <td>No</td>
                <td>Drains every queued line, then stops.</td>
              </tr>
              <tr>
                <td><code>recv_async().await</code></td>
                <td><code>Result&lt;LogLine&gt;</code></td>
                <td>Awaits</td>
                <td>Awaits the next line (<code>async</code> feature), runtime-agnostic.</td>
              </tr>
              <tr>
                <td><code>for line in stream</code></td>
                <td><code>LogLine</code></td>
                <td>Yes</td>
                <td>Blocking <code>IntoIterator</code>; yields each line until the link closes.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          <code>try_iter()</code> or <code>try_recv()</code> for a per-frame loop;{' '}
          <code>recv()</code> or the blocking iterator for a dedicated log thread.
        </p>

        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`let stream = device.logs();

// once per frame: drain the queue, never blocking
for line in stream.try_iter() {
    println!("[{:?}] {}", line.level, line.text);
}

// or wait up to 50 ms for the next line
if let Some(line) = stream.recv_timeout(Duration::from_millis(50)) {
    println!("got {}", line.text);
} else {
    // none this window
}`}</code></pre>

        <div class="callout callout--warning">
          <p>
            The channel buffers 1024 lines and evicts the oldest, uncounted, when full.
          </p>
        </div>
      </DocSection>

      <DocSection id="counters" title="counters" caption="Link statistics">
        <pre class="api-signature">fn counters(&self) -&gt; CountersSnapshot</pre>
        <p>
          <span class="api-badge api-badge--executed">No round-trip</span>
        </p>

        <p>
          A <code>Copy</code> snapshot of five totals that only climb, zeroed at process start:
          rising <code>crc_drops</code> means a flaky cable, <code>reconnects</code> counts port
          reopens after a dropped link, and <code>restarts</code> counts device-chip restarts the
          library <A href="/library/lifecycle#restart">recovered</A> from. Fields on{' '}
          <A href="/library/types/structs#counters-snapshot"><code>CountersSnapshot</code></A>.
        </p>

        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`let c = device.counters();
println!("{} reconnects, {} restarts, {} CRC drops", c.reconnects, c.restarts, c.crc_drops);`}</code></pre>
      </DocSection>

    </>
  );
};

export default Diagnostics;
