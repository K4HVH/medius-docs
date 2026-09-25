import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Rewrite: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Rewrite rules" subtitle="Rewrite a matched packet in flight" />
        <p>
          The box holds a table of rules that match traffic and rewrite, answer, refuse, or drop it.
          A rule is addressed in the same <code>(class, id, direction)</code> space{' '}
          <A href="/library/catch">catch</A> reads, in the write direction, narrowed by a masked head
          compare.
        </p>
        <p>
          Rules are session state: re-asserted on each keepalive, on reconnect and by{' '}
          <A href="/library/lifecycle#restart">session recovery</A> like a{' '}
          <A href="/library/lock"><code>lock</code></A>, and cleared on control-PC silence,{' '}
          <A href="/library/admin#reset"><code>reset</code></A>, the real device detaching, an
          inter-chip link loss, a re-clone, or the opt-in going off. See the native{' '}
          <A href="/native/commands/rewrite#lifecycle">lifecycle</A>.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN---->  reads report
                          ^ as it arrived            ^ the wire
  relayed     <--OUT---  [ HID_OUT ]<-- relay <--------------- interrupt-OUT <--  writes report
                          ^ VEND_INTR / VEND_BULK
  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  class, vendor requests
                          ^ id = endpoint number

              a rule acts at the [ bracketed ] stage its class names; ANY acts at each
              on EP0 only class and vendor requests reach [ CONTROL ]`}</pre>
        <p>
          A packet reaches the clip's{' '}
          <A href="/library/clip#packet-triggers">packet triggers</A> ahead of the table, and one a
          trigger consumes reaches no rule. <A href="/library/catch#traffic">Catch</A> marks a packet
          a rule acted on (<A href="/library/types/structs#traffic-event"><code>rule_acted</code></A>).
        </p>
        <div id="hid-in-motion" class="callout callout--warning">
          <p>
            The host chip weighs the bound mouse's relative axes from the report as it arrived.
            Whenever a scale, injection or rendering changes them, the host chip's values replace a{' '}
            <code>HidIn</code> rewrite of those bytes. Rewrite motion at <code>Emit</code>.
          </p>
        </div>
        <div class="callout callout--warning">
          <p>
            The advanced control layer is gated on the imperfect-clone opt-in. With{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, <code>set_rewrite</code> returns{' '}
            <A href="/library/types/errors#errors"><code>Error::ImperfectRequired</code></A>.
          </p>
        </div>
        <p>
          <code>set_rewrite</code>, <code>remove_rewrite</code>, and <code>clear_rewrite</code> are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>;{' '}
          <A href="/library/advanced/rewrite#query-rewrite"><code>query_rewrite</code></A> reads back
          what the box actually holds.
        </p>
      </Card>

      <div id="set-rewrite" data-search-target>
        <Card>
          <CardHeader title="set_rewrite" subtitle="Install or overwrite one rule" />
          <pre class="api-signature">fn set_rewrite(&self, rule: &RewriteRule) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>rule</code></td><td><A href="/library/types/structs#rewrite-rule"><code>RewriteRule</code></A></td><td>The rule to install: its <A href="/library/types/enums#rewrite-class">address</A>, its <A href="/library/types/enums#rewrite-action"><code>action</code></A>, and any masked match or payload.</td></tr>
            </tbody>
          </table>
          <p>
            A rule is keyed by <code>(class, id, direction, match, mask)</code>; setting one whose key
            exists overwrites it, resets its hits and moves it to the end of the table. The crate checks
            a rule against the box's limits before sending, so a refusal is a real error.
          </p>
          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>Limit</th><th>Past it</th></tr>
            </thead>
            <tbody>
              <tr><td>2048 payload bytes across every held rule (<code>REWRITE_PAYLOAD_POOL</code>), checked first; an overwrite gives back the bytes it replaces</td><td><A href="/library/types/errors#errors"><code>Error::RewritePoolFull</code></A></td></tr>
              <tr><td>32 rules (<code>REWRITE_MAX_ENTRIES</code>), for a new key</td><td><A href="/library/types/errors#errors"><code>Error::RewriteTableFull</code></A></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Direction, RewriteRule, RewriteClass, RewriteAction};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;

// Mute the clone's own wire on interrupt-IN endpoint 1.
device.set_rewrite(&RewriteRule::new(RewriteClass::Emit, 1, Direction::IN, RewriteAction::Drop))?;

// Overwrite byte 2 of each report the clone emits on endpoint 1, when byte 0 is the report id 0x01.
device.set_rewrite(
    &RewriteRule::new(RewriteClass::Emit, 1, Direction::IN, RewriteAction::Patch)
        .matching([0x01], [0xFF])
        .at_offset(2)
        .with_payload([0x00]),
)?;`}</code></pre>
        </Card>
      </div>

      <div id="remove-rewrite" data-search-target>
        <Card>
          <CardHeader title="remove_rewrite" subtitle="Drop one rule" />
          <pre class="api-signature">fn remove_rewrite(&self, rule: &RewriteRule) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Drops the rule keyed by this rule's <code>(class, id, direction, match, mask)</code>; its{' '}
            <code>action</code> and <code>payload</code> are ignored. A no-op when no such rule is held.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let rule = RewriteRule::new(RewriteClass::Emit, 1, Direction::IN, RewriteAction::Drop);
device.set_rewrite(&rule)?;
device.remove_rewrite(&rule)?; // the same key, dropped`}</code></pre>
        </Card>
      </div>

      <div id="clear-rewrite" data-search-target>
        <Card>
          <CardHeader title="clear_rewrite" subtitle="Drop every rule" />
          <pre class="api-signature">fn clear_rewrite(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Drops the whole table. It always clears the crate's held rules, whatever the opt-in, so a
            reconnect never re-asserts a rule you cleared.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.clear_rewrite()?;`}</code></pre>
        </Card>
      </div>

      <div id="query-rewrite" data-search-target>
        <Card>
          <CardHeader title="query_rewrite" subtitle="Read the table's summary" />
          <pre class="api-signature">fn query_rewrite(&self) -&gt; Result&lt;RewriteTable&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#rewrite-table"><code>RewriteTable</code></A>: a
            full flag, a generation counter, and a row per rule without its match, mask, or payload
            bytes. The full flag says the box refused the last new rule or overwrite for room, and the
            next change to the table, or a clear, resets it.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let table = device.query_rewrite()?;
println!("{} rules, gen {}", table.entries.len(), table.generation);
for e in &table.entries {
    println!("  {:?} id {:#04x} -> {:?}, {} hits", e.class, e.id, e.action, e.hits);
}`}</code></pre>
        </Card>
      </div>

      <div id="query-rewrite-entry" data-search-target>
        <Card>
          <CardHeader title="query_rewrite_entry" subtitle="Read one rule in full" />
          <pre class="api-signature">fn query_rewrite_entry(&self, index: u8) -&gt; Result&lt;RewriteRule&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>index</code></td><td><code>u8</code></td><td>The row in the <A href="/library/advanced/rewrite#query-rewrite"><code>query_rewrite</code></A> summary.</td></tr>
            </tbody>
          </table>
          <p>
            Returns one <A href="/library/types/structs#rewrite-rule"><code>RewriteRule</code></A> in
            full, in the shape{' '}
            <A href="/library/advanced/rewrite#set-rewrite"><code>set_rewrite</code></A> takes.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let table = device.query_rewrite()?;
for i in 0..table.entries.len() as u8 {
    let rule = device.query_rewrite_entry(i)?; // replayable as a set
    let _ = rule;
}`}</code></pre>
        </Card>
      </div>



      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="set_rewrite and the queries await; remove and clear fire" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> makes{' '}
            <code>set_rewrite</code> a future: it awaits the imperfect-clone opt-in check before it
            sends, as do <code>query_rewrite</code> and <code>query_rewrite_entry</code>.{' '}
            <code>remove_rewrite</code> and <code>clear_rewrite</code> carry no opt-in check and stay
            synchronous.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Direction, RewriteRule, RewriteClass, RewriteAction};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.allow_imperfect_clones(true)?;
let rule = RewriteRule::new(RewriteClass::Emit, 1, Direction::IN, RewriteAction::Drop);
block_on(device.set_rewrite(&rule))?;            // awaits the opt-in gate
device.remove_rewrite(&rule)?;                   // sync: no gate
let table = block_on(device.query_rewrite())?;   // query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Rewrite;
