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
          <A href="/native/commands/lock#lock"><code>LOCK</code></A> sets how much of the physical
          device reaches the game PC on one input. Host{' '}
          <A href="/native/injection">injection</A> drives that same input at full strength whatever
          the scale says.
        </p>
        <pre class="diagram">{`  0     block   --X    nothing reaches the PC
  40            -.->   40 of every 100 counts, carried across reports
  100   pass    -->    all of it, byte for byte
  255   max     ==>    2.55x, clamped to the field's declared range

  injection     -->    full strength whatever the scale`}</pre>
        <p>
          A relative direction weighs physical motion against the{' '}
          <A href="/native/commands/lock#bearing">bearing</A>, in one of two{' '}
          <A href="/native/commands/lock#geometry">geometries</A>.
        </p>
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
      </Card>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="LOCK" subtitle="Block, pass, or amplify" />
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
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>the input class, as the <A href="/native/commands/lock">table above</A></td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>which input within the class, little-endian; <code>0xFFFF</code> = a <A href="/native/commands/lock#blanket">blanket</A></td></tr>
              <tr><td>3</td><td><code>direction</code></td><td><code>u8</code></td><td>which sign or which edge, <A href="/native/commands/lock#direction"><code>0-4</code></A></td></tr>
              <tr><td>4</td><td><code>scale</code></td><td><code>u8</code></td><td>percent of the physical value kept, <A href="/native/commands/lock#scale"><code>0-255</code></A></td></tr>
            </tbody>
          </table>

          <div id="scale" data-search-target>
            <div class="api-response-label">SCALE</div>
            <table class="api-params">
              <thead>
                <tr><th>Name</th><th>Value</th><th>Effect</th></tr>
              </thead>
              <tbody>
                <tr><td>block</td><td><code>0</code></td><td>None of the physical value reaches the PC.</td></tr>
                <tr><td>pass</td><td><code>100</code></td><td>All of it, byte for byte.</td></tr>
                <tr><td>max</td><td><code>255</code></td><td>2.55x. Anything above <code>100</code> amplifies.</td></tr>
              </tbody>
            </table>
            <div class="api-response-label">RULES</div>
            <table class="api-params">
              <thead>
                <tr><th>Rule</th><th>What the box does</th></tr>
              </thead>
              <tbody>
                <tr><td>combine</td><td>A delta picks up one fixed-sign scale and one relative scale, multiplied. A <code>0</code> in either blocks.</td></tr>
                <tr><td>carry</td><td>A physical delta at 1 kHz is almost always <code>+/-1</code>, so the dropped fraction is banked per axis and sign: <code>40</code> on a run of <code>-1</code> emits <code>0 0 -1 0 -1</code>.</td></tr>
                <tr><td>saturate</td><td>A weighed value clamps to the field's declared range, never wraps, and forfeits the fraction it could not carry.</td></tr>
                <tr><td>one bit</td><td>A button, key or media usage locks below <code>100</code> and passes at <code>100</code>. The box stores that, not the number sent.</td></tr>
              </tbody>
            </table>
            <div class="callout callout--warning">
              <p>
                Weighing runs before injected motion drains, so a gain that fills an axis leaves the
                box's own motion no room. It is held, not dropped, and leaves as one report once there
                is room.
              </p>
              <p>
                The threshold is the field's declared maximum divided by the gain: at <code>255</code>{' '}
                on an 8-bit axis the field fills at a physical delta of <code>50</code>, and the clamp
                bites at <code>51</code>.
              </p>
              <p>
                <A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A> does not bound
                it: a moved report re-opens the ride window, and riding never governed the immediate{' '}
                <A href="/native/injection#state">accumulator</A>.
              </p>
            </div>
          </div>

          <div id="direction" data-search-target>
            <div class="api-response-label">DIRECTION</div>
            <div class="table-scroll">
              <table class="api-params">
                <thead>
                  <tr><th>Direction</th><th>Value</th><th>Axis</th><th>Button, key, media</th></tr>
                </thead>
                <tbody>
                  <tr><td>both</td><td><code>0</code></td><td>Both signs.</td><td>Press and release.</td></tr>
                  <tr><td>positive</td><td><code>1</code></td><td>Positive sign only (<code>+</code>).</td><td>Press only (<code>0 to 1</code>).</td></tr>
                  <tr><td>negative</td><td><code>2</code></td><td>Negative sign only (<code>-</code>).</td><td>Release only (<code>1 to 0</code>).</td></tr>
                  <tr><td>with</td><td><code>3</code></td><td>The sign the box is <A href="/native/commands/lock#bearing">injecting</A>.</td><td>Refused on a button or key. Media locks the whole usage, as <code>0</code> would.</td></tr>
                  <tr><td>against</td><td><code>4</code></td><td>The sign opposing it.</td><td>Refused on a button or key. Media locks the whole usage, as <code>0</code> would.</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Media has no sign and no edge, so{' '}
              <A href="/native/commands/requests#locks"><code>RESP(LOCKS)</code></A> always reports
              its direction as <code>0</code>. Every shipped client refuses <code>3</code> and{' '}
              <code>4</code> on all three momentary classes rather than depend on which.
            </p>
            <p>
              On an axis, <code>0</code> writes the scale to the two fixed-sign slots and a pass to
              the relative pair: written to all four it would land at 50% with no bearing and 25% with
              one. An unlock clears all four.
            </p>
          </div>

          <div id="blanket" data-search-target>
            <div class="api-response-label">BLANKET</div>
            <p>An <code>id</code> of <code>0xFFFF</code> addresses the whole class in one command.</p>
            <div class="table-scroll">
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
            </div>
            <table class="api-params">
              <thead>
                <tr><th>Blanket</th><th>How the box holds it</th></tr>
              </thead>
              <tbody>
                <tr><td>button, axis</td><td>Expands as it lands, so a later command on one member overwrites just that member.</td></tr>
                <tr><td>key, media</td><td>One flag, which a per-usage unlock does not lift.</td></tr>
              </tbody>
            </table>
          </div>

          <div class="api-response-label">PHYSICAL ONLY</div>
          <p>
            A scale weighs the physical device. Host <A href="/native/injection">injection</A> drives
            the same field at full strength, so a blocked axis still moves when the box moves it.
          </p>

          <div id="clearing" data-search-target>
            <div class="api-response-label">A SCALE CLEARS ON</div>
            <pre class="diagram">{`unlock      the matching unlock (scale = 100); direction 0 clears
            all four slots of that target
silence     ~1 s with no control-PC frame
RESET       a RESET command
link loss   the inter-chip link drops
detach      the real device goes away`}</pre>
            <p>
              Hold one with a keepalive if it has to outlast a second of quiet. Injection auto-clears
              on the same events, described on{' '}
              <A href="/native/injection#safety">Injection</A>.
            </p>
          </div>

          <div class="api-response-label">EFFECT</div>
          <p>
            Scales are PC-owned and never visible to the game PC.{' '}
            <A href="/native/commands/requests#locks"><code>QUERY(LOCKS)</code></A> reads the active
            set; the HEALTH{' '}
            <A href="/native/commands/requests#health"><code>LOCK_ON</code></A> bit is set while
            anything is off a full pass.
          </p>
          <p>
            Library bindings:{' '}
            <A href="/library/lock#scale"><code>scale</code></A>,{' '}
            <A href="/library/lock#lock"><code>lock</code></A>,{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A>, and{' '}
            <A href="/library/lock#lock-all"><code>scale_all</code></A>, which sends this frame for
            buttons, keys and media and per-axis frames for X, Y and the wheel.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Block the wheel's negative (scroll-down) sign: <code>class = 3</code> (axis), <code>id = 2</code> (wheel), <code>direction = 2</code>, <code>scale = 0</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0A     | 00     | 05 00  | 03     | 02 00  | 02     | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | scale  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Keep 40% of leftward movement while the bearing on X is positive: <code>direction = 4</code>{' '}
            (against), <code>scale = 40</code>. A physical <code>-10</code> then leaves as{' '}
            <code>-4</code>, and as <code>-10</code> again once the bearing lapses:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0A     | 01     | 05 00  | 03     | 00 00  | 04     | 28     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | scale  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="bearing" data-search-target>
        <Card>
          <CardHeader title="The bearing" subtitle="The direction the box is currently injecting" />
          <p>
            <code>with</code> and <code>against</code> weigh a physical delta by its sign relative
            to the bearing. The box reads it at the{' '}
            <A href="/native/injection">merge point</A>, where the pending injection and the arriving
            report are in hand at once.
          </p>
          <pre class="diagram">{`  MOVE(+10)        MOVE(+10)                          idle
      |                |
      v                v
  ----+----------------+---------------------------------------> t
      |<-- restarted ->|<------ window ------->|
       bearing +X       bearing +X               no bearing`}</pre>
          <div class="api-response-label">LIFETIME</div>
          <p>
            Each axis carries its own bearing and its own deadline, set by{' '}
            <A href="/native/commands/option#bearing"><code>OPTION(BEARING)</code></A>. A window of{' '}
            <code>0</code> holds no bearing at all, so <code>with</code> and <code>against</code>{' '}
            never apply whatever their scale.
          </p>
                    <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect on the bearing</th></tr>
            </thead>
            <tbody>
              <tr><td>An injected delta on that axis, from a <A href="/native/commands/move#move"><code>MOVE</code></A> on either <A href="/native/injection#state">accumulator</A> or from a <A href="/native/commands/clip#entries">clip</A></td><td>Sets it, and restarts the deadline. A zero component leaves that axis standing.</td></tr>
              <tr><td>Injected motion still owed on that axis, held for a ride or queued behind a slow <A href="/native/commands/option#emit">emit</A> gate</td><td>Keeps restarting the deadline, and points at the net pending delta rather than the last one sent.</td></tr>
              <tr><td>The window elapses</td><td>That axis has no bearing. Both relative directions stop applying and it passes at its fixed-sign scale alone.</td></tr>
              <tr><td><A href="/native/commands/move#flags"><code>MOVE</code> with <code>DISCARD</code></A></td><td>Cleared, then set again by that same command's own delta. Only a zero-delta discard leaves the axis without one.</td></tr>
              <tr><td>Motion held for a ride goes stale</td><td>Cleared with the held motion, on the next native move that would have carried it.</td></tr>
              <tr><td>A change to <A href="/native/commands/option#move-ride"><code>OPTION(MOVE_RIDE)</code></A></td><td>Cleared, along with the held motion it pointed with.</td></tr>
              <tr><td>A change to <A href="/native/commands/option#bearing"><code>OPTION(BEARING)</code></A></td><td>Cleared, and the banked <A href="/native/commands/lock#scale">carry</A> with it.</td></tr>
              <tr><td><A href="/native/commands/admin#reset"><code>RESET</code></A>, ~1 s of control-PC silence, link loss, detach</td><td>Cleared with the rest of the PC-owned state.</td></tr>
            </tbody>
          </table>
        
        </Card>
      </div>

      <div id="geometry" data-search-target>
        <Card>
          <CardHeader title="Geometry" subtitle="Per axis, or projected onto the bearing" />
          <p>
            Set by <A href="/native/commands/option#bearing"><code>OPTION(BEARING)</code></A>. The two
            modes agree while the bearing has one nonzero component, and differ once both are.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Mode</th><th>Value</th><th>Weighs</th></tr>
            </thead>
            <tbody>
              <tr><td>per axis</td><td><code>0</code></td><td>Each axis against its own bearing, independently.</td></tr>
              <tr><td>vector</td><td><code>1</code></td><td>Only the part of the movement lying along the injected direction.</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`the bearing is down-right at 45 degrees, the device moves straight right

        o----------->  h   (+12, 0)
         \\         /   across b  (+6, -6)  untouched by with / against
          \\       /
           \\     /
            \\   /
             \\ /
              +        along b   (+6, +6)  weighed by with / against`}</pre>
          <p>
            In vector mode the relative pair addresses the XY bearing as a whole: the box takes the lower
            of the X and Y scales and applies it to both.
          </p>
          <p>
            <A href="/native/commands/requests#locks"><code>RESP(LOCKS)</code></A> reports that
            effective number on both axes, so a readback replayed as commands levels the higher stored
            byte down to it.
          </p>
          <p>The wheel is never projected; it weighs against its own bearing.</p>
          <div class="api-response-label">THE TWO STAGES</div>
                    <table class="api-params">
            <thead>
              <tr><th>Stage</th><th>Reads</th><th>Acts on</th></tr>
            </thead>
            <tbody>
              <tr><td>1. project</td><td>The relative pair, one number for both axes.</td><td>The part lying along the bearing. What survives is written back to both axes.</td></tr>
              <tr><td>2. weigh</td><td>Each axis's own fixed pair, chosen by the sign now standing in the field.</td><td>What stage 1 left, not the delta the report carried.</td></tr>
            </tbody>
          </table>
        
          <p>
            A fixed-sign scale governs what reaches the game PC, so it covers the across part as
            well as the physical delta. Only the relative pair is redistributed; the fixed pair is
            per axis in both modes.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre class="diagram">{`  bearing +X +Y
  LOCK(axis X, with, 0)  LOCK(axis Y, with, 0)   the bearing's relative scale is 0
  LOCK(axis Y, negative, 0)                      Y's negative sign is blocked

                          X     Y
  physical              +12     0   straight right, nothing on Y
  stage 1  along b       +6    +6   scaled by 0, so it goes
           across b      +6    -6   left alone, and is all that remains
           leaves        +6    -6
  stage 2  scale        100     0   on the sign now in each field
  emitted                +6     0`}</pre>
          <p>
            Per axis, stage 2 would have left Y alone: the report carried nothing there. Swap that block
            for a scale of <code>200</code> and the same <code>-6</code> leaves as <code>-12</code>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Lock;
