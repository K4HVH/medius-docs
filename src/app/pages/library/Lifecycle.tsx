import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Lifecycle: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lifecycle" subtitle="Re-asserting held state after a dropped link or a released session" />
        <p>The library holds deliberate overrides past the box's <A href="/native/injection#safety">silence-timeout clear</A>, and restores them if the link drops and reopens or the box drops them.</p>
        <table class="api-params">
          <thead><tr><th>Call</th><th>Does</th></tr></thead>
          <tbody>
            <tr><td><A href="/library/guides/connection#keepalive"><code>keepalive</code></A> (automatic)</td><td>Holds an override past the silence timeout.</td></tr>
            <tr><td><A href="/library/lifecycle#reapply"><code>reapply</code></A></td><td>Re-sends the held overrides so the box matches the library.</td></tr>
            <tr><td><A href="/library/lifecycle#reconnect"><code>reconnect</code></A></td><td>Rescans, reopens the port, and restores held state after a dropped link.</td></tr>
            <tr><td><A href="/library/lifecycle#restart">session recovery</A> (automatic)</td><td>Re-sends held state once the box has a clone again after a device-chip restart or a session release.</td></tr>
          </tbody>
        </table>
      </Card>

      <div id="reapply" data-search-target>
        <Card>
          <CardHeader title="reapply" subtitle="Re-send the held overrides so the box matches the library" />

          <pre class="api-signature">fn reapply(&self) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>

          <p>
            One frame goes out per held override;{' '}
            <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> does this for you after a
            drop.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.press(Button::LEFT)?;
device.reapply()?; // re-assert the held override, e.g. if the box reset under you`}</code></pre>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// The no-op case: reset clears every override, so reapply sends nothing.
device.reset()?;
device.reapply()?; // does nothing, no buttons are held`}</code></pre>

          <div class="callout callout--info">
            <p>
              Overrides are keyed by their{' '}
              <A href="/library/types/structs#usage"><code>Usage</code></A> (a button, key, or media
              usage).{' '}
              <A href="/library/inject#inject"><code>press</code></A> and{' '}
              <A href="/library/inject#inject"><code>force_release</code></A> add a held override;{' '}
              <A href="/library/inject#inject"><code>release</code></A> and{' '}
              <A href="/library/admin#reset"><code>reset</code></A> clear them.
            </p>
          </div>
        </Card>
      </div>

      <div id="reconnect" data-search-target>
        <Card>
          <CardHeader title="reconnect" subtitle="Rescan, reopen the port, and restore held state" />

          <pre class="api-signature">fn reconnect(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            The reader thread auto-reconnects on any read error, so call this only to force a rescan.
            It blocks while it rescans and reopens the port, and errors if the box can't be found or
            opened, but never waits on a box reply.
          </p>
          <p>On each call:</p>
          <ol>
            <li>
              Rescans for the box by its USB identity, vendor ID <code>0x1A86</code> and product ID{' '}
              <code>0x55D3</code> (see <A href="/native/transport">Transport</A>).
            </li>
            <li>
              Reopens the port. A box that answers on another protocol, as after a reflash, is{' '}
              <A href="/library/types/errors"><code>Error::BadProtoVer</code></A> and stays
              disconnected.
            </li>
            <li>
              Re-applies the held overrides, the same work as{' '}
              <A href="/library/lifecycle#reapply"><code>reapply</code></A>. A box whose{' '}
              <A href="/native/connection#hello">hello</A> arrives during the rescan booted while the
              link was down, and gets the held state by{' '}
              <A href="/library/lifecycle#restart">session recovery</A>.
            </li>
            <li>Bumps the reconnect counter.</li>
          </ol>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// After a known unplug and replug, force a rescan and confirm it took.
let before = device.counters().reconnects;
device.reconnect()?;
let after = device.counters().reconnects;
assert!(after > before);`}</code></pre>

          <div class="callout callout--info">
            <p>
              The reconnect count is the <code>reconnects</code> field in{' '}
              <A href="/library/diagnostics#counters">diagnostics</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="restart" data-search-target>
        <Card>
          <CardHeader title="Session recovery" subtitle="Re-sending what the box dropped" />
          <p>
            The box drops what a host set when its device chip boots, and when it releases the session
            without a boot, which it counts in{' '}
            <A href="/library/types/structs#stats"><code>Stats::session</code></A>. The library notices
            both, waits for a clone, re-sends what it holds, and counts only the boots in{' '}
            <A href="/library/diagnostics#counters"><code>restarts</code></A>.
          </p>
          <pre class="diagram">{`  box                                                    library
  boots    ---- RESP(VERSION), SEQ 0 ----------------->  a hello it did not ask for: a restart
  release  <--- QUERY(STATS) --------------------------  on the keepalive
           ---- RESP(STATS) -------------------------->  session moved: a release
           <--- QUERY(CAPS), repeated -----------------  until a HID interface is bound
           ---- RESP(CAPS) --------------------------->
           <--- INJECT, LOCK, CATCH -------------------  } the held state
           <--- REWRITE, TRANSFORM --------------------  }
           <--- CLIP_SET, CLIP_TRIGGER ----------------  the clip's settings and triggers
           <--- QUERY(CLIP) ---------------------------
           ---- RESP(CLIP) --------------------------->  an empty ring: the loaded clip is lost
                                                         restarts += 1, for a restart only`}</pre>
          <table class="api-params">
            <thead><tr><th>Trigger</th><th>How the library notices it</th></tr></thead>
            <tbody>
              <tr><td>A device-chip restart</td><td>The box's <A href="/native/connection#hello">ready hello</A>, unasked, on a link the box has already answered.</td></tr>
              <tr><td>A session release: a <code>RESET</code> the library did not send, the link between the box's chips dropping, the device detaching, a re-clone (<A href="/library/advanced/patch#apply-patch"><code>apply_patch</code></A>, <A href="/library/advanced/patch#clear-patch"><code>clear_patch</code></A>, an <A href="/library/options#allow-imperfect-clones">opt-in</A> toggle that re-presents the clone, another device), a configuration switch by the game PC that unbinds a role, control-PC silence, the opt-in turned off</td><td><code>Stats::session</code> moving. The keepalive reads it each tick while anything is held, and every 20 ms for 5 s after <code>apply_patch</code>, <code>clear_patch</code> or <code>allow_imperfect_clones</code>.</td></tr>
              <tr><td>This library's own <A href="/library/admin#reset"><code>reset</code></A></td><td>The box counts it; the library holds nothing after it, so nothing goes back.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Held state</th><th>After a recovery</th></tr></thead>
            <tbody>
              <tr><td>Held presses, locks and scales, catch subscriptions, rewrite rules, transforms</td><td>Re-sent once the clone is up: at once when it stayed up, and after a detach whenever a device is cloned again.</td></tr>
              <tr><td>Clip settings, input triggers and packet triggers</td><td>Re-sent.</td></tr>
              <tr><td>Rewrite rules and consuming packet triggers, after <code>allow_imperfect_clones(false)</code></td><td>Dropped by the library as the box drops them.</td></tr>
              <tr><td>A loaded clip</td><td>Gone with the ring; <A href="/library/clip#lost"><code>ClipHandle::lost</code></A> reports it.</td></tr>
              <tr><td>An <A href="/library/led#led">LED</A> override</td><td>Not held by the library, so not re-sent: call <code>led</code> again.</td></tr>
              <tr><td><A href="/library/options">Options</A> and <A href="/library/advanced/patch">patch sets</A></td><td>Kept in the box's NVS.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Axis, ClipBuilder, Device, Direction};

let device = Device::find()?;
let clip = device.clip();
let mut burst = ClipBuilder::new();
burst.move_by(4, 0);
device.scale(Axis::X, Direction::Both, 40)?;
clip.append(&burst)?;

let before = device.query_stats()?.session;
device.allow_imperfect_clones(true)?;
device.apply_patch()?;          // a re-clone: the box releases the session
// ... the library puts the scale back once the new clone is up ...
if device.query_stats()?.session != before && clip.lost() {
    clip.append(&burst)?;       // the ring's content is the caller's to reload
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="reapply and reconnect, still direct" />

          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> exposes{' '}
            <code>reapply</code> and <code>reconnect</code> directly, same signatures:{' '}
            <code>reapply</code> fires and forgets, <code>reconnect</code> blocks.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::AsyncDevice;

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.reapply()?;     // re-assert held overrides
device.reconnect()?;   // blocks: rescan + reopen`}</code></pre>

          <div class="callout callout--info">
            <p>
              See <A href="/library/features/async">async</A> for the full async surface and how{' '}
              <code>into_inner</code> and <code>into_async</code> move between the two views.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Lifecycle;
