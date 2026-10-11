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

const Fixes = () => <A href="/guide/compatibility#device-fixes">Device fixes</A>;

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
      <p>Lets the box clone a device it can't copy exactly.</p>
      <Values
        rows={[
          [<Default>Faithful only</Default>, 'A device the box can\'t copy exactly is refused: no clone appears, and the device does nothing through the box. Control\'s Advanced rewrites are cleared.'],
          ['Allow imperfect', 'The box clones it anyway, as close as it can, with every IN endpoint working.'],
        ]}
      />
      <Details
        rows={[
          ['Limits', 'More than 4 IN endpoints in use at once, more than 6 HID interfaces, a vendor bulk or isochronous endpoint, or high speed.'],
          ['Never cloned', 'A device with an endpoint numbered 7 or higher.'],
          ['Use', <>A device that doesn't work through the box, or one the dashboard or <Fixes /> names. A forced Wire rate and Control's Advanced tab need it too.</>],
          ['Cost', 'The clone no longer matches the device byte for byte. With more than 4 IN endpoints, reports on the extra ones can arrive a poll or more late; the mouse, keyboard and media are never held up.'],
          ['Restart', 'On a change with such a device plugged in, or with a Wire rate forced.'],
          ['Firmware', 'v3.4.4 or later for a device with more than 4 IN endpoints. Before it, Windows keeps resetting the clone.'],
        ]}
      />
    </DocSection>

    <DocSection id="movement-riding" title="Movement riding" aside={<Dashboard id="movement-riding" />}>
      <p>Holds injected movement (what your software sends through the box) until your mouse sends a report.</p>
      <Values
        delay
        rows={[
          [<Default>Off</Default>, 'Injected movement goes out straight away: in your mouse\'s reports while it moves, in extra reports from the box while it\'s still.', '0 ms'],
          ['On, with a window', 'Injected movement waits for your mouse\'s next report, up to the window (1 to 65535 ms), and goes out in it. Anything still waiting at the end of the window is dropped. The box sends no report your mouse didn\'t.', 'Up to 1 report: 1 ms at 1000 Hz'],
        ]}
      />
      <Details
        rows={[
          ['Cost', 'Injected movement does nothing while your mouse is still.'],
          ['Unaffected', 'Buttons, keys and media.'],
          ['Override', 'Rendered motion set to Injected and native ignores this setting.'],
        ]}
      />
    </DocSection>

    <DocSection id="bearing" title="Bearing" aside={<Dashboard id="bearing" />}>
      <p>
        The direction of the last injected movement. Lock's <em>With injection</em> and <em>Against injection</em>{' '}
        scales compare your mouse's movement with it.
      </p>
      <Values
        head="Setting"
        rows={[
          [<>Window <em>(default 20 ms)</em></>, 'How long the last injected direction counts, 1 to 65535 ms. Off: no bearing, so With and Against scales do nothing.'],
          [<Default>Per axis</Default>, 'X and Y compared separately: your X movement with the injected X, your Y with the injected Y.'],
          ['Vector', 'Your movement along the injected direction is scaled, by the lower of the X and Y scales. The rest is left alone.'],
        ]}
      />
      <Details
        rows={[
          ['Use', 'Only with Lock\'s With injection or Against injection scales.'],
          ['Change', 'Drops the current bearing: one jump in the scaled movement.'],
        ]}
      />
    </DocSection>

    <DocSection id="render" title="Render" aside={<Dashboard id="render" />}>
      <p>
        Sends injected movement with your mouse's report timing and sizes, learned by a model as you move it,
        instead of an even stream.
      </p>
      <Values
        delay
        rows={[
          ['Off', 'An even stream at the Emit rate.', '0 ms'],
          ['Stock', 'The model with its original smoother. The first report of each movement carries twice the steady amount.', '4 ms'],
          [<Default>De-spiked</Default>, 'The same smoother, starting at once and ramping up to the steady amount over 8 ms.', '2.7 ms'],
          ['Unsmoothed', 'No smoother: the model gets injected movement as it arrives.', '0 ms'],
        ]}
      />
      <Details
        rows={[
          ['Warm-up', 'After every restart the model needs to see your mouse move. Until then, injected movement goes out as with Off.'],
          ['Firmware', 'v3.3.1 or later.'],
        ]}
      />
    </DocSection>

    <DocSection id="render-full" title="Rendered motion" aside={<Dashboard id="render-full" />}>
      <p>Which movement goes through Render's model. With Render off, neither does.</p>
      <Values
        delay
        rows={[
          [<Default>Injected only</Default>, 'Your mouse\'s movement passes through untouched. Only injected movement is rendered.', '0 ms'],
          ['Injected and native', 'Your mouse\'s (native) movement goes through the model too, in one stream with injected movement. Movement riding stops applying.', 'Render\'s delay + 1 ms: 3.7 ms at De-spiked'],
        ]}
      />
    </DocSection>

    <DocSection id="spread" title="Spread" aside={<Dashboard id="spread" />}>
      <p>Splits each command's movement across the time until the next command, so one report doesn't carry it all.</p>
      <Values
        delay
        rows={[
          ['Off', 'The whole command on the next report.', '0 ms'],
          ['Half', 'Spread over half the time until the next command.', '2 ms'],
          [<Default>Full</Default>, 'Spread over the whole time until the next command.', '4 ms'],
        ]}
      />
      <pre class="diagram">{SPREAD}</pre>
      <Details
        rows={[
          ['Delay', 'Average for commands 8 ms apart. It scales with the gap: gap ÷ 4 at Half, gap ÷ 2 at Full.'],
          ['Gap', 'Learned from how often commands arrive.'],
          ['Total', 'Never changed.'],
          ['Not spread', 'The wheel, and commands more than about 32 ms apart.'],
          ['Firmware', 'v3.3.1 or later.'],
        ]}
      />
    </DocSection>

    <DocSection id="emit-rate" title="Emit rate" aside={<Dashboard id="emit-rate" />}>
      <p>The fastest the box sends injected movement. Nothing goes out while no movement is waiting.</p>
      <Values
        rows={[
          [<Default>Learned</Default>, 'Your mouse\'s report rate, measured as you move it.'],
          ['Interval', 'The rate the clone declares to the PC: your mouse\'s, or a forced Wire rate.'],
          ['Fixed', 'A rate you pick, up to 1000 Hz, rounded to 1000 divided by a whole number: 1000, 500, 333, 250 and so on.'],
          ['Rendered', 'v3.3.0 only: paced by the renderer. Removed after that release.'],
        ]}
      />
      <Details
        rows={[
          ['Use', 'Software that needs a set rate. Otherwise Learned.'],
          ['Mismatch', 'Above your mouse\'s rate, the box sends reports your mouse wouldn\'t. Below it, injected movement goes out in fewer, bigger reports.'],
        ]}
      />
    </DocSection>

    <DocSection id="wire-rate" title="Wire rate" aside={<Dashboard id="wire-rate" />}>
      <p>The polling rate the clone declares to the PC. The box polls your device at the same rate.</p>
      <Values
        rows={[
          [<Default>Native</Default>, 'What your device declares.'],
          ['Forced', 'A rate you pick, set to one the PC polls at exactly: 1000, 500, 250, 125, 62, 31, 15 or 7 Hz (600 becomes 500). A low-speed device can\'t go above 62 Hz.'],
        ]}
      />
      <Details
        rows={[
          ['Use', <>A mouse that declares 125 Hz but reports faster, like Logitech's receivers. The dashboard offers it for one, and <Fixes /> lists them.</>],
          ['Needs', 'Imperfect clone on, since the clone\'s descriptor no longer matches the device.'],
          ['Restart', 'On every change. The box clones the device again.'],
        ]}
      />
    </DocSection>
  </>
);

export default Options;
