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
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>.
          </p>
          <div class="api-response-label">BLANKET</div>
          <p>
            An <code>id</code> of <code>0xFFFF</code> addresses the whole class in one command. What it
            does with <code>direction</code>, and how it reads back, differ by class.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Covers</th><th>Direction</th><th>Reads back as</th></tr>
            </thead>
            <tbody>
              <tr><td>button</td><td>All five buttons.</td><td>As a named button.</td><td>One entry per button and edge, under its own id.</td></tr>
              <tr><td>key</td><td>Every keyboard usage.</td><td>Honoured: <code>1</code> blocks press edges, <code>2</code> release edges, <code>0</code> both.</td><td>One entry per blocked edge, id <code>0xFFFF</code>.</td></tr>
              <tr><td>media</td><td>Every Consumer usage.</td><td>Ignored.</td><td>One entry, id <code>0xFFFF</code>, direction <code>0</code>.</td></tr>
              <tr><td>axis</td><td>X, Y, and the wheel.</td><td>As a named axis.</td><td>One entry per axis and direction, under its own id.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DIRECTION</div>
          <p>
            What <code>direction</code> means depends on the input: a sign for an axis, an edge for a
            button or key, nothing at all for a media usage.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Direction</th><th>Value</th><th>Axis</th><th>Button / key</th><th>Media</th></tr>
            </thead>
            <tbody>
              <tr><td>both</td><td><code>0</code></td><td>The scale to both signs, a full pass to the relative pair.</td><td>Press and release.</td><td>The usage.</td></tr>
              <tr><td>positive</td><td><code>1</code></td><td>Positive sign only (<code>+</code>).</td><td>Press only (<code>0 to 1</code>).</td><td>The usage.</td></tr>
              <tr><td>negative</td><td><code>2</code></td><td>Negative sign only (<code>-</code>).</td><td>Release only (<code>1 to 0</code>).</td><td>The usage.</td></tr>
              <tr><td>with</td><td><code>3</code></td><td>The sign the box is injecting.</td><td>No effect.</td><td>The usage.</td></tr>
              <tr><td>against</td><td><code>4</code></td><td>The sign opposing it.</td><td>No effect.</td><td>The usage.</td></tr>
            </tbody>
          </table>
          <p>
            <code>0</code>-<code>2</code> name a fixed sign or edge; <code>3</code> and <code>4</code>{' '}
            name a sign relative to the <A href="/native/commands/lock#bearing">bearing</A>, and are
            axes only.
          </p>
          <p>
            A media usage has no edges. The box suppresses it whole, ignores this byte, and reports the
            entry at direction <code>0</code> in{' '}
            <A href="/native/commands/requests#locks"><code>RESP(LOCKS)</code></A>.
          </p>
          <div class="api-response-label">A RELATIVE DIRECTION ON A USAGE</div>
          <p>
            Only an axis has a bearing to be with or against, so <code>3</code> and <code>4</code> on a
            button, key, or media usage are outside what the byte means. The box does not refuse the
            frame, and what it does instead is a different thing in each of the three classes.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>What the box does</th><th>Net effect</th></tr>
            </thead>
            <tbody>
              <tr><td>button</td><td>Refuses the write. The relative slot is skipped and reported as not written, so the frame clock is not spun for it either.</td><td>Nothing changes.</td></tr>
              <tr><td>key</td><td>Takes the frame and drops it. <code>3</code> and <code>4</code> name neither the press edge nor the release edge, so neither is set.</td><td>Nothing changes.</td></tr>
              <tr><td>media</td><td>Never reads the byte. The class decides on <code>scale</code> alone.</td><td>The usage locks, exactly as direction <code>0</code> would have locked it.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              <code>LOCK(media, against, 0)</code> blocks that media usage. Two of the three classes do
              nothing and the third acts, and nothing in the reply distinguishes them.
            </p>
          </div>
          <p>
            Every shipped client refuses a relative direction on all three classes instead of leaning on
            which of those behaviours it meets: the{' '}
            <A href="/library/lock#scale">Rust library</A> returns{' '}
            <A href="/library/types/errors#errors"><code>Error::RelativeDirection</code></A>,{' '}
            <code>tools/medius.py</code> raises, and this site's dashboard drops the option from the
            picker. That is the contract to code against.
          </p>
          <div class="callout callout--info">
            <p>
              <code>both</code> writes the scale to the two fixed signs and a full pass to the relative
              pair. Writing it to all four would square it, since a delta picks up one of each.
            </p>
          </div>
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
            A delta picks up one fixed-direction scale and one relative one, multiplied, so a{' '}
            <code>0</code> in either wins. The dropped fraction carries across reports, or every scale
            between the ends would behave as one of them at the <code>+/-1</code> deltas 1 kHz produces.
          </p>
          <div class="api-response-label">PHYSICAL ONLY</div>
          <p>
            A scale weighs the physical device only; host{' '}
            <A href="/native/injection">injection</A> reaches a weighed input at full strength. A
            momentary usage carries one bit, so under <code>100</code> locks its edge and the box stores
            that block rather than the number sent, which is what{' '}
            <A href="/native/commands/requests#locks"><code>RESP(LOCKS)</code></A> reads back.
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
            yours without knowing which half of yours helps and which fights. The bearing, the
            direction the box is currently injecting, is what makes it asymmetric.
          </p>
          <p>
            It is read at the merge point, where the pending injection and the arriving report are in
            hand at once. A host doing this needs <code>CATCH</code>, a decision, then{' '}
            <code>LOCK</code>, which is always a round trip stale.
          </p>
          <div class="api-response-label">LIFETIME</div>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>Injected delta</td><td>Sets the bearing on each axis it moves, from a <A href="/native/commands/move#move"><code>MOVE</code></A> or a <A href="/native/commands/clip#entries">clip</A> alike.</td></tr>
              <tr><td>Zero component</td><td>Says nothing about that axis; its bearing and deadline both stand.</td></tr>
              <tr><td>Window elapses</td><td>That axis has no bearing. Both relative directions stop applying and it passes at its fixed-direction scale alone.</td></tr>
            </tbody>
          </table>
          <p>
            Each axis carries its own deadline, set by{' '}
            <A href="/native/commands/option#bearing"><code>OPTION(BEARING)</code></A>. The expiry is
            what hands the aim back when injection stops, with no host command.
          </p>
          <div class="api-response-label">GEOMETRY</div>
          <table class="api-params">
            <thead>
              <tr><th>Mode</th><th>Value</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td>per axis</td><td><code>0</code></td><td>Each axis compares its own sign against its own bearing, independently.</td></tr>
              <tr><td>vector</td><td><code>1</code></td><td>The movement is projected onto the injected direction; only the part along it is weighed, so movement across it is untouched.</td></tr>
            </tbody>
          </table>
          <p>
            In vector mode the relative pair addresses the aim as a whole: the box takes the lower of
            the X and Y scales and applies it to both axes, while the fixed pair still applies per axis.
            The wheel is never part of the aim.
          </p>
          <p>
            <A href="/native/commands/requests#locks"><code>RESP(LOCKS)</code></A> reports that
            effective number on both axes, so the readback cannot disagree with what is applied.
          </p>
          <pre class="diagram">{`vector mode, X against = 40, Y against = 80

  applied       40% along the aim, both axes (the lower of the two)
  RESP(LOCKS)   axis X, against, 40
                axis Y, against, 40   (effective, not the stored 80)`}</pre>
          <div class="api-response-label">THE TWO STAGES</div>
          <p>
            A report in vector mode is weighed twice, in this order.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Stage</th><th>The scale it reads</th><th>What it acts on</th></tr>
            </thead>
            <tbody>
              <tr><td>1. project</td><td>The relative pair, <code>with</code> or <code>against</code>, one number for the whole aim: the lower of X's and Y's.</td><td>The part of the movement lying along the bearing. The part across it is untouched. What survives is written back to both axes.</td></tr>
              <tr><td>2. weigh</td><td>Each axis's own fixed pair, <code>positive</code> or <code>negative</code>, chosen by the sign now standing in the field.</td><td>What stage 1 left, not the delta the hand produced.</td></tr>
            </tbody>
          </table>
          <p>
            Stage 2 reading the projected value is what a fixed-sign scale means: it is a statement
            about what reaches the game PC, so it covers motion the projection moved onto that axis, and
            a gain reaches that motion for the same reason. This is the one place where weighing an axis
            in one direction touches a delta the hand made somewhere else.
          </p>
          <pre class="diagram">{`bearing +X +Y (the box is pulling down-right, |b| irrelevant, only its direction)
LOCK(axis X, with, 0)   LOCK(axis Y, with, 0)    -> aim scale 0 along the bearing
LOCK(axis Y, negative, 0)                        -> Y's negative sign blocked

  hand                    dx = +12   dy =   0     straight right, nothing on Y

  stage 1   along  b      (+6, +6)   scaled by 0, so it goes
            across b      (+6, -6)   untouched, and it is all that is left
            leaves        dx =  +6   dy =  -6     Y now carries a delta the hand never made

  stage 2   X: +6 is positive -> X's positive scale, 100 -> +6
            Y: -6 is negative -> Y's negative scale,   0 ->  0

  emitted                 dx =  +6   dy =   0`}</pre>
          <p>
            Per axis, stage 2 would have left Y alone: the hand put nothing there. Vector mode does not,
            because the projection put <code>-6</code> there and that is what would have reached the PC.
            Swap the block for a scale of <code>200</code> and the same <code>-6</code> leaves as{' '}
            <code>-12</code>.
          </p>
          <p>
            Only the relative pair is redistributed. The fixed pair is per axis in both modes, and in
            vector mode the axis it belongs to is the axis the value ends up on.
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
