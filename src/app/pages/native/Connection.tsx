import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Connection: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Connection & handshake" subtitle="Open, find, and handshake" />
        <p>
          The handshake confirms the serial device is a Medius box speaking a supported protocol
          version: one request, one reply.
        </p>
        <ul>
          <li>No baud negotiation.</li>
          <li>No login.</li>
          <li>No <code>115200</code> startup step or baud-switch command.</li>
        </ul>
      </Card>

      <div id="handshake" data-search-target>
        <Card>
          <CardHeader title="Handshake" subtitle="One round-trip" />
          <ol>
            <li>
              Open the port at <code>6,000,000</code> baud
              (<A href="/native/transport">Transport</A>); <A href="/native/frame">framed binary</A>{' '}
              from the first byte.
            </li>
            <li>
              Catch the unsolicited hello (<A href="/native/connection#hello">below</A>) or send{' '}
              <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>; both
              produce the same{' '}
              <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> frame.
            </li>
            <li>
              Check that reply's <code>proto_ver</code> is <code>9</code>.
            </li>
          </ol>
          <table class="api-params">
            <thead>
              <tr><th>Reply</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>proto_ver == 9</code></td><td>Speaks the protocol these pages describe.</td></tr>
              <tr><td><code>proto_ver != 9</code></td><td>Speaks a protocol these pages don't cover; commands may behave otherwise.</td></tr>
              <tr><td>No reply</td><td>Not a Medius box, or wrong port or baud.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              The check is mandatory. Firmware 3.1.x and earlier report <code>4</code>, where{' '}
              <A href="/native/commands/lock#lock"><code>LOCK</code></A>'s last byte is a state
              (<code>1</code> = lock, <code>0</code> = unlock), not a{' '}
              <A href="/native/commands/lock#scale">scale</A>.
            </p>
            <pre class="diagram">{`a proto-9 host talking to a proto-4 box

  scale = 100  (unlock)  ->  state = 100, non-zero  ->  LOCKS it
  scale =   0  (block)   ->  state = 0              ->  UNLOCKS it`}</pre>
          </div>
          <div class="api-response-label">RESP(VERSION)</div>
          <p>
            Full detail on <A href="/native/commands/requests#version">Requests</A>.
          </p>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>selector, echoed; <code>0x00</code> = <code>VERSION</code></td></tr>
              <tr><td>1</td><td><code>proto_ver</code></td><td><code>u8</code></td><td>protocol version, expected <code>9</code></td></tr>
              <tr><td>2</td><td><code>fw_major</code></td><td><code>u8</code></td><td>firmware major</td></tr>
              <tr><td>3</td><td><code>fw_minor</code></td><td><code>u8</code></td><td>firmware minor</td></tr>
              <tr><td>4</td><td><code>fw_patch</code></td><td><code>u8</code></td><td>firmware patch</td></tr>
              <tr><td>5</td><td><code>mac</code></td><td><code>u8[6]</code></td><td>box MAC, a stable per-box id</td></tr>
              <tr><td>11..</td><td><code>name</code></td><td><code>ascii</code></td><td>human-readable box name (may be empty), delimited by the frame <code>LEN</code></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="hello" data-search-target>
        <Card>
          <CardHeader title="Ready hello" subtitle="Unsolicited RESP(VERSION), twice per boot" />
          <p>
            Treat either hello as ready and skip the{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Trigger</th><th>When</th></tr>
            </thead>
            <tbody>
              <tr><td>Power-on</td><td>Once, as the device chip boots, before any other frame.</td></tr>
              <tr><td>First contact</td><td>Once, on the device chip's first valid frame after boot, ahead of that frame's reply. A program opening the port after another has spoken gets neither hello and sends <code>QUERY(VERSION)</code>.</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`  device chip boots         -->  hello, SEQ 0
  first valid frame         -->  hello, SEQ 0, then that frame's reply
  every later frame         -->  no hello
  device chip restarts      -->  hello at boot, and again on the next frame`}</pre>
          <p>
            The hello carries <A href="/native/frame#seq"><code>SEQ=0</code></A> and the same payload
            as a queried reply. One arriving mid-session means the device chip restarted and lost its
            session state, such as <A href="/native/commands/lock">locks</A> and{' '}
            <A href="/native/commands/rewrite#lifecycle">rewrite rules</A>.
          </p>
          <div class="callout callout--info">
            <p>
              The <A href="/library/connection">medius library</A>'s{' '}
              <A href="/library/connection#open"><code>open</code></A> and{' '}
              <A href="/library/connection#open"><code>find</code></A> do all of this: send{' '}
              <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>, retry a few
              times, and check <code>proto_ver == 9</code> before returning a connection.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Connection;
