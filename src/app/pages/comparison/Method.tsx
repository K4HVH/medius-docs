import { For, type Component } from 'solid-js';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { routeFor } from '../../routes';
import { RESULTS } from '../../data/comparison';
import { COMPARISON_PAGES } from '../../data/comparison/pages';
import { SourceLine } from './parts';

const RIG = `                the PC: test programs
   +---------------------------------------------------------+
                               |
   +---------------------------+-----------------------------+
   |  hub                                                    |
   +----+-----------------+------------------+---------------+
        ^                 |                  |
        | USB1: the clone | USB2: control    | emulator
        |                 |                  | control
        |                 v                  v
   +----+-----------------+----+        +----+---------------+
   |  MAKCU box                |  USB3  |  USB device        |
   |  stock or Medius          | <----- |  emulator          |
   +---------------------------+        +--------------------+

   The same again for the other box, behind a second hub.`;

const Method: Component = () => (
  <>
    <PageHeader>
      <p>How each result was measured, what the timings can see, and what hasn't been tested yet.</p>
    </PageHeader>

    <DocSection id="rig" title="Rig">
      <p>Two MAKCU boxes, one on stock firmware and one on Medius, measured side by side.</p>
      <pre class="diagram">{RIG}</pre>
      <p>{RESULTS.rig}.</p>
      <p>The emulator plays a device shape or a scripted stream of reports, so both boxes get the same input.</p>
    </DocSection>

    <DocSection id="conventions" title="Conventions">
      <div class="table-scroll">
        <table class="api-params names fixed opts">
          <colgroup>
            <col class="k" />
            <col />
          </colgroup>
          <thead><tr><th>Item</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td>Times</td><td>The median (p50), unless the test names another figure (p95, sd)</td></tr>
            <tr><td>Ranges</td><td><code>a-b</code> runs from the lowest value to the highest over what the test covers: runs, hubs, shapes, rates or counts</td></tr>
            <tr><td>A row</td><td>Both cells come from the same test, settings and timing layer</td></tr>
            <tr><td>Interval sd</td><td>Timed from usbmon completions, so the PC's interrupt jitter dominates it. The counts of slipped intervals are the steadier relay measure</td></tr>
            <tr><td>Equal</td><td>The ranges over runs and hubs overlap, or both boxes give the same outcome. Each box gets the same number of runs</td></tr>
            <tr><td>Mixed</td><td>Ahead on one part of the row and behind on another; the cells say which</td></tr>
            <tr><td>By design</td><td>The boxes differ by choice, not by a fault</td></tr>
            <tr><td>Unranked</td><td>The two rigs differ in a way that decides the result; the row says how</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="layers" title="Timing layers">
      <p>Where a row names a timing layer, both its cells were timed there.</p>
      <div class="table-scroll">
        <table class="api-params names fixed opts">
          <colgroup>
            <col class="k" />
            <col />
          </colgroup>
          <thead><tr><th>Layer</th><th>What it sees</th></tr></thead>
          <tbody>
            <For each={Object.entries(RESULTS.layers)}>{([k, v]) => <tr><td>{k}</td><td>{v}</td></tr>}</For>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="pending" title="Pending tests">
      <div class="table-scroll">
        <table class="api-params names">
          <thead><tr><th>Test</th></tr></thead>
          <tbody>
            <For each={RESULTS.pending}>{(p) => <tr><td>{p.test}</td></tr>}</For>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="data" title="Data">
      <p>Every result as JSON, whole or a page at a time, in the format the pages are drawn from.</p>
      <div class="table-scroll">
        <table class="api-params names fixed vs-files">
          <colgroup>
            <col class="k" />
            <col />
          </colgroup>
          <thead><tr><th>File</th><th>Holds</th></tr></thead>
          <tbody>
            <tr><td><a href="/comparison.json" download="">comparison.json</a></td><td>Every result, the versions and the rig</td></tr>
            <For each={COMPARISON_PAGES.filter((p) => p.categories.length)}>
              {(p) => (
                <tr>
                  <td><a href={`${p.path}.json`} download="">{p.path.slice(p.path.lastIndexOf('/') + 1)}.json</a></td>
                  <td>{routeFor(p.path)!.title}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </DocSection>

    <SourceLine path="/comparison/method" bare />
  </>
);

export default Method;
