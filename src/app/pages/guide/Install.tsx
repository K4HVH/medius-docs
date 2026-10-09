import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { IndexRow } from '../../shell/IndexRow';
import { ClearPort, InstallPorts, WiringPorts } from '../dashboard/PortDiagram';

const Install: Component = () => (
  <>
    <PageHeader lead="Flash Medius onto a MAKCU box from Chrome or Edge, with nothing to download" />

    <DocSection id="need" title="Requirements" caption="One computer, two cables">
      <div class="table-scroll">
        <table class="api-params">
          <thead><tr><th>Item</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td>Box</td><td>A MAKCU box. Its ports are numbered USB1, USB2 and USB3, with a button beside USB1 and one beside USB3.</td></tr>
            <tr><td>Browser</td><td>Chrome or Edge on a computer. The installer reaches the box through Web Serial.</td></tr>
            <tr><td>Cables</td><td>Two USB cables, for USB1 and USB2. USB3 takes the mouse or keyboard cable.</td></tr>
            <tr><td>Firmware</td><td>None to fetch. The installer downloads the latest release itself.</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="steps" title="Steps" caption="Five, one chip at a time">
      <p>
        The box has two chips: the main chip behind USB1 and USB2, and the mouse-side chip behind USB3.
        The installer flashes each in turn, so only one port is plugged into this computer at a time.
      </p>
      <div class="api-response-label">1 · Main chip</div>
      <InstallPorts socket="usb1" />
      <p>Then press Install.</p>
      <div class="api-response-label">2 · Unplug USB1</div>
      <ClearPort socket="usb1" />
      <div class="api-response-label">3 · Mouse-side chip</div>
      <InstallPorts socket="usb3" />
      <p>Then press Install.</p>
      <div class="api-response-label">4 · Unplug USB3</div>
      <ClearPort socket="usb3" />
      <div class="api-response-label">5 · Wire the box</div>
      <WiringPorts />
      <p>
        USB1 to the game PC, USB2 to this computer, your mouse or keyboard into USB3. Press Connect; the
        installer finds the box and says Installed.
      </p>
    </DocSection>

    <DocSection id="power" title="Power" caption="USB1 and USB3">
      <div class="callout callout--danger">
        <p>
          USB3's 5 V is wired to the board's power rail. With USB1 in the same computer, the box feeds power
          back into that computer: it has shut a laptop down and drained its battery. USB3 goes into a computer
          only to install, with USB1 out; otherwise it takes the mouse or keyboard.
        </p>
      </div>
    </DocSection>

    <DocSection id="failed" title="Failed flash" caption="Nothing is lost">
      <p>
        Each chip's download mode is in ROM, so a flash that stops partway never locks the chip out.
        Hold the button again, plug the port back in and press Install.
      </p>
      <p>
        A box that won't connect after installing: see{' '}
        <A href="/guide/troubleshooting">Troubleshooting</A>.
      </p>
    </DocSection>

    <DocSection id="open" title="Installer">
      <IndexRow href="/dashboard/setup" title="Set up" tag="Flash a box from the browser" />
    </DocSection>
  </>
);

export default Install;
