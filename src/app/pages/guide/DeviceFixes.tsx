import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { LINKS } from '../../site';

const DeviceFixes: Component = () => (
  <>
    <PageHeader lead="Settings some devices need, set once from the dashboard's Options and kept on the box." />

    <DocSection id="fixes" title="Fixes" caption="Device and setting">
      <div class="table-scroll">
        <table class="api-params">
          <thead><tr><th>Device</th><th>Setting</th><th>Where</th></tr></thead>
          <tbody>
            <tr>
              <td>Logitech G PRO X2 SUPERSTRIKE, and Logitech devices stuck at 125 Hz</td>
              <td>Imperfect clone on, wire rate forced to 1000 Hz</td>
              <td><A href="/dashboard#imperfect-clone">Imperfect clone</A>, <A href="/dashboard#wire-rate">Wire rate</A></td>
            </tr>
            <tr>
              <td>Wooting keyboards</td>
              <td>Imperfect clone on (v3.4.4 or later)</td>
              <td><A href="/dashboard#imperfect-clone">Imperfect clone</A></td>
            </tr>
            <tr>
              <td>Devices over box capacity, or high speed</td>
              <td>Imperfect clone on</td>
              <td><A href="/dashboard#imperfect-clone">Imperfect clone</A></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Over capacity means more than four IN endpoints in use at once, or more than six HID interfaces; the
        Options card marks it, and high speed, under Imperfect clone. A device with a vendor bulk or
        isochronous endpoint needs imperfect clone too.
      </p>
    </DocSection>

    <DocSection id="superstrike" title="Superstrike steps" caption="Discord #guides">
      <ol>
        <li>Connect the box on the <A href="/dashboard">dashboard</A>.</li>
        <li>Under Options, press Allow imperfect.</li>
        <li>Under Emit rate, set Wire rate to Forced, enter 1000 Hz and press Apply.</li>
      </ol>
      <div class="callout callout--info">
        <p>
          The box restarts to apply a wire rate, so the option reads off for a few seconds and is back
          within 10.
        </p>
      </div>
    </DocSection>

    <DocSection id="older-firmware" title="Older firmware" caption="v3.2.0 to v3.4.3">
      <p>
        A box whose firmware is older than the dashboard's options can take the same fix from a script:
        logitech_fix.bat on Windows, logitech_fix.sh on Linux, in the{' '}
        <a href={LINKS.discord} target="_blank" rel="noreferrer">Discord</a> #tools channel. It turns on
        imperfect clones, paces injection at a fixed 1000 Hz and forces the wire rate to 1000 Hz. After an
        update, the dashboard sets them instead.
      </p>
    </DocSection>
  </>
);

export default DeviceFixes;
