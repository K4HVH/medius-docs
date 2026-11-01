import { For, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { BoardFigure, type Port, type PortSpec } from '../../shell/Board';
import { routeFor } from '../../routes';
import { RESULTS } from '../../data/comparison';
import { COMPARISON_PAGES } from '../../data/comparison/pages';

// One box's wiring. The other is wired the same way, on the same PC and hubs.
const RIG = `+--------------------------------+
|       PC: tests, usbmon        |
+-------+-----------------+------+
        |                 |
+-------+-------+   +-----+-----+
|  Genesys hub  |   |  VIA hub  |
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

// The box wired for the comparison tool: the clone and the control port on this PC, the mouse on USB3.
const TOOL_WIRING: Record<Port, PortSpec> = {
  USB1: { state: 'in', label: 'This PC', tone: 'pc' },
  USB2: { state: 'in', label: 'This PC', tone: 'pc' },
  USB3: { state: 'in', label: 'Mouse', tone: 'dev' },
};

const LAYER: Record<string, string> = { wire: 'Wire', host: 'Host', evdev: 'evdev', hidraw: 'hidraw', emulator: 'Emulator' };

// The comparison tool's tests in the order it runs them: what each sends, the layer that times it, and the sections of
// the results it compares with.
const TOOL_TESTS: { id: string; sends: string; layer: string; sections: string[] }[] = [
  { id: 'query', sends: '400 version queries, then 400 status queries, one at a time', layer: 'Wire, or Host on two buses', sections: ['link-queries'] },
  { id: 'move-latency', sends: '100 one-count moves, then 100 immediate ones, 30-60 ms apart', layer: 'Wire, or evdev on two buses', sections: ['inj-latency'] },
  { id: 'move-spread', sends: '10 moves each of 1, 10 and 100 counts, then the same immediate', layer: 'evdev', sections: ['inj-settings'] },
  { id: 'release', sends: 'A left press, a key press (if the clone has a keyboard) and an X lock, the control port closed after each', layer: 'evdev', sections: ['recovery-program-exit'] },
  { id: 'move-accept', sends: 'One-count moves at 500, 1,000, 2,000 and 5,000/s for 1 s each, then 200 at once: one write on stock, back to back on Medius', layer: 'evdev', sections: ['link-paced-rest', 'link-one-write'] },
  { id: 'malformed', sends: '64 KB of random bytes, then half a move, each followed by a 7-count move', layer: 'evdev', sections: ['link-malformed'] },
  { id: 'ep0', sends: 'The descriptor and status reads a PC makes at enumeration, to the clone, then to the mouse plugged into the PC. The device descriptor, configuration descriptor, product string and GET_STATUS are timed over 100 reads each', layer: 'Wire', sections: ['devices-endpoint-0'] },
];

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
            <tr><td>Hubs</td><td>Genesys Logic for both boxes' <code>USB1</code> and <code>USB2</code>. VIA Labs for the emulators' control ports and the native reference</td></tr>
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
      <p>The results as JSON, all in one file or split by area.</p>
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
    </DocSection>

    <DocSection id="tool" title="Comparison tool">
      <p>
        The results come from the USB device emulator in the <A href="#rig">rig</A>, which isn't public. Most tests
        need it. It plays scripted native reports, presents device shapes no product has, and records what the box
        relays to it. <a href="/comparison/medius-compare.py" download="">medius-compare.py</a> runs tests from 8 of
        the 47 measured sections with a USB mouse, on any MAKCU box. A run takes 1-2 minutes. The figures depend on
        your mouse and PC, so they won't match the published ones exactly.
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
            <tr><td>Python</td><td><code>3.10</code> or newer, with <code>pyserial</code> installed for root</td></tr>
            <tr><td>Medius run</td><td>The <A href="/bindings/python/install"><code>medius</code></A> package release made for the box's firmware, installed for root</td></tr>
            <tr><td>Wire timing</td><td><code>USB1</code> and <code>USB2</code> on one USB bus (<code>lsusb -t</code>). On two buses, <code>query</code> falls back to Host timing and <code>move-latency</code> to evdev</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="tool-run" title="Run the tool">
      <ol>
        <li>
          On stock firmware, find the box's control port with <code>ls /dev/serial/by-id/</code>, then run the tool
          on it:
          <pre><code class="language-bash">{`sudo python3 medius-compare.py run --box stock --out stock.json \\
    --port /dev/serial/by-id/usb-1a86_USB_Single_Serial_<serial>-if00`}</code></pre>
          Leave the mouse still while it runs. The tool grabs the clone, so nothing it injects reaches your desktop. It
          releases every button, key and lock it set before it exits, Ctrl-C included.
        </li>
        <li>
          For the last test, <code>ep0</code>, move the mouse from <code>USB3</code> to the PC when the tool asks,
          and press Enter. Type <code>s</code> and Enter to skip it.
        </li>
        <li>
          <A href="/dashboard/flash">Flash</A> Medius, put the mouse back on <code>USB3</code>, and run again with{' '}
          <code>--box medius --out medius.json</code>.
        </li>
        <li>
          Compare the two runs:
          <pre><code class="language-bash">{`python3 medius-compare.py report stock.json medius.json`}</code></pre>
        </li>
      </ol>
      <div class="callout callout--warning">
        <p>
          On stock, <code>move-accept</code> and <code>malformed</code> can leave the parser one command behind until a
          power cycle (<A href="/comparison/control-link">Control link</A>). The tool runs them after every other test
          that sends commands, and skips any test that sends commands while the box is behind. If a run ends with the
          box behind, unplug everything from it and plug it back in before the next run.
        </p>
      </div>
    </DocSection>

    <DocSection id="tool-tests" title="Tool tests">
      <div class="table-scroll">
        <table class="api-params">
          <thead>
            <tr><th>Test</th><th>Sends</th><th>Layer</th><th>Section</th></tr>
          </thead>
          <tbody>
            <For each={TOOL_TESTS}>
              {(t) => (
                <tr>
                  <td><code>{t.id}</code></td>
                  <td>{t.sends}</td>
                  <td>{t.layer}</td>
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
