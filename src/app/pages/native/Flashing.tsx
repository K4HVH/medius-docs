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
          flash each separately. With firmware already running, no physical button is needed: a{' '}
          <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> command restarts a chip into
          ROM download mode (a built-in loader that takes firmware over serial), then a flashing tool
          writes the image.
        </p>
      </Card>

      <div id="two-chips" data-search-target>
        <Card>
          <CardHeader title="Two chips" subtitle="Flash each separately" />
          <p>
            Each chip flashes in two steps: a{' '}
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> into ROM download mode, then
            a flashing tool writes the image. Pick the chip with the{' '}
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> <code>target</code> byte (a
            download target: <code>0</code> for the device chip, <code>1</code> for the host chip).
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Chip</th><th>Reboot</th><th>Flashed over</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/native/architecture">Device chip</A></td>
                <td><code>target = 0</code></td>
                <td>The same <A href="/native/transport">CH343</A> serial link, with <a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer"><code>esptool</code></a>.</td>
              </tr>
              <tr>
                <td><A href="/native/architecture">Host chip</A></td>
                <td><code>target = 1</code></td>
                <td>Its own USB connection; the device relays the reboot over the inter-chip link.</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="Version scheme" subtitle="major.minor.patch" />
          <p>
            The firmware version is <code>major.minor.patch</code>. Read the running version with{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>.
          </p>
        </Card>
      </div>

      <div id="notes" data-search-target>
        <Card>
          <CardHeader title="Notes" />
          <div class="callout callout--warning">
            <ul>
              <li>
                The <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> path needs working
                firmware to receive the frame. A chip with no firmware yet (a first flash) or a bad
                image can't, so enter download mode the hardware way: hold the chip's BOOT button while
                you reset or power on the box.
              </li>
              <li>
                A run reboot (<code>target = 2</code> or <code>3</code>) is the only software
                cold-reboot; <code>DTR</code>/<code>RTS</code> aren't wired to a reset on this board.
              </li>
              <li>
                After a download reboot the serial port sits in the ROM bootloader (plain ASCII the{' '}
                <A href="/native/frame">frame decoder</A> ignores) until you finish flashing or
                power-cycle.
              </li>
              <li>Persisted per-box data survives an app reflash.</li>
            </ul>
          </div>
          <div class="callout callout--info">
            <p>
              The <code>medius</code> crate's{' '}
              <A href="/library/features/flash">flash feature</A> does this from Rust.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Flashing;
