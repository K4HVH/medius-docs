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
          percentage.
        </p>
        <table class="api-params">
          <thead><tr><th>Section</th><th>Covers</th></tr></thead>
          <tbody>
            <tr><td><A href="/native/commands/lock#lock"><code>LOCK</code></A></td><td>The frame: class, id, direction, scale.</td></tr>
            <tr><td><A href="/native/commands/lock#scale">The scale byte</A></td><td>What a percentage does, and how two of them combine.</td></tr>
            <tr><td><A href="/native/commands/lock#blanket">Blanket</A></td><td><code>id = 0xFFFF</code>: a whole class in one command.</td></tr>
            <tr><td><A href="/native/commands/lock#direction">Direction</A></td><td>A sign, an edge, or a sign relative to the bearing.</td></tr>
            <tr><td><A href="/native/commands/lock#clearing">Clearing</A></td><td>What ends a scale, and what holds one open.</td></tr>
            <tr><td><A href="/native/commands/lock#bearing">The bearing</A></td><td>What <code>with</code> and <code>against</code> are measured against.</td></tr>
            <tr><td><A href="/native/commands/lock#geometry">Geometry</A></td><td>Per axis or vector, and the two stages vector runs.</td></tr>
          </tbody>
        </table>
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
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>the input class (table below)</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>which input within the class, little-endian; <code>0xFFFF</code> = the whole class</td></tr>
              <tr><td>3</td><td><code>direction</code></td><td><code>u8</code></td><td>which sign or which edge, see <A href="/native/commands/lock#direction">Direction</A></td></tr>
              <tr><td>4</td><td><code>scale</code></td><td><code>u8</code></td><td>percent of the physical value kept, see <A href="/native/commands/lock#scale">the scale byte</A></td></tr>
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
          <div class="api-response-label">PHYSICAL ONLY</div>
          <p>
            A scale weighs the physical device. Host{' '}
            <A href="/native/injection">injection</A> drives the same field at full strength whatever
            the scale says, so a blocked axis still moves when the box moves it.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            Scales are PC-owned and never visible to the game PC.{' '}
            <A href="/native/commands/requests#locks"><code>QUERY(LOCKS)</code></A> reads the active
            set; the HEALTH{' '}
            <A href="/native/commands/requests#health"><code>LOCK_ON</code></A> bit is set while
            anything is off a full pass. Library bindings:{' '}
            <A href="/library/lock#scale"><code>scale</code></A>,{' '}
            <A href="/library/lock#lock"><code>lock</code></A>,{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A>,{' '}
            <A href="/library/lock#lock-all"><code>scale_all</code></A>.
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

      <div id="scale" data-search-target>
        <Card>
          <CardHeader title="The scale byte" subtitle="Percent of the physical value kept" />
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
          <div class="api-response-label">RULES</div>
          <pre class="diagram">{`combine    a delta picks up one fixed-sign scale and one relative
           scale, multiplied; a 0 in either wins
carry      the fraction an integer result drops is banked and spent
           when it reaches a whole count
saturate   a weighed value clamps to the report field, never wraps
one bit    a button, key or media usage locks under 100 and passes
           at 100; the box stores that, not the number sent`}</pre>
          <p>
            Carry is why a scale between the ends is that scale: at 1 kHz a physical delta is almost
            always <code>+/-1</code>, and rounding each one alone would leave every setting behaving as
            one of the two ends.
          </p>
          <div class="callout callout--warning">
            <p>
              Weighing runs before injected motion drains, so a gain that saturates an axis leaves the
              box's own motion no room and it waits a frame.
            </p>
            <p>
              With <A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A> on, that
              deferred motion is dropped, not held. The threshold is <code>field_max / 2.55</code>, 49
              counts on an 8-bit axis.
            </p>
          </div>
          <p>
            What a truncated usage scale reads back as is on{' '}
            <A href="/native/commands/requests#locks"><code>RESP(LOCKS)</code></A>.
          </p>
        </Card>
      </div>

      <div id="blanket" data-search-target>
        <Card>
          <CardHeader title="Blanket" subtitle="id = 0xFFFF addresses the whole class" />
          <p>
            One command covers every member of the class. What it does with <code>direction</code>, and
            how it reads back, differ by class.
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
          <p>
            A button or axis blanket expands as it lands, so a later command on one member overwrites
            just that member. A key or media blanket is one flag the box holds, which a per-usage unlock
            does not lift. Library binding:{' '}
            <A href="/library/lock#lock-all"><code>scale_all</code></A>.
          </p>
        </Card>
      </div>

      <div id="direction" data-search-target>
        <Card>
          <CardHeader title="Direction" subtitle="A sign, an edge, or a sign relative to the bearing" />
          <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr><th>Direction</th><th>Value</th><th>Axis</th><th>Button / key</th></tr>
              </thead>
              <tbody>
                <tr><td>both</td><td><code>0</code></td><td>The scale to both signs, a full pass to the relative pair.</td><td>Press and release.</td></tr>
                <tr><td>positive</td><td><code>1</code></td><td>Positive sign only (<code>+</code>).</td><td>Press only (<code>0 to 1</code>).</td></tr>
                <tr><td>negative</td><td><code>2</code></td><td>Negative sign only (<code>-</code>).</td><td>Release only (<code>1 to 0</code>).</td></tr>
                <tr><td>with</td><td><code>3</code></td><td>The sign the box is injecting.</td><td>No effect.</td></tr>
                <tr><td>against</td><td><code>4</code></td><td>The sign opposing it.</td><td>No effect.</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            A media usage has neither a sign nor an edge: every direction locks the whole usage, and{' '}
            <A href="/native/commands/requests#locks"><code>RESP(LOCKS)</code></A> reports it as{' '}
            <code>0</code>.
          </p>
          <div class="api-response-label">WHY BOTH PASSES THE RELATIVE PAIR</div>
          <p>
            A delta multiplies its two scales, so writing <code>both = 50</code> to all four slots would
            land at 50% with no bearing live and 25% with one. An unlock still clears all four.
          </p>
          <div class="api-response-label">A RELATIVE DIRECTION OFF AN AXIS</div>
          <p>
            <code>3</code> and <code>4</code> name a sign relative to the{' '}
            <A href="/native/commands/lock#bearing">bearing</A>, so only an axis has one. The three
            momentary classes each do something different with it.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th><code>with</code> / <code>against</code> does</th></tr>
            </thead>
            <tbody>
              <tr><td>button</td><td>Refused. Nothing is written and nothing reads back.</td></tr>
              <tr><td>key</td><td>Accepted and ignored.</td></tr>
              <tr><td>media</td><td>Locks the usage, exactly as <code>0</code> would.</td></tr>
            </tbody>
          </table>
          <p>
            Every shipped client refuses all three rather than depend on which, and that is what to code
            against.
          </p>
        </Card>
      </div>

      <div id="clearing" data-search-target>
        <Card>
          <CardHeader title="Clearing" subtitle="What ends a scale" />
          <div class="api-response-label">A SCALE CLEARS ON</div>
          <pre class="diagram">{`unlock      the matching unlock (scale = 100); direction 0 clears
            all four slots of that target
silence     ~1 s with no control-PC frame
RESET       a RESET command
link loss   the inter-chip link drops
detach      the real device goes away`}</pre>
          <p>
            Hold one with a keepalive if it has to outlast a second of quiet. Injection auto-clears on
            the same events, described on{' '}
            <A href="/native/injection#safety">Injection</A>.
          </p>
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
          <div class="api-response-label">CAPTURE</div>
          <p>
            Every injected delta sets the bearing on the axes it moves, from a{' '}
            <A href="/native/commands/move#move"><code>MOVE</code></A> on either{' '}
            <A href="/native/injection#state">accumulator</A> or from a{' '}
            <A href="/native/commands/clip#entries">clip</A> alike. A zero component says nothing about
            its axis and leaves that axis's bearing standing.
          </p>
          <div class="api-response-label">LIFETIME</div>
          <p>
            Each axis carries its own bearing and its own deadline, set by{' '}
            <A href="/native/commands/option#bearing"><code>OPTION(BEARING)</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect on the bearing</th></tr>
            </thead>
            <tbody>
              <tr><td>An injected delta on that axis</td><td>Sets it, and restarts the deadline.</td></tr>
              <tr><td>Injected motion still owed on that axis</td><td>Keeps restarting the deadline. The window does not begin while a delta is waiting for a ride or for a slow emit gate.</td></tr>
              <tr><td>The window elapses</td><td>That axis has no bearing. Both relative directions stop applying and it passes at its fixed-sign scale alone.</td></tr>
              <tr><td><A href="/native/commands/move#flags"><code>MOVE</code> with <code>DISCARD</code></A></td><td>Cleared at once. Dropped motion is a pull that never lands.</td></tr>
              <tr><td>Motion held for a ride goes stale</td><td>Cleared with the hoard, on the next native move that would have carried it.</td></tr>
              <tr><td>A change to <A href="/native/commands/option#move-ride"><code>OPTION(MOVE_RIDE)</code></A></td><td>Cleared, along with the held motion it pointed with.</td></tr>
              <tr><td>A change to <A href="/native/commands/option#bearing"><code>OPTION(BEARING)</code></A></td><td>Cleared, and the banked <A href="/native/commands/lock#scale">carry</A> with it.</td></tr>
              <tr><td><A href="/native/commands/admin#reset"><code>RESET</code></A>, ~1 s of control-PC silence, link loss, detach</td><td>Cleared with the rest of the PC-owned state.</td></tr>
            </tbody>
          </table>
          <p>
            So the aim comes back on its own when injection stops, with no host command, and comes back
            immediately when the host abandons a pull.
          </p>
        </Card>
      </div>

      <div id="geometry" data-search-target>
        <Card>
          <CardHeader title="Geometry" subtitle="Per axis, or projected onto the aim" />
          <table class="api-params">
            <thead>
              <tr><th>Mode</th><th>Value</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td>per axis</td><td><code>0</code></td><td>Each axis compares its own sign against its own bearing, independently.</td></tr>
              <tr><td>vector</td><td><code>1</code></td><td>The movement is projected onto the injected direction, and only the part along it is weighed by the relative scale.</td></tr>
            </tbody>
          </table>
          <p>
            In vector mode the relative pair addresses the aim as a whole: the box takes the lower of
            the X and Y scales and applies it to both axes.
          </p>
          <pre class="diagram">{`vector mode, X against = 40, Y against = 80

  applied       40% along the aim, both axes (the lower of the two)
  RESP(LOCKS)   axis X, against, 40
                axis Y, against, 40   (effective, not the stored 80)

  the readback is what is APPLIED, so it cannot disagree with it`}</pre>
          <p>
            The wheel is never part of the aim vector and is always weighed per axis.
          </p>
          <div class="api-response-label">THE TWO STAGES</div>
          <p>
            A report in vector mode is weighed twice, in this order.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Stage</th><th>The scale it reads</th><th>What it acts on</th></tr>
            </thead>
            <tbody>
              <tr><td>1. project</td><td>The relative pair, one number for the whole aim.</td><td>The part of the movement lying along the bearing. The part across it is left alone here. What survives is written back to both axes.</td></tr>
              <tr><td>2. weigh</td><td>Each axis's own fixed pair, chosen by the sign now standing in the field.</td><td>What stage 1 left, not the delta the hand produced.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              Stage 2 is what keeps a fixed-sign scale a statement about what reaches the game PC, so
              it reaches the across part too.
            </p>
            <p>
              Only the relative pair is redistributed. The fixed pair is per axis in both modes, on
              whichever axis the value ends up.
            </p>
          </div>
          <div class="api-response-label">WORKED EXAMPLE</div>
          <pre class="diagram">{`bearing +X +Y (the box is pulling down-right; only its direction matters)
LOCK(axis X, with, 0)   LOCK(axis Y, with, 0)    -> aim scale 0 along the bearing
LOCK(axis Y, negative, 0)                        -> Y's negative sign blocked

  hand                    dx = +12   dy =   0     straight right, nothing on Y

  stage 1   along  b      (+6, +6)   scaled by 0, so it goes
            across b      (+6, -6)   left alone, and it is all that is left
            leaves        dx =  +6   dy =  -6     Y now carries a delta the hand never made

  stage 2   X: +6 is positive -> X's positive scale, 100 -> +6
            Y: -6 is negative -> Y's negative scale,   0 ->  0

  emitted                 dx =  +6   dy =   0`}</pre>
          <p>
            Per axis, stage 2 would have left Y alone: the hand put nothing there. Swap the block for a
            scale of <code>200</code> and the same <code>-6</code> leaves as <code>-12</code>.
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
