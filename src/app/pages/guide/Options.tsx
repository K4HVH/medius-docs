import type { Component, JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { Anchor } from '../../shell/Anchor';

const PATH = `                                               control PC
                                                    |  USB2: the software's commands
                                                    v
  mouse --USB3-->  mouse-side chip  <--link-->  main chip  --USB1-->  game PC

                   shapes the motion            presents the clone
                   Movement riding              Imperfect clone
                   Bearing                      Wire rate
                   Render                       Box name
                   Spread
                   Emit rate`;

// Each value of an option and what it does.
const Values = (props: { rows: [string, JSX.Element][] }) => (
  <div class="table-scroll">
    <table class="api-params names fixed">
      <colgroup>
        <col style={{ width: '26%' }} />
        <col />
      </colgroup>
      <thead><tr><th>Value</th><th>What it does</th></tr></thead>
      <tbody>{props.rows.map(([v, d]) => <tr><td>{v}</td><td>{d}</td></tr>)}</tbody>
    </table>
  </div>
);

// The default, when an owner changes it, and what it costs.
const Facts = (props: { default: JSX.Element; when: JSX.Element; costs: JSX.Element }) => (
  <div class="table-scroll">
    <table class="api-params names fixed">
      <colgroup>
        <col style={{ width: '26%' }} />
        <col />
      </colgroup>
      <tbody>
        <tr><td>Default</td><td>{props.default}</td></tr>
        <tr><td>Change it when</td><td>{props.when}</td></tr>
        <tr><td>Costs</td><td>{props.costs}</td></tr>
      </tbody>
    </table>
  </div>
);

const Fixes = () => <A href="/guide/compatibility#device-fixes">Device fixes</A>;

const Options: Component = () => (
  <>
    <PageHeader />

    <DocSection id="where" title="Where each acts">
      <p>
        The defaults suit most devices. Motion settings act on the mouse-side chip, which reads your mouse; the
        clone's settings act on the main chip, which the game PC sees.
      </p>
      <pre class="diagram">{PATH}</pre>
    </DocSection>

    <DocSection id="box-name" title="Box name">
      <p>The name the dashboard lists the box under, kept on the box.</p>
      <Values
        rows={[
          ['A name', 'Up to 32 letters, numbers and symbols.'],
          ['Clear', <>Back to <code>Medius-XXXX</code>, made from the box's MAC.</>],
        ]}
      />
      <Facts
        default={<code>Medius-XXXX</code>}
        when="You have more than one box."
        costs="Nothing. The box keeps running."
      />
    </DocSection>

    <DocSection id="imperfect-clone" title="Imperfect clone">
      <p>
        Lets the box clone a device it can't copy exactly. The box copies up to 4 IN endpoints in use at once and 6
        HID interfaces; a device past either, with a vendor bulk or isochronous endpoint, or a high-speed one,
        needs this.
      </p>
      <Values
        rows={[
          ['Faithful only', 'A device past the box\'s limits is refused: no clone appears, and the device does nothing through the box.'],
          ['Allow imperfect', 'Such a device is cloned with every IN endpoint live. Also needed for a forced Wire rate and for Control\'s Advanced tab.'],
        ]}
      />
      <Facts
        default="Faithful only"
        when={<>The dashboard offers it for the device you plug in, or <Fixes /> names the device.</>}
        costs="The clone no longer matches the device byte for byte. Endpoints beyond the mouse's, keyboard's and media's share the box's remaining buffers, so a packet on one can go a poll late. Changing it with such a device plugged in restarts the box, which clones it again."
      />
    </DocSection>

    <DocSection id="movement-riding" title="Movement riding">
      <p>Holds the software's motion until your mouse moves, and sends it on that report.</p>
      <Values
        rows={[
          ['Off', 'Injected motion goes out on reports the box adds while your mouse is still.'],
          ['On, with a window', 'Injected motion waits up to the window, 1 to 65535 ms, for a report from your mouse and rides it. Motion still waiting after the window is dropped.'],
        ]}
      />
      <Facts
        default="Off"
        when="Injected motion should add no reports, so the clone sends only as many as your mouse."
        costs="Injected motion while your mouse is still does nothing, and motion past the window is lost. Rendered motion set to Injected and native leaves riding out."
      />
    </DocSection>

    <DocSection id="bearing" title="Bearing">
      <p>
        What Lock's <em>With injection</em> and <em>Against injection</em> scales measure your motion against:
        the direction the software last moved the cursor.
      </p>
      <Values
        rows={[
          ['Window', 'How long, 1 to 65535 ms, the last injected direction stays the bearing. Off leaves With and Against doing nothing.'],
          ['Per axis', 'Each axis is weighed against the bearing on that axis.'],
          ['Vector', 'Your motion along the injected direction is weighed, the rest left as it is.'],
        ]}
      />
      <Facts
        default="20 ms, per axis. Nothing changes until a With or Against scale is set."
        when="You use With or Against scales on Lock."
        costs="A change drops the bearing in force, which shows as a step in the scaled motion."
      />
    </DocSection>

    <DocSection id="render" title="Render">
      <p>
        Sends the software's motion in your mouse's pattern of reports instead of an even fill. A model learns the
        pattern from your mouse; the modes differ in the smoother that feeds it.
      </p>
      <Values
        rows={[
          ['Off', 'An even fill: one report a frame while motion is waiting.'],
          ['Stock', 'The model with the smoother it comes with, centred four samples back.'],
          ['De-spiked', 'The model with the same smoother weighted towards the newest sample.'],
          ['Unsmoothed', 'The model fed the motion as it comes.'],
        ]}
      />
      <Facts
        default="De-spiked"
        when="Rarely."
        costs="The smoother's delay: Stock about four samples, De-spiked a third less, Unsmoothed none. After every restart the model needs your mouse to move before it renders; until then the even fill is used."
      />
      <Anchor id="render-full" label="Rendered motion">
        <p>Whose motion goes through the model.</p>
        <Values
          rows={[
            ['Injected only', 'Your mouse\'s motion is relayed as it comes; the software\'s is rendered beside it.'],
            ['Injected and native', 'Your mouse\'s motion goes through the model too, in one stream with the software\'s.'],
          ]}
        />
        <Facts
          default="Injected only"
          when="Rarely: both streams then share one pattern."
          costs="Your mouse's motion gets the smoother's delay plus one frame, and Movement riding no longer applies."
        />
      </Anchor>
    </DocSection>

    <DocSection id="spread" title="Spread">
      <p>
        Spreads each command's motion across the time until the next one, so no single report carries all of it.
        The box learns that time from the commands as they arrive.
      </p>
      <Values
        rows={[
          ['Off', 'The whole command on the next report.'],
          ['Half', 'Across half the time between commands.'],
          ['Full', 'Across the whole time between commands.'],
        ]}
      />
      <Facts
        default="Full"
        when="The delay matters more than the size of each report: lower it."
        costs="Delay, half the time between commands on average: about 4 ms for commands 8 ms apart. The total is never changed, the wheel is never spread, and commands more than about 32 ms apart aren't."
      />
    </DocSection>

    <DocSection id="emit-rate" title="Emit rate">
      <p>The most often the box sends the software's motion. It only sets a ceiling: nothing goes out unless motion is waiting.</p>
      <Values
        rows={[
          ['Learned', 'Your mouse\'s report rate, learned as it moves.'],
          ['Interval', 'The rate your mouse declares.'],
          ['Fixed', 'A rate you pick, up to 1000 Hz, rounded to 1000 divided by a whole number.'],
        ]}
      />
      <Facts
        default="Learned"
        when="The software you run expects a set rate."
        costs="Nothing on the clone. The box keeps running."
      />
      <Anchor id="wire-rate" label="Wire rate">
        <p>The rate the clone declares to the game PC, and the rate the box polls your mouse at.</p>
        <Values
          rows={[
            ['Native', 'What your mouse declares.'],
            ['Forced', 'A rate you pick, rounded up to one a PC keeps exactly: 1000, 500, 250, 125, 62, 31, 15 or 7 Hz. A low-speed device can\'t go above 62 Hz.'],
          ]}
        />
        <Facts
          default="Native"
          when={<>A mouse declares 125 Hz but can report faster, as Logitech's receivers do. The dashboard offers it for such a mouse, and <Fixes /> names them.</>}
          costs="Needs Imperfect clone on, since the clone's descriptor no longer matches the device's. A change restarts the box, which clones the device again."
        />
      </Anchor>
    </DocSection>
  </>
);

export default Options;
