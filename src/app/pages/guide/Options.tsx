import type { Component, JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { FixLink } from '../../shell/Filter';

type Cell = JSX.Element;

// Each value of an option, and the delay it adds where the values differ in one.
const Values = (props: { head?: string; delay?: boolean; rows: Cell[][] }) => (
  <div class="table-scroll">
    <table class="api-params names fixed opts">
      <colgroup>
        <col class="k" />
        <col />
        {props.delay && <col class="d" />}
      </colgroup>
      <thead>
        <tr>
          <th>{props.head ?? 'Value'}</th>
          <th>Effect</th>
          {props.delay && <th>Delay</th>}
        </tr>
      </thead>
      <tbody>{props.rows.map((r) => <tr>{r.map((c) => <td>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const Details = (props: { rows: [string, Cell][] }) => (
  <div class="table-scroll">
    <table class="api-params names fixed opts">
      <colgroup>
        <col class="k" />
        <col />
      </colgroup>
      <thead><tr><th>Item</th><th>Detail</th></tr></thead>
      <tbody>{props.rows.map(([k, v]) => <tr><td>{k}</td><td>{v}</td></tr>)}</tbody>
    </table>
  </div>
);

const Default = (props: { children: Cell }) => <>{props.children} <em>(default)</em></>;

// The option on the dashboard's Options tab.
const Dashboard = (props: { id: string }) => (
  <span class="cross" data-search-skip data-agent-hide>
    <FixLink href={`/dashboard#${props.id}`}>Dashboard</FixLink>
  </span>
);

const Fixes = () => <A href="/guide/compatibility#fixes">Device fixes</A>;

const SPREAD = `8 counts every 8 ms,
on a 1000 Hz mouse

ms    0  1  2  3  4  5  6  7
Off   8  .  .  .  .  .  .  .
Half  2  2  2  2  .  .  .  .
Full  1  1  1  1  1  1  1  1`;

const Options: Component = () => (
  <>
    <PageHeader />

    <DocSection id="box-name" title="Box name" aside={<Dashboard id="box-name" />}>
      <p>The name the dashboard shows for the box. It's stored on the box, so every PC shows the same name.</p>
      <Values
        rows={[
          [<Default><code>Medius-XXXX</code></Default>, "Made from the box's MAC address. Clear goes back to it."],
          ['A name you pick', 'Up to 32 letters, numbers and symbols. Accents and emoji are dropped.'],
        ]}
      />
    </DocSection>

    <DocSection id="imperfect-clone" title="Imperfect clone" aside={<Dashboard id="imperfect-clone" />}>
      <p>Lets the box clone a device it can't clone faithfully (byte for byte).</p>
      <Values
        rows={[
          [<Default>Faithful only</Default>, 'The box refuses a device it can\'t clone faithfully: no clone appears, and the device does nothing through the box. Control\'s Advanced rewrites are cleared.'],
          ['Allow imperfect', 'The box clones such a device anyway, as close as it can, relaying every IN endpoint (a channel the device sends reports on).'],
        ]}
      />
      <Details
        rows={[
          ['Limits', 'A device with >4 IN endpoints in use at once, >6 HID interfaces (input functions such as a mouse or a keyboard), a vendor bulk or isochronous endpoint, or high speed (480 Mbit/s).'],
          ['Never cloned', 'A device with an endpoint numbered ≥7.'],
          ['Use', <>A device that doesn't work through the box, or one the dashboard or <Fixes /> names. A forced Wire rate and Control's Advanced tab need it too.</>],
          ['Cost', 'The clone no longer matches the real device byte for byte. With >4 IN endpoints, reports on the extra ones can be relayed ≥1 poll late. The mouse, keyboard and media endpoints are never delayed.'],
          ['Restart', 'On a change, while a device the box can\'t clone faithfully is plugged in or a Wire rate is forced.'],
          ['Firmware', 'v3.4.4 or later for a device with >4 IN endpoints. On older firmware, Windows keeps resetting the clone.'],
        ]}
      />
    </DocSection>

    <DocSection id="movement-riding" title="Movement riding" aside={<Dashboard id="movement-riding" />}>
      <p>Injected motion rides native reports: it waits for the next native report and is emitted in it.</p>
      <Values
        delay
        rows={[
          [<Default>Off</Default>, 'Injected motion is emitted at once: in native reports while the mouse moves, in the box\'s reports while it\'s still.', '0 ms'],
          ['On, with a window', 'Injected motion waits up to the window (1-65535 ms) for the next native report and rides it. Motion still waiting when the window ends is dropped. The box emits no extra report for injected motion.', '≤1 native report: 1 ms at 1000 Hz'],
        ]}
      />
      <Details
        rows={[
          ['Cost', 'Injected motion does nothing while the mouse is still.'],
          ['Unaffected', 'Injected buttons, keys and media.'],
          ['Override', 'With Rendered motion at Injected and native, riding doesn\'t apply.'],
        ]}
      />
    </DocSection>

    <DocSection id="bearing" title="Bearing" aside={<Dashboard id="bearing" />}>
      <p>
        The direction of the last injected motion. Lock's <em>With injection</em> and <em>Against injection</em>{' '}
        scales compare native motion with it.
      </p>
      <Values
        head="Setting"
        rows={[
          [<>Window <em>(default 20 ms)</em></>, 'How long the last injected direction counts (1-65535 ms). Off: no bearing, so With and Against scales do nothing.'],
          [<Default>Per axis</Default>, 'X and Y compared separately: native X with injected X, native Y with injected Y.'],
          ['Vector', 'Native motion along the injected direction is scaled by the lower of the X and Y scales. The rest is unscaled.'],
        ]}
      />
      <Details
        rows={[
          ['Use', 'Only with Lock\'s With injection or Against injection scales.'],
          ['Change', 'Drops the current bearing: With and Against scales do nothing until the next injected motion.'],
        ]}
      />
    </DocSection>

    <DocSection id="render" title="Render" aside={<Dashboard id="render" />}>
      <p>
        A model learns the native report texture (the timing and size of each report your mouse sends). Render
        emits injected motion with that texture instead of as an even stream.
      </p>
      <Values
        delay
        rows={[
          ['Off', 'An even stream, paced at the Emit rate.', '0 ms'],
          ['Stock', 'The model with its original smoother. The first report of each injection carries 2× the steady amount.', '4 ms'],
          [<Default>De-spiked</Default>, 'The same smoother, ramping up to the steady amount over the first 8 ms.', '2.7 ms'],
          ['Unsmoothed', 'No smoother: the model renders injected motion as it arrives.', '0 ms'],
        ]}
      />
      <Details
        rows={[
          ['Warm-up', 'After every restart, injected motion is emitted as with Off until the model has learned from native motion.'],
          ['Firmware', 'v3.3.1 or later.'],
        ]}
      />
    </DocSection>

    <DocSection id="render-full" title="Rendered motion" aside={<Dashboard id="render-full" />}>
      <p>Which motion Render's model renders. With Render off, neither.</p>
      <Values
        delay
        rows={[
          [<Default>Injected only</Default>, 'Native motion is relayed untouched. Only injected motion is rendered.', '0 ms'],
          ['Injected and native', 'Native motion is rendered too, in one stream with injected motion. Movement riding stops applying.', 'Render\'s delay + 1 ms: 3.7 ms at De-spiked'],
        ]}
      />
    </DocSection>

    <DocSection id="spread" title="Spread" aside={<Dashboard id="spread" />}>
      <p>Spreads each command's delta (the movement it carries) across the command interval (the time until the next command). No single report carries the whole delta.</p>
      <Values
        delay
        rows={[
          ['Off', 'The whole delta is emitted in the next report.', '0 ms'],
          ['Half', 'Spread over half the command interval.', '2 ms'],
          [<Default>Full</Default>, 'Spread over the whole command interval.', '4 ms'],
        ]}
      />
      <pre class="diagram">{SPREAD}</pre>
      <Details
        rows={[
          ['Delay', 'Average at an 8 ms command interval. It scales with the interval: interval ÷ 4 at Half, ÷ 2 at Full.'],
          ['Interval', 'Learned from how often commands arrive.'],
          ['Total', 'Never changed.'],
          ['Not spread', 'Wheel motion, and commands more than ~32 ms apart.'],
          ['Firmware', 'v3.3.1 or later.'],
        ]}
      />
    </DocSection>

    <DocSection id="emit-rate" title="Emit rate" aside={<Dashboard id="emit-rate" />}>
      <p>The highest rate at which the box emits injected motion. The box emits only while motion is waiting.</p>
      <Values
        rows={[
          [<Default>Learned</Default>, 'The native report rate, measured as the mouse moves.'],
          ['Interval', 'The poll rate the clone declares to the PC: native, or a forced Wire rate.'],
          ['Fixed', 'A rate you pick (≤1000 Hz), rounded to 1000 ÷ a whole number: 1000, 500, 333, 250 and so on.'],
          ['Rendered', 'v3.3.0 only: paced by the renderer. Removed after that release.'],
        ]}
      />
      <Details
        rows={[
          ['Use', 'Software that needs a set rate. Otherwise Learned.'],
          ['Mismatch', 'Above the native report rate, the box emits reports the mouse wouldn\'t. Below it, injected motion is emitted in fewer, larger reports.'],
        ]}
      />
    </DocSection>

    <DocSection id="wire-rate" title="Wire rate" aside={<Dashboard id="wire-rate" />}>
      <p>The poll rate the clone declares to the PC (its <code>bInterval</code>). The box polls the real device at the same rate.</p>
      <Values
        rows={[
          [<Default>Native</Default>, 'The poll rate the real device declares.'],
          ['Forced', 'A rate you pick, rounded to one the PC polls at exactly: 1000, 500, 250, 125, 62, 31, 15 or 7 Hz (600 becomes 500). A low-speed device is capped at 62 Hz.'],
        ]}
      />
      <Details
        rows={[
          ['Use', <>A mouse that declares 125 Hz but reports faster, like Logitech's receivers. The dashboard offers a forced rate for such a mouse. <Fixes /> lists them.</>],
          ['Needs', 'Imperfect clone on. The clone\'s descriptor (what it tells the PC it is) no longer matches the native one.'],
          ['Restart', 'On every change. The box clones the device again.'],
        ]}
      />
    </DocSection>
  </>
);

export default Options;
