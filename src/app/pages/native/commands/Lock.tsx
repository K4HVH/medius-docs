import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Lock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lock" subtitle="Weigh one physical input by class" />
        <p>
          <A href="/native/commands/lock#lock"><code>LOCK</code></A> decides how much of the physical
          device reaches the game PC on one input. Blocking and passing are the two ends of one
          percentage, and every value between them is reachable.
        </p>
        <p>
          Host <A href="/native/injection">injection</A> still drives a weighed input. It's{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
        </p>
      </Card>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="LOCK" subtitle="Weigh a physical input" />
          <p>
            A momentary usage shares{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s{' '}
            <code>(class, id)</code> space, so a button locks exactly like a key.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0A</code>.
          </p>
          <pre class="api-signature">LOCK  0x0A  ·  payload 5 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>the input class (see below)</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>which input within the class, little-endian; <code>0xFFFF</code> = the whole class</td></tr>
              <tr><td>3</td><td><code>direction</code></td><td><code>u8</code></td><td>which sign or which edge (see below)</td></tr>
              <tr><td>4</td><td><code>scale</code></td><td><code>u8</code></td><td>percent of the physical value kept; <code>0</code> blocks, <code>100</code> passes</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CLASSES</div>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Value</th><th><code>id</code> is</th></tr>
            </thead>
            <tbody>
              <tr><td>button</td><td><code>0</code></td><td>a <A href="/native/commands/usage#buttons">button id</A> (0=Left .. 4=Side2)</td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keyboard usage</A> (0xE0-0xE7 = modifier)</td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a 16-bit <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
              <tr><td>axis</td><td><code>3</code></td><td>0=X, 1=Y, 2=wheel (the sign is the direction)</td></tr>
            </tbody>
          </table>
          <p>
            Classes <code>0</code>-<code>2</code> mirror{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>. An <code>id</code> of{' '}
            <code>0xFFFF</code> is a blanket: it locks every usage in that class in one command.
          </p>
          <div class="api-response-label">DIRECTION</div>
          <p>
            What <code>direction</code> means depends on the input: a sign for an axis, an edge for a
            button, key, or media usage.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Direction</th><th>Value</th><th>Axis</th><th>Button / key / media</th></tr>
            </thead>
            <tbody>
              <tr><td>both</td><td><code>0</code></td><td>Every direction, relative ones included.</td><td>Press and release.</td></tr>
              <tr><td>positive</td><td><code>1</code></td><td>Positive sign only (<code>+</code>).</td><td>Press only (<code>0 to 1</code>).</td></tr>
              <tr><td>negative</td><td><code>2</code></td><td>Negative sign only (<code>-</code>).</td><td>Release only (<code>1 to 0</code>).</td></tr>
              <tr><td>with</td><td><code>3</code></td><td>The sign the box is injecting.</td><td>No meaning.</td></tr>
              <tr><td>against</td><td><code>4</code></td><td>The sign opposing it.</td><td>No meaning.</td></tr>
            </tbody>
          </table>
          <p>
            <code>0</code>-<code>2</code> name a fixed sign or edge. <code>3</code> and <code>4</code>{' '}
            name a sign relative to the <A href="/native/commands/lock#bearing">bearing</A>, so they
            follow the aim rather than the axis. Axes only. <code>both</code> writes every direction of
            the target, so an unlock never leaves a relative one weighing unseen.
          </p>
          <div class="api-response-label">SCALE</div>
          <table class="api-params">
            <thead>
              <tr><th>Scale</th><th>Value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>block</td><td><code>0</code></td><td>Keep none of the physical value. This is a lock.</td></tr>
              <tr><td>pass</td><td><code>100</code></td><td>Keep all of it, untouched. This is an unlock.</td></tr>
              <tr><td>max</td><td><code>255</code></td><td>Keep 2.55x of it. Anything above 100 amplifies.</td></tr>
            </tbody>
          </table>
          <p>
            A delta picks up at most two scales, its fixed direction's and its relative direction's, and
            they multiply: <code>negative = 50</code> with <code>against = 40</code> lands
            leftward-while-injecting-right at 20%. A <code>0</code> in either wins outright.
          </p>
          <p>
            The fraction an integer result drops is carried across reports and spent as it reaches a
            whole count. Without that, a scale between the two ends would behave as one of the ends: at
            1 kHz a physical delta is almost always <code>±1</code>. A weighed value clamps to the
            report field, so amplification saturates rather than wrapping.
          </p>
          <p>
            A button, key, or media usage carries one bit, so the scale truncates: anything under{' '}
            <code>100</code> locks the edge and <code>100</code> or above passes it, with nothing in
            between.
          </p>
          <div class="api-response-label">PHYSICAL ONLY</div>
          <p>
            A scale weighs the physical device and nothing else. Host{' '}
            <A href="/native/injection">injection</A> still reaches a weighed input at full strength,
            so a <A href="/native/commands/move#move"><code>MOVE</code></A> moves a blocked axis and an{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A> drives a locked button or
            key.
          </p>
          <div class="api-response-label">A SCALE CLEARS ON</div>
          <pre class="diagram">{`unlock      you send the matching unlock (scale = 100)
silence     ~1 s with no control-PC frame (same net as injection)
RESET       a RESET command
link loss   the inter-chip link drops`}</pre>
          <div class="callout callout--warning">
            <p>
              A scale isn't permanent: hold it with a keepalive if it has to outlast a second of quiet.
            </p>
          </div>
          <div class="api-response-label">EFFECT</div>
          <p>
            Scales are PC-owned and never visible to the game PC.{' '}
            <A href="/native/commands/requests#locks"><code>QUERY(LOCKS)</code></A> reads the active set
            across every class; the HEALTH{' '}
            <A href="/native/commands/requests#health"><code>LOCK_ON</code></A> bit is set while
            anything, of any class, is off a full pass. Library bindings:{' '}
            <A href="/library/lock#scale"><code>scale</code></A>, with{' '}
            <A href="/library/lock#lock"><code>lock</code></A> /{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A> as its two ends, and{' '}
            <A href="/library/lock#lock-all"><code>scale_all</code></A> for a blanket.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Block the wheel's negative (scroll-down) sign: <code>class = 3</code> (axis), <code>id = 2</code> (wheel), <code>direction = 2</code>, <code>scale = 0</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0A     | 00     | 05 00  | 03     | 02 00  | 02     | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | scale  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>Keep 40% of leftward movement while the box pulls right: <code>direction = 4</code> (against), <code>scale = 40</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0A     | 01     | 05 00  | 03     | 00 00  | 04     | 28     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | scale  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="bearing" data-search-target>
        <Card>
          <CardHeader title="The bearing" subtitle="What with and against are measured against" />
          <p>
            The <A href="/native/injection">additive merge</A> is symmetric: the box adds its motion to
            yours without knowing which half of your movement helps and which fights. The bearing is
            the direction the box is currently injecting, and it makes that asymmetric.
          </p>
          <p>
            The decision happens on the box at the merge point, where the pending injection and the
            arriving report are in hand at the same instant. A host doing the same thing needs a{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> to decide to a{' '}
            <code>LOCK</code>, which is always a round trip stale.
          </p>
          <div class="api-response-label">LIFETIME</div>
          <p>
            Every injected delta sets the bearing on the axes it moves, from a{' '}
            <A href="/native/commands/move#move"><code>MOVE</code></A> or a{' '}
            <A href="/native/commands/clip#clip">clip</A> alike. Each axis carries its own deadline,
            refreshed only by a delta on that axis. Past{' '}
            <A href="/native/commands/option#bearing"><code>OPTION(BEARING)</code></A>'s window an axis
            has no bearing, both relative directions stop applying, and physical input passes at its
            fixed-direction scale alone. That expiry is what hands the aim back when injection stops.
          </p>
          <div class="api-response-label">GEOMETRY</div>
          <table class="api-params">
            <thead>
              <tr><th>Mode</th><th>Value</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td>per axis</td><td><code>0</code></td><td>Each axis compares its own sign against its own bearing, independently.</td></tr>
              <tr><td>vector</td><td><code>1</code></td><td>The movement is projected onto the injected direction; only the part along it is weighed.</td></tr>
            </tbody>
          </table>
          <p>
            Vector leaves movement across the injection exactly alone, so a sideways correction costs
            nothing while counter-pull is still damped. X and Y stop being independent there, which is
            why the mode is one setting for the box. In that mode the relative pair addresses the aim
            as a whole and the box takes the lower of the X and Y scales; the fixed pair still applies
            per axis. The wheel is never part of the aim and is always weighed per axis.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre class="diagram">{`box injecting +X, user flicks left, against = 40

  physical  -10
  bearing    +X     -> the flick opposes it, so "against" applies
  emitted    -4      (40% of the flick, plus whatever the box injects)

injection stops, window expires

  physical  -10
  bearing   none    -> neither relative direction applies
  emitted   -10`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Lock;
