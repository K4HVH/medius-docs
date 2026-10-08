import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { HAZARD } from '../dashboard/Setup';

const Troubleshooting: Component = () => (
  <>
    <PageHeader lead="Dashboard messages, and fixes for problems the dashboard can't see" />

    <DocSection id="messages" title="Dashboard messages" caption="Shown where Connect was">
      <div class="table-scroll">
        <table class="api-params">
          <thead><tr><th>Message</th><th>Fix</th></tr></thead>
          <tbody>
            <tr><td>This browser can't talk to your box</td><td>Open the page in Chrome or Edge on a computer.</td></tr>
            <tr><td>This page isn't secure</td><td>Open the dashboard from https://medius.k4tech.net/dashboard.</td></tr>
            <tr><td>This computer can't see your box</td><td>Plug USB2 into this computer. A box never set up needs the <A href="/guide">installer</A> first.</td></tr>
            <tr><td>Another tab or program has this box open</td><td>Close it. One program at a time holds the box.</td></tr>
            <tr><td>This computer can't read from the box</td><td>Unplug USB2 and plug it back in.</td></tr>
            <tr><td>The box isn't answering</td><td>Check USB1 is plugged in too.</td></tr>
            <tr><td>Too old to update from here</td><td>Set it up once with the <A href="/guide">installer</A>; then it updates in one click.</td></tr>
            <tr><td>The box came back, but not on the version sent</td><td>The chip kept its old firmware. Update again.</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="other" title="Other problems" caption="Outside the dashboard">
      <div class="table-scroll">
        <table class="api-params">
          <thead><tr><th>Problem</th><th>Fix</th></tr></thead>
          <tbody>
            <tr><td>Windows blue-screens</td><td>The WCH CH343 driver from Windows Update. Uninstall it and use Windows' built-in usbser.sys driver. <A href="/guide/faq#bsod">FAQ</A></td></tr>
            <tr><td>A mouse or keyboard doesn't clone, or misbehaves</td><td>Check <A href="/guide/device-fixes">Device fixes</A> for a setting it needs. If none helps, <A href="/guide/faq#report">report it</A>.</td></tr>
            <tr><td>USB1 and USB3 in one computer</td><td>Unplug one now. {HAZARD}</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>
  </>
);

export default Troubleshooting;
