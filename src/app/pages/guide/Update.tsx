import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { IndexRow } from '../../shell/IndexRow';
import { LINKS } from '../../site';

const Update: Component = () => (
  <>
    <PageHeader lead="A box already running Medius updates over USB2 from the dashboard, wired as it is." />

    <DocSection id="one-click" title="Update" caption="From the Update tab">
      <div class="table-scroll">
        <table class="api-params">
          <thead><tr><th>Step</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td>Connect</td><td>USB2 into this computer, USB1 and USB3 as they are. The tab shows the version the box runs and the latest release.</td></tr>
            <tr><td>Choose</td><td>Update both chips, or the main chip or the mouse-side chip alone.</td></tr>
            <tr><td>Update</td><td>Each chip writes the new firmware beside the one it runs, then boots it. The mouse-side chip's copy goes through the main chip.</td></tr>
            <tr><td>Result</td><td>"Updated and verified", with the version the box now runs.</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="set-up-instead" title="Set up instead" caption="Firmware older than v3.2.0">
      <p>
        Over USB2 the dashboard updates boxes from v3.2.0 (protocol 5) on. An older box reads "too old to
        update from here": install it once with the <A href="/guide">installer</A>, and from then on it
        updates in one click.
      </p>
      <p>
        A box on newer firmware than the page knows asks for a reload. Advanced can still flash it.
      </p>
    </DocSection>

    <DocSection id="rollback" title="Rollback" caption="Old firmware kept">
      <div class="table-scroll">
        <table class="api-params">
          <thead><tr><th>Case</th><th>Fix</th></tr></thead>
          <tbody>
            <tr><td>The new firmware won't run</td><td>The chip boots the firmware it ran before, and the dashboard reads "The box came back, but not on the version sent". Update again.</td></tr>
            <tr><td>MAKCU's own firmware</td><td>The fetch_makcu_fw script in the <a href={LINKS.discord} target="_blank" rel="noreferrer">Discord</a> #tools channel downloads MAKCU v4 firmware. Flash it with Upload a file on <A href="/dashboard/advanced">Advanced</A>.</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="open" title="Updater">
      <IndexRow href="/dashboard/update" title="Update" tag="Update and configure a box" />
    </DocSection>
  </>
);

export default Update;
