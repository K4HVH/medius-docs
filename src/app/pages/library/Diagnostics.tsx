import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Diagnostics: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Diagnostics" subtitle="Read-only views of the link" />
        <p>
          The link is the USB-serial connection between your program and the box. These two methods
          observe it without sending anything: <code>logs</code> streams the box's own messages,{' '}
          <code>counters</code> reports traffic tallies. Use them when input isn't landing and you
          need to see whether frames leave your program, reach the box, or get dropped.
        </p>
      </Card>

      <div id="logs" data-search-target>
        <Card>
          <CardHeader title="logs" subtitle="Stream of box messages" />
          <pre class="api-signature">fn logs(&self) -&gt; LogStream</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>

          <div class="api-response-label">LEVELS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Level</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>error</code></td>
                <td><code>0</code></td>
                <td>A failure the box could not recover from.</td>
              </tr>
              <tr>
                <td><code>warn</code></td>
                <td><code>1</code></td>
                <td>Something off the box handled but you should know about.</td>
              </tr>
              <tr>
                <td><code>info</code></td>
                <td><code>2</code></td>
                <td>Normal operational notices.</td>
              </tr>
              <tr>
                <td><code>debug</code></td>
                <td><code>3</code></td>
                <td>Detail useful while diagnosing a problem.</td>
              </tr>
              <tr>
                <td><code>verbose</code></td>
                <td><code>4</code></td>
                <td>The finest-grained trace output.</td>
              </tr>
            </tbody>
          </table>

          <p>
            <A href="/native/commands/admin#log"><code>LOG</code></A> (opcode <code>0x08</code>) is
            the box's one unsolicited frame, not a reply to anything you sent. <code>logs</code>{' '}
            returns a <code>LogStream</code> that hands those frames over one at a time as{' '}
            <A href="/library/types#structs"><code>LogLine</code></A>, each a{' '}
            <A href="/library/types#enums"><code>LogLevel</code></A> (<code>level</code>) plus the
            decoded <code>text</code>. Read with blocking, try, or timeout.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let stream = device.logs();
while let Ok(line) = stream.recv() {
    println!("[{:?}] {}", line.level, line.text);
}`}</code></pre>

          <div class="callout callout--info">
            <p>
              The box emits <A href="/native/commands/admin#log"><code>LOG</code></A> frames only
              while the control link is up. With no control PC attached they are dropped, not
              buffered.
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

          <div class="api-response-label">RETURNS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>frames_tx</code></td>
                <td><code>u64</code></td>
                <td>Frames sent to the box.</td>
              </tr>
              <tr>
                <td><code>frames_rx</code></td>
                <td><code>u64</code></td>
                <td>Frames received from the box.</td>
              </tr>
              <tr>
                <td><code>crc_drops</code></td>
                <td><code>u64</code></td>
                <td>
                  Inbound frames dropped on a{' '}
                  <A href="/native/frame#crc">checksum</A> mismatch. A climbing count points at a
                  flaky cable or connection.
                </td>
              </tr>
              <tr>
                <td><code>reconnects</code></td>
                <td><code>u64</code></td>
                <td>Times the library reopened the serial port after the link dropped out.</td>
              </tr>
            </tbody>
          </table>

          <p>
            Returns a <code>CountersSnapshot</code> of four running totals, read at the moment you
            call it. They only climb, so subtract two snapshots to measure a span. Each command and
            reply is one <A href="/native/frame">frame</A> on the wire, so the tallies count messages
            in each direction.
          </p>

          <div class="callout callout--info">
            <p>
              <A href="/library/types#structs"><code>CountersSnapshot</code></A> and the rest of the
              public types are on the <A href="/library/types">types</A> page.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Diagnostics;
