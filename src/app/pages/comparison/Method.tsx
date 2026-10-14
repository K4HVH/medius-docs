import { For, type Component } from 'solid-js';
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

const LAYER: Record<string, string> = { wire: 'Wire', host: 'Host', evdev: 'evdev', hidraw: 'hidraw' };

// The pending tests by area, in page order.
const pendingByArea = () =>
  COMPARISON_PAGES.filter((p) => p.categories.length)
    .map((p) => ({ page: p, tests: RESULTS.pending.filter((x) => p.categories.includes(x.category)) }))
    .filter((a) => a.tests.length);

const Method: Component = () => (
  <>
    <PageHeader>
      <p>How each result was measured, and the tests not yet run on both boxes the same way.</p>
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
            <tr><td>Hub</td><td>One Genesys Logic hub for both boxes. One box was tested at a time, the other's emulator presenting a silent mouse</td></tr>
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
            <tr><td>Faithful</td><td>Where a test records the native behaviour, the box that matches it is ahead</td></tr>
            <tr><td>Equal</td><td>The two ranges overlap, or the outcomes match</td></tr>
            <tr><td>Differs</td><td>The boxes behave differently, and neither is better or no test shows which is faithful</td></tr>
            <tr><td>Defect</td><td>A fault that reproduces, marked on its row and listed on the Overview</td></tr>
            <tr><td>Pending</td><td>A test not yet run the same way on both boxes. Listed below, not compared</td></tr>
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

    <DocSection id="pending" title="Pending tests">
      <For each={pendingByArea()}>
        {(a) => (
          <>
            <p class="api-response-label">{routeFor(a.page.path)!.title}</p>
            <ul>
              <For each={a.tests}>{(x) => <li>{x.test}</li>}</For>
            </ul>
          </>
        )}
      </For>
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
  </>
);

export default Method;
