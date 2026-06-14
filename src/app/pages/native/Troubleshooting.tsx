import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Troubleshooting: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Troubleshooting" subtitle="Common failures and what they mean" />
        <p>
          Every message in either direction is a{' '}
          <A href="/native/frame"><code>frame</code></A> (one packet on the wire). Most commands are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: you send, the box stays
          silent. The exception is{' '}
          <A href="/native/commands/requests#requests"><code>QUERY</code></A>, which asks for a piece
          of the box's state and gets back one{' '}
          <A href="/native/commands/requests#resp"><code>RESP</code></A> frame. Most checks below use
          that round-trip.
        </p>
      </Card>

      <div id="no-reply" data-search-target>
        <Card>
          <CardHeader title="No reply to QUERY(VERSION)" />
          <p>
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> asks for the
            firmware and protocol version; the reply is a{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> frame. If none
            comes back, check:
          </p>
          <ul>
            <li>
              The port wasn't opened at <code>4,000,000</code> baud. The box speaks{' '}
              <A href="/native/frame">framed binary</A> from the first byte, with no slower startup
              speed.
            </li>
            <li>Another process holds the port. Only one program can have it open.</li>
            <li>It isn't a Medius box, or you opened the wrong port.</li>
            <li>You opened the port after the hello already fired.</li>
          </ul>
          <p>
            The hello is a{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> the box sends
            on its own once the control link comes up. Missing it costs nothing: send{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> and read the
            reply. See <A href="/native/connection#hello">the ready hello</A>.
          </p>
        </Card>
      </div>

      <div id="no-injection" data-search-target>
        <Card>
          <CardHeader title="Injection does nothing" />
          <p>
            <A href="/native/injection">Injection</A> is the input your program adds on top of the
            real mouse's passthrough (movement, buttons, scroll). If it has no effect, send{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> and read the{' '}
            <code>flags</code> byte. Each bit is an independent status:
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Flag</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td><code>LINK_UP</code></td><td><code>0x01</code></td><td>The link to the host chip is up.</td></tr>
              <tr><td><code>MOUSE_ATTACHED</code></td><td><code>0x02</code></td><td>A real mouse is attached (on <A href="/native/hardware"><code>USB3</code></A>).</td></tr>
              <tr><td><code>CLONE_CONFIGURED</code></td><td><code>0x04</code></td><td>The PC has set up the clone (the mouse the box presents to the PC).</td></tr>
              <tr><td><code>INJECTION_ACTIVE</code></td><td><code>0x08</code></td><td>The box is currently merging injected input.</td></tr>
            </tbody>
          </table>
          <p>
            First three flags set means the chain (real mouse to box to PC) is live. Injection only
            merges once the clone is configured.
          </p>
          <div class="callout callout--info">
            <p>
              See <A href="/native/commands/requests#health">QUERY(HEALTH)</A> for the full flag byte.
            </p>
          </div>
        </Card>
      </div>

      <div id="button-stuck-release" data-search-target>
        <Card>
          <CardHeader title="A held button releases on its own" />
          <p>
            The box clears all injection if your program goes quiet, so input can't get stuck.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>Silence timeout (default <code>1000 ms</code> with no valid inbound frame)</td><td>Drops every held button and pending move, returns to plain passthrough.</td></tr>
              <tr><td>Any frame that passes its <A href="/native/frame#crc">checksum</A> (including a <A href="/native/commands/requests#requests"><code>QUERY</code></A>)</td><td>Resets the timer.</td></tr>
            </tbody>
          </table>
          <p>
            To hold an injected button, keep the link busy with periodic frames (a{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> is enough), or
            let the library's keepalive do it.
          </p>
          <div class="callout callout--info">
            <p>
              See <A href="/native/injection#safety">Injection</A> for the safety state machine.
            </p>
          </div>
        </Card>
      </div>

      <div id="shutdown" data-search-target>
        <Card>
          <CardHeader title="A machine shuts off or drains its battery" />
          <p>
            <A href="/native/hardware"><code>USB1</code></A> and{' '}
            <A href="/native/hardware"><code>USB3</code></A> share one internal rail, and the{' '}
            <A href="/native/hardware"><code>USB3</code></A> 5V rail can't be pulled low in firmware,
            so wiring both to one machine back-feeds power into it. Keep them apart:
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Port</th><th>Carries</th><th>Connects to</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/native/hardware"><code>USB1</code></A></td><td>the clone to the PC</td><td>the game PC</td></tr>
              <tr><td><A href="/native/hardware"><code>USB2</code></A></td><td>the control link</td><td>the control PC</td></tr>
              <tr><td><A href="/native/hardware"><code>USB3</code></A></td><td>the real mouse</td><td>the mouse</td></tr>
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
          <CardHeader title="The serial port disappeared after a REBOOT" />
          <p>
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> carries one payload byte,{' '}
            <code>target</code>, selecting which chip reboots and how. The download targets drop a
            chip into ROM download mode for flashing, so its running firmware (and the serial port it
            provides) goes away:
          </p>
          <table class="api-params">
            <thead>
              <tr><th><code>target</code></th><th>Mode</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>device download</td><td>The device chip enters ROM download mode for flashing.</td></tr>
              <tr><td><code>1</code></td><td>host download</td><td>The host chip enters ROM download mode for flashing.</td></tr>
            </tbody>
          </table>
          <p>
            Flash the chip or power-cycle the box to get the port back. See{' '}
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A>.
          </p>
        </Card>
      </div>

      <div id="no-logs" data-search-target>
        <Card>
          <CardHeader title="No LOG frames arrive" />
          <p>
            <A href="/native/commands/admin#log"><code>LOG</code></A> is the box's unsolicited
            diagnostic frame (box to PC). If none arrive, check:
          </p>
          <ul>
            <li>No control PC is attached. <A href="/native/commands/admin#log"><code>LOG</code></A> is only emitted while one is.</li>
            <li>It logged before first contact. That output is dropped, not buffered.</li>
            <li>It's early ROM-bootloader output, which is plain ASCII the frame decoder ignores.</li>
          </ul>
        </Card>
      </div>
    </>
  );
};

export default Troubleshooting;
