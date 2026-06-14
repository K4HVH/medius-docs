import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Flashing: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Flashing" subtitle="Writing new firmware" />
        <p>
          Flashing writes new firmware onto the box, to update or recover it. The box has two chips;
          you reflash each separately. No physical button is needed: a{' '}
          <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> command restarts a chip
          into its ROM download mode (a built-in loader that accepts firmware over serial), then a
          flashing tool writes the image.
        </p>
      </Card>

      <div id="two-chips" data-search-target>
        <Card>
          <CardHeader title="Two chips" subtitle="Independent flash per chip" />
          <p>
            Both chips flash via a{' '}
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> frame, opcode{' '}
            <code>0x07</code>. Its one payload byte, <code>target</code>, selects which chip restarts
            and whether it comes back in download mode or running.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th><code>target</code></th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>0</code></td>
                <td>Device download: restart the device chip into ROM download mode.</td>
              </tr>
              <tr>
                <td><code>1</code></td>
                <td>Host download: restart the host chip into download mode, relayed over the inter-chip link.</td>
              </tr>
              <tr>
                <td><code>2</code></td>
                <td>Device run: restart the device chip straight back into its firmware.</td>
              </tr>
              <tr>
                <td><code>3</code></td>
                <td>Host run: restart the host chip straight back into its firmware.</td>
              </tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr>
                <th>Chip</th>
                <th>Role</th>
                <th>Flashed over</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Device</td>
                <td>The chip your program talks to over the serial port.</td>
                <td>
                  The same <A href="/native/transport">CH343</A> USB-serial link, with{' '}
                  <code>esptool</code> (standard tool for the box's ESP-family chips), after a{' '}
                  <code>target=0</code> reboot.
                </td>
              </tr>
              <tr>
                <td>Host</td>
                <td>The chip that presents the cloned mouse to the PC.</td>
                <td>
                  Its own USB connection, after a <code>target=1</code> reboot. Full detail on the{' '}
                  <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> page.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="Version scheme" subtitle="major.minor.patch" />
          <p>
            The firmware version is a single source of truth, written{' '}
            <code>major.minor.patch</code>. Read it with{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>; the box
            answers with{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A>. The current
            version is <code>0.1.0</code>. That reply also carries <code>proto_ver</code>, the
            one-byte protocol version; this documentation describes protocol version <code>1</code>.
          </p>
        </Card>
      </div>

      <div id="notes" data-search-target>
        <Card>
          <CardHeader title="Notes" />
          <div class="callout callout--warning">
            <ul>
              <li>
                A run reboot (<code>target=2</code> or <code>3</code>) is the only software
                cold-reboot. There's no <code>DTR</code>/<code>RTS</code> reset; those lines aren't
                wired to a reset on this board.
              </li>
              <li>
                After a download reboot the serial port sits in the ROM bootloader, which speaks
                plain ASCII that the <A href="/native/frame">frame decoder</A> ignores, until you
                finish flashing or power-cycle.
              </li>
              <li>Persisted per-box data survives an app reflash.</li>
            </ul>
          </div>
          <div class="callout callout--info">
            <p>
              The <code>medius</code> crate's <A href="/library/features/flash">flash feature</A>{' '}
              does this from Rust.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Flashing;
