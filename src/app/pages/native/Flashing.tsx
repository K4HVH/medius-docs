import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Flashing: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Flashing" subtitle="First install and recovery" />
        <p>
          A box already running Medius takes new firmware over the control port with{' '}
          <A href="/native/commands/update"><code>UPDATE</code></A>, and nothing on this page applies.
          What follows is for a chip that cannot do that: one that has never had the two-slot layout
          written, or one whose app will not boot.
        </p>
        <p>
          No physical button is needed while firmware still runs. A{' '}
          <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> command restarts a chip into
          ROM download mode (a built-in loader that takes firmware over serial), then a flashing tool
          writes the image.
        </p>
        <div class="callout callout--info">
          <p>
            Write the bootloader, the partition table, the app and a blank <code>otadata</code>{' '}
            together, or use the factory image, which contains all four. An app image on its own keeps
            whatever layout the chip already has, and a chip with one app slot answers{' '}
            <code>NOSLOT</code> to an{' '}
            <A href="/native/commands/update"><code>UPDATE</code></A>. Installing the two slots is a
            partition-table change, which an update cannot perform, so it takes one flash from here
            per chip, once per box.
          </p>
        </div>
      </Card>

      <div id="two-chips" data-search-target>
        <Card>
          <CardHeader title="Two chips" subtitle="Flash each separately" />
          <p>
            Pick the chip with the{' '}
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> <code>target</code> byte,
            then flash it over the link in the table.
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
            Both chips carry the same firmware version, stamped into their app descriptors from one
            source, so the binary and the tag cannot drift apart.
          </p>
          <p>
            The <A href="/native/connection#handshake">protocol version</A> is a separate byte and is
            the one a host checks for compatibility; the firmware version identifies the build. Both
            come back in the same reply, from{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>.
          </p>
        </Card>
      </div>

      <div id="notes" data-search-target>
        <Card>
          <CardHeader title="Notes" />
          <p>
            A run reboot (<code>target = 2</code> or <code>3</code>) is the only software cold-reboot;{' '}
            <code>DTR</code>/<code>RTS</code> are not wired to a reset on this board.
          </p>
          <p>
            After a download reboot the serial port sits in the ROM bootloader, plain ASCII the{' '}
            <A href="/native/frame">frame decoder</A> ignores, until you finish flashing or
            power-cycle. Persisted per-box data survives an app reflash.
          </p>
          <div class="callout callout--warning">
            <p>
              The <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> path needs working
              firmware to receive the frame. A chip with no firmware yet, or a bad image, cannot, so
              enter download mode the hardware way: hold the chip's BOOT button while you reset or
              power on the box.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              None of this is needed for a box that already runs Medius. From Rust, the crate's{' '}
              <A href="/library/update">firmware update</A> calls write both chips over the open
              connection.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Flashing;
