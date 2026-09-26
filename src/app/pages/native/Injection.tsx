import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Injection: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Injection model" subtitle="Fields, two verbs, added to native input" />
        <p>
          A device is a set of <em>fields</em>, each an <em>Axis</em> (relative motion: X, Y, wheel)
          or a <em>Usage</em> (a momentary button, key, or media control).
        </p>
        <table class="api-params">
          <thead>
            <tr><th>Device</th><th>Axes (<A href="/native/commands/move#move"><code>MOVE</code></A>)</th><th>Momentary (<A href="/native/commands/inject#inject"><code>INJECT</code></A>)</th></tr>
          </thead>
          <tbody>
            <tr><td>mouse</td><td>cursor X/Y, wheel</td><td>buttons</td></tr>
            <tr><td>keyboard</td><td>none</td><td>keys, modifiers</td></tr>
            <tr><td>media</td><td>none</td><td>volume, play/pause, ...</td></tr>
          </tbody>
        </table>
        <p>
          Injected input is <em>added to</em> native input:
        </p>
        <pre class="diagram">{`  physical input  (real device)  --+
                                   +-->  one combined report  -->  game PC
  injected input  (control PC)   --+`}</pre>
        <table class="api-params">
          <thead>
            <tr><th>Sent</th><th>Clone emits</th></tr>
          </thead>
          <tbody>
            <tr><td>a <code>MOVE</code> while the mouse moves</td><td>The sum of both.</td></tr>
            <tr><td>an <code>INJECT</code> press while the user holds nothing</td><td>The injected press.</td></tr>
            <tr><td>nothing</td><td>Native input only.</td></tr>
          </tbody>
        </table>
        <div class="callout callout--info">
          <p>
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>,{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A>, and{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> share the Axis and Usage
            vocabulary: one <code>(class, id)</code> works across all three.
          </p>
        </div>
      </Card>

      <div id="fire-and-forget" data-search-target>
        <Card>
          <CardHeader title="Fire-and-forget" subtitle="No per-command acknowledgement" />
          <p>
            Command frames get no echo or acknowledgement, so input streams at up to about one command
            per millisecond. <A href="/native/commands/requests#requests"><code>QUERY</code></A> and{' '}
            <A href="/native/commands/transfer#transfer"><code>TRANSFER</code></A> each return a reply
            frame; <A href="/native/commands/update#update"><code>UPDATE</code></A> replies to every op
            but <code>DATA</code>, whose chunks get one acknowledgement per window, plus a reply of its
            own for each refused chunk.
          </p>
          <p>Correctness comes from:</p>
          <table class="api-params">
            <thead>
              <tr><th>Mechanism</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>frame <A href="/native/frame#crc">checksum</A></td>
                <td>Drops corrupted frames.</td>
              </tr>
              <tr>
                <td><A href="/native/injection#safety">safety rules</A></td>
                <td>Keep a dropped command from leaving the box stuck.</td>
              </tr>
              <tr>
                <td><A href="/native/commands/requests#health"><code>HEALTH</code></A></td>
                <td>Reads the box's actual state.</td>
              </tr>
            </tbody>
          </table>
          <p>A lost movement frame costs one millisecond of motion.</p>
        </Card>
      </div>

      <div id="state" data-search-target>
        <Card>
          <CardHeader title="Tracked state" subtitle="Pending motion and held usages" />
          <p>
            Pending values the box carries between reports, separate from native input.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>Holds</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>riding accumulator</td>
                <td>
                  Sent motion and scroll not yet delivered to the PC. An ordinary{' '}
                  <A href="/native/commands/move#move"><code>MOVE</code></A>, cursor or wheel, adds in.
                  Drains into outgoing reports, except with{' '}
                  <A href="/native/commands/option#move-ride">movement riding</A> on, where it waits
                  for a native move to carry it.
                </td>
              </tr>
              <tr>
                <td>immediate accumulator</td>
                <td>
                  The same for motion that never waits: a <code>MOVE</code> carrying{' '}
                  <A href="/native/commands/move#flags"><code>NOW</code> or <code>FLUSH</code></A>, and
                  unrendered <A href="/native/commands/clip">clip</A> motion with <code>ride</code> off.
                  Both always exist; riding gates whether the first drains, not which one a move lands
                  in.
                </td>
              </tr>
              <tr>
                <td>usage override</td>
                <td>
                  Per usage (button, key, or media): forced active, forced inactive, or left native.
                  Set by <A href="/native/commands/inject#inject"><code>INJECT</code></A> actions:
                  press forces active, force-release forces inactive, soft-release clears both.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            A report carries limited movement. A large injected move sends what fits and keeps the
            remainder in its accumulator, spread over as many reports as it takes; nothing is clipped
            (<code>total seen = total sent</code>).
          </p>
        </Card>
      </div>

      <div id="emission" data-search-target>
        <Card>
          <CardHeader title="Report emission" subtitle="At native report rate, only on activity" />
          <p>
            Two of the three rows fire on the cloned mouse's tick.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>When</th><th>Sends</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>the mouse reported</td>
                <td>Native movement plus the drained accumulator; buttons combine physical state and overrides.</td>
              </tr>
              <tr>
                <td>the mouse was still, with motion pending</td>
                <td>Only the drained accumulator, paced to native report rate (not every millisecond). With <A href="/native/commands/option#move-ride">movement riding</A> on, only motion that <A href="/native/commands/move#flags">bypassed riding</A> goes out this way.</td>
              </tr>
              <tr>
                <td>an <A href="/native/commands/inject#inject"><code>INJECT</code></A> or <A href="/native/commands/admin#reset"><code>RESET</code></A> changed a usage</td>
                <td>One report with the new state.</td>
              </tr>
            </tbody>
          </table>
          <p>
            Otherwise the box sends nothing. A held usage is a single report (the edge), then
            silence until it changes.
          </p>
          <p>
            The box's own report goes on the first poll no native report can be ready for, so no native
            report moves to a later poll. A native report reaching the box first carries the box's motion
            and button changes.
          </p>
          <p>
            A multi-packet report of the box's own goes once the device has been still for 12 ms.
          </p>
          <p>
            Native reports under another report ID on the same endpoint go first, for two polls at most.
            While they fill every poll, a report of the box's own takes the next one and leaves them two in
            three.
          </p>
          <p>
            A change waits until the PC collects the report carrying the previous changes, so a press and
            its release never cancel and changes arrive in the order sent.
          </p>
          <p>
            <A href="/native/commands/option#emit"><code>OPTION(EMIT)</code></A> times the middle row,
            pacing to the mouse's learnt report rate.{' '}
            <A href="/native/commands/option#render"><code>OPTION(RENDER)</code></A>, on by default,
            shapes motion through a live per-device model and can render native motion too.
          </p>
        </Card>
      </div>

      <div id="safety" data-search-target>
        <Card>
          <CardHeader title="Safety" subtitle="Injected state never sticks" />
          <p>
            A <A href="/native/commands/inject#inject">force-release</A> always writes 0: it clears an
            injected hold and masks a physical press.
          </p>
          <p>
            The box clears all injection (every override and pending move) and returns to plain
            passthrough on any of these:
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Trigger</th><th>Condition</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>silence timeout</td>
                <td>No valid frame within the timeout (default <code>1000 ms</code>); a crash while holding a button releases it a second later.</td>
              </tr>
              <tr>
                <td>link drop</td>
                <td>The host-chip link drops.</td>
              </tr>
              <tr>
                <td>mouse unplugged</td>
                <td>The mouse detaches.</td>
              </tr>
              <tr>
                <td>re-clone</td>
                <td>The box clones again: another device attaches, a <A href="/native/commands/patch#presentation">patch presentation</A>, or an <A href="/native/commands/update">update</A> takes the clone down.</td>
              </tr>
              <tr>
                <td><A href="/native/commands/admin#reset"><code>RESET</code></A></td>
                <td>An explicit reset command.</td>
              </tr>
            </tbody>
          </table>
          <p>
            To hold an injected button, keep the link busy: any valid frame resets the timer, so a
            periodic{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> suffices.
          </p>
          <p>
            Each release moves the <A href="/native/commands/requests#stats"><code>session</code></A> count,
            so a polling host knows when to reapply its state.
          </p>
          <div class="callout callout--info">
            <p>
              The <A href="/library/lifecycle">medius library</A> automates this: keepalives while
              something is held, and reconnect plus state re-apply if the link drops.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Injection;
