import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Injection: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Injection model" subtitle="How sent input combines with the real mouse" />
        <p>
          Injection is the input your program sends:{' '}
          <A href="/native/commands/movement#move"><code>MOVE</code></A>,{' '}
          <A href="/native/commands/movement#wheel"><code>WHEEL</code></A>, and{' '}
          <A href="/native/commands/buttons"><code>BUTTON</code></A>. The box adds it to the real
          mouse's own movement and clicks (passthrough): <code>PC sees = injected + real</code>.
        </p>
        <table class="api-params">
          <thead>
            <tr><th>You send</th><th>The PC sees</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>a <code>MOVE</code> while the real mouse moves</td>
              <td>The sum of both.</td>
            </tr>
            <tr>
              <td>nothing</td>
              <td>Only the real mouse.</td>
            </tr>
          </tbody>
        </table>
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
          <p>Correctness comes from three places, not per-command tracking:</p>
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
          <CardHeader title="What the box tracks" subtitle="Pending motion and held buttons" />
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>What it holds</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>accumulator</td>
                <td>
                  A running total of sent motion and scroll not yet delivered to the PC. Each{' '}
                  <A href="/native/commands/movement#move"><code>MOVE</code></A> or{' '}
                  <A href="/native/commands/movement#wheel"><code>WHEEL</code></A> adds in; the box
                  drains it into outgoing reports.
                </td>
              </tr>
              <tr>
                <td>button override</td>
                <td>
                  Per button, whether the box forces it down, forces it up, or leaves it to the real
                  mouse. Set by the{' '}
                  <A href="/native/commands/buttons#button"><code>BUTTON</code></A> actions: press
                  forces down, force-release forces up, soft-release hands it back.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            A report can only carry a limited movement size. A large injected move sends what fits
            and keeps the remainder in the accumulator for the next report. Nothing is clipped (
            <code>total seen = total sent</code>), just spread over as many reports as it takes.
          </p>
        </Card>
      </div>

      <div id="emission" data-search-target>
        <Card>
          <CardHeader title="When the box sends a report" subtitle="At the mouse's own report rate, only on activity" />
          <table class="api-params">
            <thead>
              <tr><th>When…</th><th>The box sends</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>the real mouse reported</td>
                <td>The real movement plus whatever's drained from the accumulator, with buttons combining the physical state and your overrides.</td>
              </tr>
              <tr>
                <td>the real mouse was still, but you have motion pending</td>
                <td>A report carrying just the drained accumulator, paced to the mouse's own report rate (not one every millisecond).</td>
              </tr>
              <tr>
                <td>a <A href="/native/commands/buttons"><code>BUTTON</code></A> or <A href="/native/commands/admin#reset"><code>RESET</code></A> changed a button</td>
                <td>One report reflecting the new button state.</td>
              </tr>
            </tbody>
          </table>
          <p>
            Otherwise the box sends nothing, like a real mouse sitting idle. A held button is a
            single report (the press), then silence until it changes.
          </p>
        </Card>
      </div>

      <div id="safety" data-search-target>
        <Card>
          <CardHeader title="Safety" subtitle="Injected state can't trap the real mouse" />
          <p>
            A <A href="/native/commands/buttons#button">force-release</A> always wins: it clears an
            injected hold and masks a physical press, so there's always a way to put a button back to
            up.
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
