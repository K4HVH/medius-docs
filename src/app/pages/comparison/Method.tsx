import { For, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { routeFor } from '../../routes';
import { RESULTS } from '../../data/comparison';
import { COMPARISON_PAGES } from '../../data/comparison/pages';

// One box's wiring. The other is wired the same way, on the same PC.
const RIG = `+-------------------------+
|    PC: tests, usbmon    |
+------------+------------+
             |
+------------+------------+
|           hub           |
+---+--------+--------+---+
    |        |        |
  USB1     USB2   emulator
  clone   control  control
    |        |        |
+---+--------+---+    |
|      box       |    |
+-------+--------+    |
        | USB3        |
+-------+-------------+---+
|   USB device emulator   |
+-------------------------+`;

const LAYER: Record<string, string> = { wire: 'Wire', host: 'Host', evdev: 'evdev', hidraw: 'hidraw', emulator: 'Emulator' };

// The comparison tool's tests in the order it runs them: what each sends, the layer that times it, and the sections of
// the results it compares with.
const TOOL_TESTS: { id: string; sends: string; layer: string; sections: string[] }[] = [
  { id: 'query', sends: '400 version queries, then 400 status queries, one at a time', layer: 'Wire, or Host on two buses', sections: ['link-queries'] },
  { id: 'move-latency', sends: '100 one-count moves, then 100 immediate ones, 30-60 ms apart', layer: 'Wire, or Host on two buses', sections: ['inj-latency'] },
  { id: 'move-spread', sends: '10 moves each of 1, 10 and 100 counts, then the same immediate', layer: 'evdev', sections: ['inj-settings'] },
  { id: 'release', sends: 'A left press and an X lock, then the control port closed', layer: 'evdev', sections: ['recovery-program-exit'] },
  { id: 'move-accept', sends: 'One-count moves at 500, 1,000, 2,000 and 5,000 a second for 1 s, then 200 back to back', layer: 'evdev', sections: ['link-paced-rest', 'link-one-write'] },
  { id: 'malformed', sends: '64 KB of random bytes, then half a move, each followed by a 7-count move', layer: 'evdev', sections: ['link-malformed'] },
  { id: 'ep0', sends: 'The descriptor and status reads a PC makes at enumeration, to the clone, then to the mouse on the PC', layer: 'Not timed', sections: ['devices-endpoint-0'] },
];

// Each section of the results, by id: its page's address and its title.
const SECTIONS = new Map(
  RESULTS.categories.flatMap((c) => c.sections.map((s) => [s.id, { href: `/comparison/${c.id}/${s.id}`, title: s.title }] as const)),
);

const Method: Component = () => (
  <>
    <PageHeader>
      <p>How each result was measured.</p>
    </PageHeader>

    <DocSection id="rig" title="Rig">
      <p>Both boxes are wired like this, behind the same hub on the same PC.</p>
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
            <tr><td>Hub</td><td>One Genesys Logic hub for both boxes. One box was tested at a time. The other box's emulator presented a silent mouse, or was the native reference</td></tr>
            <tr><td>Native reference</td><td>The other box's emulator, plugged straight into the PC and presenting the same device, for the tests that compare a clone with native: endpoint 0 replies, requests passed to the device, device stacks and polls</td></tr>
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
        <a href="/comparison/medius-compare.py" download="">medius-compare.py</a> runs the tests that need no USB
        device emulator, on any MAKCU box and USB mouse. Run it on stock firmware and on Medius, then compare the two
        runs. A run takes 1-2 minutes, plus the time you take to move the mouse for the last test. The figures depend on
        your mouse and PC, so they won't match the ones here exactly.
      </p>
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>Requirement</th><th>Value</th></tr>
          </thead>
          <tbody>
            <tr><td>PC</td><td>Linux, run as root</td></tr>
            <tr><td>Python</td><td><code>3.10</code> or newer, with <code>pyserial</code>, installed where <code>sudo python3</code> finds it</td></tr>
            <tr><td>Medius run</td><td>the <A href="/bindings/python/install"><code>medius</code></A> package too, the release made for the box's firmware</td></tr>
            <tr><td>Wire timing</td><td><code>USB1</code> and <code>USB2</code> on one of the PC's USB buses (<code>lsusb -t</code>). On two buses, the tool uses Host timing</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li><code>USB1</code> (clone) → this PC</li>
        <li><code>USB2</code> (control) → this PC</li>
        <li><code>USB3</code> (mouse) → your mouse</li>
      </ul>
      <p>
        The tool grabs the clone while it runs, so nothing it injects reaches your desktop. Before it lets go, it
        releases every button, key and lock it set, on Ctrl-C too. Leave the mouse still for the whole run.
      </p>
    </DocSection>

    <DocSection id="tool-run" title="Run the tool">
      <ol>
        <li>
          Find the box's control port with <code>ls /dev/serial/by-id/</code>, then run the tool on it:
          <pre><code class="language-bash">{`sudo python3 medius-compare.py run --box stock --out stock.json \\
    --port /dev/serial/by-id/usb-1a86_USB_Single_Serial_<serial>-if00`}</code></pre>
        </li>
        <li>
          For the last test, <code>ep0</code>, move the mouse from <code>USB3</code> to the PC when the tool asks,
          and press Enter. Type <code>s</code> and Enter to skip it.
        </li>
        <li>
          <A href="/dashboard/flash">Flash</A> the other firmware (the page flashes Medius or MAKCU's stock), put the
          mouse back on <code>USB3</code>, and run again with <code>--box medius --out medius.json</code>.
        </li>
        <li>
          Compare the two runs:
          <pre><code class="language-bash">{`python3 medius-compare.py report stock.json medius.json`}</code></pre>
        </li>
      </ol>
      <div class="callout callout--warning">
        <p>
          On stock, <code>move-accept</code> and <code>malformed</code> can leave the parser one command behind until
          the box is unplugged (<A href="/comparison/control-link">Control link</A>). The tool runs them after every
          other test that sends the box commands, and skips a test that sends commands while the box is behind.
        </p>
      </div>
    </DocSection>

    <DocSection id="tool-tests" title="Tool tests">
      <div class="table-scroll">
        <table class="api-params">
          <thead>
            <tr><th>Test</th><th>Sends</th><th>Timed by</th><th>Compares with</th></tr>
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
                          {k() ? ', ' : ''}
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
      <p>
        Each run writes every sample it took to the file <code>--out</code> names, with the box's firmware and the
        clone it read.
      </p>
    </DocSection>
  </>
);

export default Method;
