import type { Component, JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { FixLink } from '../../shell/Filter';

const Values = (props: { head?: string; rows: [JSX.Element, JSX.Element][] }) => (
  <div class="table-scroll">
    <table class="api-params names fixed opts">
      <colgroup>
        <col class="k" />
        <col />
      </colgroup>
      <thead><tr><th>{props.head ?? 'Value'}</th><th>Effect</th></tr></thead>
      <tbody>{props.rows.map(([v, d]) => <tr><td>{v}</td><td>{d}</td></tr>)}</tbody>
    </table>
  </div>
);

const Default = (props: { children: JSX.Element }) => <>{props.children} <em>(default)</em></>;

// The option on the dashboard's Options tab.
const Dashboard = (props: { id: string }) => (
  <span class="cross" data-search-skip data-agent-hide>
    <FixLink href={`/dashboard#${props.id}`}>Dashboard</FixLink>
  </span>
);

const Fixes = () => <A href="/guide/compatibility#device-fixes">Device fixes</A>;

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
      <p>
        The box can't copy a device exactly if it has more than 4 IN endpoints in use at once, more than 6 HID
        interfaces, a vendor bulk or isochronous endpoint, or runs at high speed. A device with an endpoint
        numbered 7 or higher can't be cloned at all.
      </p>
      <Values
        rows={[
          [<Default>Faithful only</Default>, 'A device the box can\'t copy exactly is refused. No clone appears, and the device does nothing through the box.'],
          ['Allow imperfect', 'The box clones it anyway, as close as it can, with every IN endpoint working.'],
        ]}
      />
      <p>
        Turn it on when a device doesn't work through the box, or when the dashboard or <Fixes /> says to. A forced
        Wire rate and Control's Advanced tab need it on too. A device the box can copy exactly isn't affected.
      </p>
      <p>
        The clone no longer matches the device byte for byte. On a device with more than 4 IN endpoints, reports on
        the extra ones can arrive a poll or more late; the mouse, keyboard and media are never held up.
      </p>
      <p>
        Changing it with such a device plugged in, or with a Wire rate forced, restarts the box, which clones the
        device again. Turning it off clears Control's Advanced rewrites.
      </p>
      <p>
        Before v3.4.4, an endpoint past the fourth went unanswered and Windows kept resetting the clone. Update before
        turning this on for such a device.
      </p>
    </DocSection>

    <DocSection id="movement-riding" title="Movement riding" aside={<Dashboard id="movement-riding" />}>
      <p>
        Holds injected movement (what your software sends through the box) until your mouse sends a report, then
        adds it to that report. With it on, the box sends no report your mouse didn't.
      </p>
      <Values
        rows={[
          [<Default>Off</Default>, 'Injected movement goes out straight away. While your mouse moves, it\'s added to your mouse\'s reports. While your mouse is still, the box sends extra reports to carry it.'],
          ['On, with a window', 'Injected movement waits up to the window, 1 to 65535 ms, for your mouse\'s next report and goes out in it. Anything still waiting when the window runs out is dropped.'],
        ]}
      />
      <p>
        Turn it on if the clone should send exactly as many reports as your mouse. The catch: injected movement does
        nothing while your mouse is still. Buttons, keys and media go out straight away either way.
      </p>
      <p>Rendered motion set to Injected and native ignores this setting.</p>
    </DocSection>

    <DocSection id="bearing" title="Bearing" aside={<Dashboard id="bearing" />}>
      <p>
        Lock's <em>With injection</em> and <em>Against injection</em> scales change your mouse's movement by whether
        it goes the same way as the injected movement or against it. The bearing is the direction they compare with:
        the way the last injected movement went.
      </p>
      <Values
        head="Setting"
        rows={[
          [<>Window <em>(default 20 ms)</em></>, 'How long the last injected direction counts, 1 to 65535 ms. Off means no bearing, so With and Against scales do nothing.'],
          [<Default>Per axis</Default>, 'X and Y are compared separately: your X movement with the injected X direction, your Y with the injected Y.'],
          ['Vector', 'Your movement along the injected direction is scaled, by the lower of the X and Y scales. The rest of it is left alone.'],
        ]}
      />
      <p>
        It only matters if you use With or Against scales. Changing it drops the current bearing, which shows as a
        small jump in the scaled movement.
      </p>
    </DocSection>

    <DocSection id="render" title="Render" aside={<Dashboard id="render" />}>
      <p>
        Sends injected movement with the report timing and sizes your mouse has, instead of a flat, even stream. A
        model learns them from your mouse as you move it.
      </p>
      <Values
        rows={[
          ['Off', 'Injected movement goes out as an even stream, at the Emit rate.'],
          ['Stock', 'The model with its original smoother. The first report of each movement carries more than the ones after it.'],
          [<Default>De-spiked</Default>, 'The same smoother, with that first report flattened.'],
          ['Unsmoothed', 'No smoother: the model gets injected movement as it arrives.'],
        ]}
      />
      <p>
        The smoother adds delay: about four of your mouse's reports with Stock (4 ms at 1000 Hz), a third less with
        De-spiked, none with Unsmoothed.
      </p>
      <p>
        The model starts empty after every restart and needs to see your mouse move before it renders. Until then,
        injected movement goes out as with Off. Needs v3.3.1 or later.
      </p>
    </DocSection>

    <DocSection id="render-full" title="Rendered motion" aside={<Dashboard id="render-full" />}>
      <p>Which movement goes through Render's model.</p>
      <Values
        rows={[
          [<Default>Injected only</Default>, 'Your mouse\'s movement passes through untouched. Only injected movement is rendered.'],
          ['Injected and native', 'Your mouse\'s (native) movement goes through the model too, mixed with injected movement into one stream.'],
        ]}
      />
      <p>
        Injected and native delays your mouse's movement by Render's smoother delay plus 1 ms, and Movement riding
        stops applying. With Render off, nothing is rendered either way.
      </p>
    </DocSection>

    <DocSection id="spread" title="Spread" aside={<Dashboard id="spread" />}>
      <p>
        Software often sends movement less often than your mouse reports, say a command every 8 ms against a report
        every 1 ms. Without Spread, each command's movement lands in a single report. Spread splits it across the
        time until the next command, which the box works out from how often commands arrive.
      </p>
      <Values
        rows={[
          ['Off', 'Each command goes out whole, on the next report.'],
          ['Half', 'Spread over half the time until the next command.'],
          [<Default>Full</Default>, 'Spread over the whole time until the next command.'],
        ]}
      />
      <p>
        Spreading adds delay, on average half the time it spreads over: about 4 ms with Full and commands 8 ms apart.
        The total movement never changes. The wheel isn't spread, and neither are commands more than about 32 ms
        apart. Needs v3.3.1 or later.
      </p>
    </DocSection>

    <DocSection id="emit-rate" title="Emit rate" aside={<Dashboard id="emit-rate" />}>
      <p>The fastest the box sends injected movement. It only sends while there's movement waiting.</p>
      <Values
        rows={[
          [<Default>Learned</Default>, 'Your mouse\'s report rate, measured as you move it.'],
          ['Interval', 'The rate the clone declares to the PC: your mouse\'s, or a forced Wire rate.'],
          ['Fixed', 'A rate you pick, up to 1000 Hz, rounded to 1000 divided by a whole number (1000, 500, 333, 250 and so on).'],
          ['Rendered', 'v3.3.0 only: paced by the renderer. Removed after that release.'],
        ]}
      />
      <p>
        Leave it on Learned unless your software needs a set rate. Faster than your mouse, the box sends reports your
        mouse wouldn't; slower, injected movement goes out in fewer, bigger reports.
      </p>
    </DocSection>

    <DocSection id="wire-rate" title="Wire rate" aside={<Dashboard id="wire-rate" />}>
      <p>The polling rate the clone declares to the PC. The box polls your device at the same rate.</p>
      <Values
        rows={[
          [<Default>Native</Default>, 'What your device declares.'],
          ['Forced', 'A rate you pick, set to one the PC polls at exactly: 1000, 500, 250, 125, 62, 31, 15 or 7 Hz (600 becomes 500). A low-speed device can\'t go above 62 Hz.'],
        ]}
      />
      <p>
        Force it for a mouse that declares 125 Hz but can report faster, as Logitech's receivers do. The dashboard
        offers it for one, and <Fixes /> lists them.
      </p>
      <p>
        Forcing needs Imperfect clone on, since the clone's descriptor no longer matches the device. Changing it
        restarts the box, which clones the device again.
      </p>
    </DocSection>
  </>
);

export default Options;
