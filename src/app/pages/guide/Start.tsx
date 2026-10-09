import type { Component } from 'solid-js';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { IndexRow } from '../../shell/IndexRow';
import { WiringPorts } from '../dashboard/PortDiagram';

const Start: Component = () => (
  <>
    <PageHeader />

    <DocSection id="ports" title="Ports">
      <WiringPorts />
    </DocSection>

    <DocSection id="requirements" title="Requirements">
      <div class="table-scroll">
        <table class="api-params">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead><tr><th>Item</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td>Browser</td><td>Chrome or Edge on a computer</td></tr>
            <tr><td>Cables</td><td>2 USB cables, for USB1 and USB2</td></tr>
            <tr><td>Firmware</td><td>None to fetch: Set up downloads the latest release</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <nav class="index" aria-label="Guide">
      <IndexRow href="/dashboard/setup" title="Install" tag="Flash a box from the browser" />
      <IndexRow href="/dashboard/update" title="Update" tag="Latest firmware" />
      <IndexRow href="/guide/compatibility" title="Devices" tag="Mice and keyboards on the MAKCU" />
      <IndexRow href="/guide/help" title="Help" tag="Troubleshooting and FAQ" />
    </nav>
  </>
);

export default Start;
