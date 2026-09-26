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
          A box already running Medius updates over the control port with{' '}
          <A href="/native/commands/update"><code>UPDATE</code></A>. This page is for a chip that
          can't: one never given the two-slot layout, or one whose app won't boot.
        </p>
        <p>
          While firmware runs, no button is needed:{' '}
          <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> restarts a chip into ROM
          download mode (a built-in serial loader), then a flashing tool writes the image.
        </p>
        <div class="callout callout--info">
          <p>
            Write the bootloader, partition table, app and a blank <code>otadata</code> together, or
            the factory image, which contains all four.
          </p>
          <p>
            An app image alone keeps the chip's existing layout, and a one-slot chip replies{' '}
            <code>NOSLOT</code> to <A href="/native/commands/update"><code>UPDATE</code></A>. The two
            slots are a partition-table change: one flash from here per chip, once per box.
          </p>
        </div>
      </Card>

      <div id="two-chips" data-search-target>
        <Card>
          <CardHeader title="Two chips" subtitle="Flash each separately" />
          <p>
            The <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> <code>target</code>{' '}
            byte picks the chip.
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
            source; binary and tag can't drift.
          </p>
          <p>
            The <A href="/native/connection#handshake">protocol version</A> is a separate byte, the one
            a host checks for compatibility; the firmware version identifies the build.{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> returns both.
          </p>
        </Card>
      </div>

      <div id="notes" data-search-target>
        <Card>
          <CardHeader title="Notes" />
          <p>
            A run reboot (<code>target = 2</code> or <code>3</code>) is the only software cold-reboot;{' '}
            <code>DTR</code>/<code>RTS</code> aren't wired to reset on this board.
          </p>
          <p>
            After a download reboot the port stays in the ROM bootloader (plain ASCII the{' '}
            <A href="/native/frame">frame decoder</A> ignores) until flashing finishes or a
            power-cycle. Persisted per-box data survives an app reflash.
          </p>
          <div class="callout callout--warning">
            <p>
              <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> needs working firmware
              to receive the frame. For a chip with no firmware or a bad image, hold its BOOT button
              while resetting or powering on the box.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              From Rust, the crate's <A href="/library/update">firmware update</A> calls write both
              chips over the open connection.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Flashing;
