import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';

const Injection: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          A device is a set of <em>fields</em>, each an <em>Axis</em> (relative motion: X, Y, wheel)
          or a <em>Usage</em> (a momentary button, key, or media control).
        </p>
        <div class="table-scroll">
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
        </div>
        <p>
          Injected input is <em>added to</em> native input:
        </p>
        <pre class="diagram">{`  native input    (real device)  --+
                                   +-->  one combined report  -->  game PC
  injected input  (control PC)   --+`}</pre>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Sent</th><th>Clone emits</th></tr>
            </thead>
            <tbody>
              <tr><td>a <code>MOVE</code> while the mouse moves</td><td>The sum of both.</td></tr>
              <tr><td>an <code>INJECT</code> press with nothing held on the real device</td><td>The injected press.</td></tr>
              <tr><td>nothing</td><td>Native input only.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--info">
          <p>
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>,{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A>, and{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> share the Axis and Usage
            vocabulary: one <code>(class, id)</code> works across all three.
          </p>
        </div>
      </PageHeader>

      <DocSection id="fire-and-forget" title="Fire-and-forget" caption="No per-command acknowledgement">
        <p>
          Command frames get no echo or acknowledgement, so input streams at up to ~1
          command/ms. <A href="/native/commands/requests#requests"><code>QUERY</code></A> and{' '}
          <A href="/native/commands/transfer#transfer"><code>TRANSFER</code></A> each return a reply
          frame. <A href="/native/commands/update#update"><code>UPDATE</code></A> replies to every op
          except <code>DATA</code>. <code>DATA</code> chunks get one acknowledgement per window, plus
          one reply per refused chunk.
        </p>
        <p>Correctness comes from:</p>
        <div class="table-scroll">
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
        </div>
        <p>A lost <code>MOVE</code> frame costs one millisecond of motion.</p>
      </DocSection>

      <DocSection id="state" title="Tracked state" caption="Pending motion and held usages">
        <p>
          Pending values the box carries between reports, separate from native input.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>Holds</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>riding accumulator</td>
                <td>
                  Injected motion and scroll not yet emitted. An ordinary{' '}
                  <A href="/native/commands/move#move"><code>MOVE</code></A> (cursor or wheel) adds to
                  it. Drains into emitted reports. With{' '}
                  <A href="/native/commands/option#move-ride">movement riding</A> on, it waits to ride
                  a native motion report instead.
                </td>
              </tr>
              <tr>
                <td>immediate accumulator</td>
                <td>
                  The same, for motion that never waits: a <code>MOVE</code> carrying{' '}
                  <A href="/native/commands/move#flags"><code>NOW</code> or <code>FLUSH</code></A>, and
                  unrendered <A href="/native/commands/clip">clip</A> motion with <code>ride</code> off.
                  Both accumulators always exist. Movement riding decides whether the riding accumulator
                  drains, not which accumulator a <code>MOVE</code> lands in.
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
        </div>
        <p>
          A large injected move emits what fits the native field width. The rest stays in its
          accumulator and is emitted over as many reports as it takes. Nothing is clipped
          (<code>total seen = total sent</code>).
        </p>
      </DocSection>

      <DocSection id="emission" title="Report emission" caption="At native report rate, only on activity">
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>When</th><th>Emits</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>the mouse reported</td>
                <td>Native motion plus the drained accumulator. Buttons combine native state and overrides.</td>
              </tr>
              <tr>
                <td>the mouse was still, with motion pending</td>
                <td>Only the drained accumulator, paced to native report rate (not every millisecond). With <A href="/native/commands/option#move-ride">movement riding</A> on, only motion that <A href="/native/commands/move#flags">bypassed riding</A> is emitted this way.</td>
              </tr>
              <tr>
                <td>an <A href="/native/commands/inject#inject"><code>INJECT</code></A> or <A href="/native/commands/admin#reset"><code>RESET</code></A> changed a usage</td>
                <td>One report with the new state.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Otherwise the box emits nothing. A held usage is a single report (the edge), then
          silence until it changes.
        </p>
        <p>
          The box emits its report on the first poll no native report can be ready for, so no native
          report moves to a later poll. If a native report reaches the box first, it carries the box's
          motion and button changes.
        </p>
        <p>
          If that native report already carries injected motion, it goes first instead. The box's
          report then takes a separate poll, so two injections don't share one report.
        </p>
        <p>
          The separate poll needs the real device to leave polls free (it reports less often than every
          poll, no other report ID has reported in the last 12 ms, and the report fits one packet). The
          box's waiting report must also match the native one in everything but motion. If two of the
          box's reports are already waiting, the native report carries them.
        </p>
        <p>
          A multi-packet report from the box is emitted once the real device has been still for 12 ms.
        </p>
        <p>
          Native reports under another report ID on the same endpoint go ahead of the box's report
          for ≤2 polls. While they fill every poll, the box's report takes the next poll, and they keep
          2 polls in 3.
        </p>
        <p>
          A change waits until the PC collects the report carrying the previous changes. A press and
          its release never cancel, and changes arrive in the order sent.
        </p>
        <p>
          Up to 160 key changes wait (80 characters sent at once, 2 changes each; a capital typed with
          Shift takes 4), and 16 button or media changes. Past that, the oldest change goes ahead of
          the report it waits for. Order and final state still hold.
        </p>
        <p>
          While the game PC has the clone suspended, an injection wakes the PC if the PC armed remote
          wakeup. <A href="/native/commands/requests#stats"><code>wakeups</code></A> counts each wake.
        </p>
        <p>
          <A href="/native/commands/option#emit"><code>OPTION(EMIT)</code></A> paces the middle row
          (mouse still, motion pending). Default: the learnt native report rate.{' '}
          <A href="/native/commands/option#render"><code>OPTION(RENDER)</code></A> (on by default)
          shapes motion through a live per-device model. It can render native motion too.
        </p>
      </DocSection>

      <DocSection id="safety" title="Safety" caption="Injected state never sticks">
        <p>
          A <A href="/native/commands/inject#inject">force-release</A> always writes 0: it clears an
          injected hold and masks a native press.
        </p>
        <p>
          The box clears all injection (every override and pending move) and returns to passthrough
          on any of these:
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Trigger</th><th>Condition</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>silence timeout</td>
                <td>No valid frame within the timeout (default <code>1000 ms</code>). If a program crashes holding a button, the button releases a second later.</td>
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
                <td>The box clones again: another device attaches, or a <A href="/native/commands/patch#presentation">patch presentation</A> or an <A href="/native/commands/update">update</A> takes the clone down.</td>
              </tr>
              <tr>
                <td><A href="/native/commands/admin#reset"><code>RESET</code></A></td>
                <td>An explicit reset command.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          To hold an injected button, keep the link busy. Any valid frame resets the timer, so a
          periodic{' '}
          <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> is enough.
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
      </DocSection>
    </>
  );
};

export default Injection;
