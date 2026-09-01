import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Injection: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Injection model" subtitle="A set of fields, two verbs, added on top of the user's input" />
        <p>
          A connected device is a set of <em>fields</em>: each is an <em>Axis</em> (relative motion: X,
          Y, wheel) or a <em>Usage</em> (a momentary button, key, or media control).
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
          Whatever you send is <em>added on top of</em> the user's own input, never replacing it:
        </p>
        <pre class="diagram">{`  physical input  (real device)  --+
                                   +-->  one combined report  -->  game PC
  injected input  (your program) --+`}</pre>
        <table class="api-params">
          <thead>
            <tr><th>You send</th><th>The clone emits</th></tr>
          </thead>
          <tbody>
            <tr><td>a <code>MOVE</code> while the real mouse moves</td><td>The sum of both.</td></tr>
            <tr><td>an <code>INJECT</code> press while the user holds nothing</td><td>The injected press.</td></tr>
            <tr><td>nothing</td><td>Only the real device.</td></tr>
          </tbody>
        </table>
        <div class="callout callout--info">
          <p>
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>,{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A>, and{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> all name an input with the same
            Axis and Usage vocabulary: one <code>(class, id)</code> works across all three.
          </p>
        </div>
      </Card>

      <div id="fire-and-forget" data-search-target>
        <Card>
          <CardHeader title="Fire-and-forget" subtitle="No per-command acknowledgement" />
          <p>
            Command frames get no echo and no acknowledgement, so you can stream input fast (up to
            about one command per millisecond). The exception is{' '}
            <A href="/native/commands/requests#requests"><code>QUERY</code></A>, which returns a{' '}
            <A href="/native/commands/requests#resp"><code>RESP</code></A>.
          </p>
          <p>Correctness comes from three places:</p>
          <table class="api-params">
            <thead>
              <tr><th>Mechanism</th><th>What it does</th></tr>
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
          <p>A lost movement frame costs one millisecond of motion; the next frame carries on.</p>
        </Card>
      </div>

      <div id="state" data-search-target>
        <Card>
          <CardHeader title="What the box tracks" subtitle="Pending motion and held usages" />
          <p>
            Injected state is a small set of pending values the box carries between reports, separate
            from anything the real device is doing.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>What it holds</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>riding accumulator</td>
                <td>
                  A running total of sent motion and scroll not yet delivered to the PC. An ordinary{' '}
                  <A href="/native/commands/move#move"><code>MOVE</code></A>, cursor or wheel, adds in.
                  It drains into outgoing reports, except while{' '}
                  <A href="/native/commands/option#move-ride">movement riding</A> is on, where it waits
                  for a real move to carry it.
                </td>
              </tr>
              <tr>
                <td>immediate accumulator</td>
                <td>
                  The same total for motion that never waits: a <code>MOVE</code> carrying{' '}
                  <A href="/native/commands/move#flags"><code>NOW</code> or <code>FLUSH</code></A>, and{' '}
                  <A href="/native/commands/clip">clip</A> playback. Both accumulators always exist;
                  riding gates whether the first one drains, not which one a move lands in.
                </td>
              </tr>
              <tr>
                <td>usage override</td>
                <td>
                  Per usage (button, key, or media), whether the box forces it active, forces it
                  inactive, or leaves it to the real device. Set by the{' '}
                  <A href="/native/commands/inject#inject"><code>INJECT</code></A> actions: press
                  forces active, force-release forces inactive, soft-release clears both.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            A report can only carry a limited movement size. A large injected move sends what fits
            and keeps the remainder in its own accumulator. Nothing is clipped (
            <code>total seen = total sent</code>), just spread over as many reports as it takes.
          </p>
        </Card>
      </div>

      <div id="emission" data-search-target>
        <Card>
          <CardHeader title="When the box sends a report" subtitle="At the mouse's own report rate, only on activity" />
          <p>
            Two of the three rows below fire on the cloned mouse's own tick.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>When</th><th>The box sends</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>the real mouse reported</td>
                <td>The real movement plus whatever's drained from the accumulator, with buttons combining the physical state and your overrides.</td>
              </tr>
              <tr>
                <td>the real mouse was still, but you have motion pending</td>
                <td>A report carrying just the drained accumulator, paced to the mouse's own report rate (not one every millisecond). With <A href="/native/commands/option#move-ride">movement riding</A> on, only motion that <A href="/native/commands/move#flags">bypassed riding</A> goes out this way.</td>
              </tr>
              <tr>
                <td>an <A href="/native/commands/inject#inject"><code>INJECT</code></A> or <A href="/native/commands/admin#reset"><code>RESET</code></A> changed a usage</td>
                <td>One report reflecting the new state.</td>
              </tr>
            </tbody>
          </table>
          <p>
            Otherwise the box sends nothing. A held usage is a single report (the edge), then
            silence until it changes.
          </p>
          <p>
            <A href="/native/commands/option#emit"><code>OPTION(EMIT)</code></A> times that middle row,
            pacing to the mouse's learnt report rate.{' '}
            <A href="/native/commands/option#render"><code>OPTION(RENDER)</code></A>, on by default,
            shapes the motion through a live per-device model, and can render the mouse's own motion the
            same way.
          </p>
        </Card>
      </div>

      <div id="safety" data-search-target>
        <Card>
          <CardHeader title="Safety" subtitle="Injected state can't trap the real device" />
          <p>
            A <A href="/native/commands/inject#inject">force-release</A> always writes 0: it clears an
            injected hold and masks a physical press.
          </p>
          <p>
            The box also clears all injection if your program goes quiet, dropping every override and
            pending move and returning to plain passthrough. Any of these resets it:
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Trigger</th><th>What happens</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>silence timeout</td>
                <td>No valid frame arrives within the timeout (default <code>1000 ms</code>), so a crash while holding a button releases it a second later.</td>
              </tr>
              <tr>
                <td>link drop</td>
                <td>The link to the host chip drops.</td>
              </tr>
              <tr>
                <td>mouse unplugged</td>
                <td>The real mouse is detached, so there's nothing left to inject into.</td>
              </tr>
              <tr>
                <td><A href="/native/commands/admin#reset"><code>RESET</code></A></td>
                <td>You send the reset command explicitly.</td>
              </tr>
            </tbody>
          </table>
          <p>
            To hold an injected button deliberately, keep the link busy: any valid frame resets the
            timer, so a periodic{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> suffices.
          </p>
          <div class="callout callout--info">
            <p>
              The <A href="/library/lifecycle">medius library</A> automates this: it sends keepalives
              while you hold something, and reconnects and re-applies your state if the link drops.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Injection;
