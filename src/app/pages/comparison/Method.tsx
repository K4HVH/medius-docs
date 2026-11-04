import { For, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { BoardFigure, type Port, type PortSpec } from '../../shell/Board';
import { routeFor } from '../../routes';
import { RESULTS } from '../../data/comparison';
import { COMPARISON_PAGES } from '../../data/comparison/pages';
import type { ToolData } from '../../data/comparison/generate';
import tool from '../../data/comparison/tool.json';

// One box's wiring. The other is wired the same way, on the same PC and hubs.
const RIG = `+--------------------------------+
|       PC: tests, usbmon        |
+-------+-----------------+------+
        |                 |
+-------+-------+   +-----+-----+
|    STT hub    |   |  MTT hub  |
+---+-------+---+   +-----+-----+
    |       |             |
  USB1    USB2        emulator
  clone   control     control
    |       |             |
+---+-------+---+         |
|      box      |         |
+-------+-------+         |
        | USB3            |
+-------+-----------------+------+
|      USB device emulator       |
+--------------------------------+`;

// The box wired for the comparison tool: the clone and the control port on this PC, the device on USB3.
const TOOL_WIRING: Record<Port, PortSpec> = {
  USB1: { state: 'in', label: 'This PC', tone: 'pc' },
  USB2: { state: 'in', label: 'This PC', tone: 'pc' },
  USB3: { state: 'in', label: 'Mouse/keyboard', tone: 'dev' },
};

const LAYER: Record<string, string> = { wire: 'Wire', host: 'Host', evdev: 'evdev', hidraw: 'hidraw', emulator: 'Emulator' };

// The tests the tool runs without the emulator and the run files the results were built from, both written by the
// generator from the suite and the runs.
const TOOL = tool as ToolData;
const JAMS = TOOL.tests.filter((t) => t.jamsStock).map((t) => t.id);

const BOX: Record<string, string> = { stock: 'Stock', medius: 'Medius', native: 'Native reference' };
const DEVICE: Record<string, string> = { 'still-mouse': 'mouse', 'still-keyboard': 'keyboard', 'still-composite': 'mouse and keyboard in one device' };
const devices = (ids: string[]) => {
  const said = ids.map((d) => DEVICE[d]).join(' or ') || 'none';
  return said[0].toUpperCase() + said.slice(1);
};

const PORT = '/dev/serial/by-id/usb-1a86_USB_Single_Serial_<serial>-if00';
const PYTHON = 'sudo ~/medius-compare/bin/python medius-compare.pyz';

// Each section of the results, by id: its page's address and its title.
const SECTIONS = new Map(
  RESULTS.categories.flatMap((c) => c.sections.map((s) => [s.id, { href: `/comparison/${c.id}/${s.id}`, title: s.title }] as const)),
);

const Method: Component = () => (
  <>
    <PageHeader>
      <p>How each result was measured, and a tool that runs some of the tests on any MAKCU box.</p>
    </PageHeader>

    <DocSection id="rig" title="Rig">
      <p>Both boxes are wired like this on one PC, and tested one at a time.</p>
      <pre class="diagram">{RIG}</pre>
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>Item</th><th>Detail</th></tr>
          </thead>
          <tbody>
            <tr><td>Firmware</td><td>Stock {RESULTS.firmware.stock}, Medius {RESULTS.firmware.medius}</td></tr>
            <tr><td>Real device</td><td>A USB device emulator on each box's USB3, presenting the same device and native reports to both</td></tr>
            <tr><td>Hubs</td><td>STT: a USB 2.0 hub with one transaction translator for all its ports, for both boxes' <code>USB1</code> and <code>USB2</code>. MTT: one with a translator per port, for the emulators' control ports and the native reference</td></tr>
            <tr><td>Box not under test</td><td>Its emulator presents a silent mouse, or is the native reference</td></tr>
            <tr><td>Native reference</td><td>The other box's emulator on the PC, presenting the same device, for every result compared with native</td></tr>
            <tr><td>PC</td><td>Linux</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="rules" title="Rules">
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>Rule</th><th>Detail</th></tr>
          </thead>
          <tbody>
            <tr><td>Row</td><td>One condition, run on both boxes with the same test, settings, sample size and timing layer</td></tr>
            <tr><td>Table</td><td>One quantity in one unit</td></tr>
            <tr><td>Time</td><td>The median (p50), unless the table names another statistic</td></tr>
            <tr><td>Range</td><td>Lowest to highest over the runs. The fainter part of a bar spans it</td></tr>
            <tr><td>Bar</td><td>Drawn to the largest value in its table, or in its row on the Overview</td></tr>
            <tr><td>Result</td><td>The box ahead, worked out from the values. The box behind is dimmed</td></tr>
            <tr><td>Faithful</td><td>If a test records native behaviour, the box that matches it is ahead</td></tr>
            <tr><td>Equal</td><td>The two ranges overlap, or the outcomes match</td></tr>
            <tr><td>Differs</td><td>The boxes behave differently. Neither is better, or no test shows which is faithful</td></tr>
            <tr><td>Defect</td><td>A fault that reproduces, marked on its row and listed on the Overview</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="layers" title="Timing layers">
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>Layer</th><th>Detail</th></tr>
          </thead>
          <tbody>
            <For each={Object.entries(RESULTS.layers)}>
              {([k, v]) => (
                <tr><td>{LAYER[k] ?? k}</td><td>{v}</td></tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="data" title="Data">
      <p>The results as JSON, all in one file or split by area, and the run files they were built from.</p>
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>File</th><th>Area</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><a href="/comparison.json" download="">comparison.json</a></td>
              <td>All</td>
            </tr>
            <For each={COMPARISON_PAGES.filter((p) => p.categories.length)}>
              {(p) => (
                <tr>
                  <td><a class="nw" href={`${p.path}.json`} download="">{p.path.slice(p.path.lastIndexOf('/') + 1)}.json</a></td>
                  <td>{routeFor(p.path)!.title}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>Box</th><th>Run file</th></tr>
          </thead>
          <tbody>
            <For each={TOOL.runs}>
              {(r) => {
                const name = r.file.slice(r.file.lastIndexOf('/') + 1);
                return (
                  <tr>
                    <td>{BOX[r.box]}</td>
                    <td><a class="nw" href={`/comparison/${r.file}`} download={`${r.box}-${name}`}>{name}</a></td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="tool" title="Comparison tool">
      <p>
        <a href="/comparison/medius-compare.pyz" download="">medius-compare.pyz</a> is the same engine the published
        results come from. Without the <A href="#rig">USB device emulator</A>, it runs the tests a still mouse or
        keyboard can drive, on any MAKCU box. Every other test is skipped and named in the run file with its reason.
      </p>
      <BoardFigure ports={TOOL_WIRING} />
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>Item</th><th>Detail</th></tr>
          </thead>
          <tbody>
            <tr><td>PC</td><td>Linux, run as root</td></tr>
            <tr><td>Python</td><td><code>3.11</code> or newer</td></tr>
            <tr>
              <td>Packages</td>
              <td>
                The <A href="/bindings/python/install"><code>medius</code></A> package release made for the box's
                firmware, and <code>pyserial</code>, for the Python run as root
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>A venv keeps them off the system Python:</p>
      <pre><code class="language-bash">{`python3 -m venv ~/medius-compare && ~/medius-compare/bin/pip install medius pyserial`}</code></pre>
    </DocSection>

    <DocSection id="tool-run" title="Run the tool">
      <ol>
        <li>
          On stock, find the box's control port with <code>ls /dev/serial/by-id/</code> and run:
          <pre><code class="language-bash">{`${PYTHON} run --box stock \\
    --port ${PORT} \\
    --usb-port <clone's USB port>`}</code></pre>
          Leave out <code>--usb-port</code> and it lists this PC's input devices by USB port. The clone is the one
          carrying the device plugged into the box.
        </li>
        <li>
          On Medius, the same with <code>--box medius</code> and no <code>--usb-port</code> (the box says what it
          cloned):
          <pre><code class="language-bash">{`${PYTHON} run --box medius \\
    --port ${PORT}`}</code></pre>
        </li>
        <li>
          Each run writes <code>runs/&lt;box&gt;/&lt;stamp&gt;.json</code>. Compare two:
          <pre><code class="language-bash">{`python3 medius-compare.pyz report <stock file> <Medius file>`}</code></pre>
        </li>
      </ol>
      <p>
        The clone is kept off the desktop while the tool runs, so nothing injected reaches it, and handed back at
        exit, <span class="nw">Ctrl-C</span> included. Leave the device untouched: a leg refuses to start if it moved.
      </p>
      <div class="callout callout--warning">
        <p>
          On stock,{' '}
          <For each={JAMS}>
            {(id, k) => (
              <>
                {k() ? (k() === JAMS.length - 1 ? ' and ' : ', ') : ''}
                <code>{id}</code>
              </>
            )}
          </For>{' '}
          can leave the box's parser one reply behind until a power cycle (
          <A href="/comparison/control-link">Control link</A>). Each runs once on stock unless{' '}
          <code>--stock-jam-runs</code> asks for more. When one leaves it behind, the tool asks for both the box's
          cables to be unplugged for 3 s and plugged back in, and waits for Enter. <code>--test</code> runs only the
          tests it names (repeat it for more), so a run can leave these out.
        </p>
      </div>
    </DocSection>

    <DocSection id="tool-tests" title="Tool tests">
      <div class="table-scroll">
        <table class="api-params">
          <thead>
            <tr><th>Test</th><th>Device</th><th>Sections</th></tr>
          </thead>
          <tbody>
            <For each={TOOL.tests}>
              {(t) => (
                <tr>
                  <td><code>{t.id}</code></td>
                  <td>{devices(t.devices)}</td>
                  <td>
                    <For each={t.sections}>
                      {(id, k) => (
                        <>
                          {k() ? <br /> : ''}
                          <A href={SECTIONS.get(id)!.href}>{SECTIONS.get(id)!.title}</A>
                        </>
                      )}
                    </For>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </DocSection>
  </>
);

export default Method;
