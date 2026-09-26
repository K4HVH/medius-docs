import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Troubleshooting: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Troubleshooting" subtitle="Common failures" />
        <p>
          Every message is a <A href="/native/frame"><code>frame</code></A> (one packet on the
          wire). Most commands are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>, with no reply;{' '}
          <A href="/native/commands/requests#requests"><code>QUERY</code></A> asks for box state and
          gets one <A href="/native/commands/requests#resp"><code>RESP</code></A> frame.
        </p>
      </Card>

      <div id="no-reply" data-search-target>
        <Card>
          <CardHeader title="No reply to QUERY(VERSION)" subtitle="Wrong baud, a held port, or not a Medius box" />
          <p>
            If <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> (firmware
            and protocol version) gets no{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A>, check:
          </p>
          <ul>
            <li>
              Port not opened at <code>6,000,000</code> baud;{' '}
              <A href="/native/frame">framed binary</A> from the first byte, no slower startup speed.
            </li>
            <li>Another process holds the port; only one can open it.</li>
            <li>Not a Medius box, or the wrong port.</li>
            <li>Port opened after both hellos fired.</li>
          </ul>
          <p>
            The hello is an unsolicited{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> at boot and on
            the first frame received. Missing it costs nothing: send{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>. See{' '}
            <A href="/native/connection#hello">ready hello</A>.
          </p>
        </Card>
      </div>

      <div id="no-injection" data-search-target>
        <Card>
          <CardHeader title="Injection does nothing" subtitle="Check HEALTH first" />
          <p>
            <A href="/native/injection">Injection</A> is input added on top of the mouse's
            passthrough (movement, buttons, scroll). If it has no effect, send{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> and read the{' '}
            <code>flags</code> word (<code>u16</code>, little-endian).
          </p>
          <p>
            The box merges injection only once <code>LINK_UP</code>, <code>MOUSE_ATTACHED</code> (a
            mouse on <A href="/native/hardware"><code>USB3</code></A>), and{' '}
            <code>CLONE_CONFIGURED</code> (the PC enumerated the clone) are all set. Full flags word
            on <A href="/native/commands/requests#health">HEALTH</A>.
          </p>
        </Card>
      </div>

      <div id="button-stuck-release" data-search-target>
        <Card>
          <CardHeader title="Held button releases" subtitle="Silence auto-clear" />
          <p>
            The box clears all injection when the program goes quiet, so input can't stick.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>Silence timeout (default <code>1000 ms</code> with no valid inbound frame)</td><td>Drops every held button and pending move, returns to plain passthrough.</td></tr>
              <tr><td>Any frame passing its <A href="/native/frame#crc">checksum</A> (including a <A href="/native/commands/requests#requests"><code>QUERY</code></A>)</td><td>Resets the timer.</td></tr>
            </tbody>
          </table>
          <p>
            To hold an injected button, keep the link busy with periodic frames (a{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> is enough), or
            use <A href="/library/guides/connection#keepalive">the library's keepalive</A>.
          </p>
          <div class="callout callout--info">
            <p>
              Safety state machine on <A href="/native/injection#safety">Injection</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="shutdown" data-search-target>
        <Card>
          <CardHeader title="Machine shuts off or drains battery" subtitle="USB1 and USB3 on the same machine" />
          <p>
            <A href="/native/hardware"><code>USB1</code></A> and{' '}
            <A href="/native/hardware"><code>USB3</code></A> share one internal 5V rail that firmware
            can't pull low, so wiring both to one machine back-feeds power into it. Keep them apart:
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Port</th><th>Carries</th><th>Connects to</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/native/hardware"><code>USB1</code></A></td><td>clone</td><td>game PC</td></tr>
              <tr><td><A href="/native/hardware"><code>USB2</code></A></td><td>control link</td><td>control PC</td></tr>
              <tr><td><A href="/native/hardware"><code>USB3</code></A></td><td>real mouse</td><td>mouse</td></tr>
            </tbody>
          </table>
          <div class="callout callout--danger">
            <p>
              ⚠️ <A href="/native/hardware"><code>USB1</code></A> and{' '}
              <A href="/native/hardware"><code>USB3</code></A> must never both connect to the same
              machine. See <A href="/native/hardware">Hardware</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="port-gone" data-search-target>
        <Card>
          <CardHeader title="Serial port gone after REBOOT" subtitle="Chip in ROM download mode" />
          <p>
            A download <A href="/native/commands/admin#reboot"><code>REBOOT</code></A>{' '}
            (<code>target</code> <code>0</code> or <code>1</code>) puts a chip in ROM download mode,
            removing its running firmware and the serial port it provides. Flash the chip or
            power-cycle the box to restore the port. See{' '}
            <A href="/native/flashing">Flashing</A>.
          </p>
        </Card>
      </div>

      <div id="no-logs" data-search-target>
        <Card>
          <CardHeader title="No LOG frames" subtitle="Sent only with a control PC attached" />
          <p>
            <A href="/native/commands/admin#log"><code>LOG</code></A> is the box's unsolicited
            diagnostic frame (box to PC). If none arrive, check:
          </p>
          <ul>
            <li>No control PC attached; <A href="/native/commands/admin#log"><code>LOG</code></A> is emitted only while one is.</li>
            <li>Logged before first contact; that output is dropped, not buffered.</li>
            <li>Early ROM-bootloader output, plain ASCII the frame decoder ignores.</li>
          </ul>
        </Card>
      </div>
    </>
  );
};

export default Troubleshooting;
