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
          The box holds a table of rules that match traffic and rewrite, answer, refuse, or drop it, or
          run a <A href="/library/advanced/rewrite#clip">clip verb</A>. A rule is addressed in the same{' '}
          <code>(class, id, direction)</code> space <A href="/library/catch">catch</A> reads, in the
          write direction, narrowed by a masked head compare.
        </p>
        <p>
          Rules are session state: re-asserted on reconnect like a{' '}
          <A href="/library/lock"><code>lock</code></A>, and cleared on control-PC silence,{' '}
          <A href="/library/admin#reset"><code>reset</code></A>, a re-clone, or the opt-in going off.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN--->  reads report
                          ^ pre-render               ^ post-render, the wire
  relayed     <--OUT---  [ HID_OUT ]<-- relay <---------------- interrupt-OUT <--  writes report
                          ^ VEND_INTR / VEND_BULK
  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  GET_DESCRIPTOR, SET_*
                          ^ id = endpoint number

              a rule acts at any [ bracketed ] stage`}</pre>
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
              <tr><td><code>rule</code></td><td><A href="/library/types/structs#rewrite-rule"><code>RewriteRule</code></A></td><td>The rule to install: its <A href="/library/types/enums#rewrite-class">address</A>, its <A href="/library/types/enums#rewrite-action"><code>action</code></A>, and any masked match or payload. Installing one with the whole table already in use is <A href="/library/types/errors#errors"><code>Error::RewriteTableFull</code></A>.</td></tr>
            </tbody>
          </table>
          <p>
            A rule is keyed by <code>(class, id, direction, match, mask)</code>; setting one whose key
            exists overwrites it. The crate validates a rule before sending, so a bad one is a real
            error rather than a frame the box drops.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Direction, RewriteRule, RewriteClass, RewriteAction};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;

// Mute the clone's own wire on interrupt-IN endpoint 1.
device.set_rewrite(&RewriteRule::new(RewriteClass::Emit, 1, Direction::IN, RewriteAction::Drop))?;

// Overwrite byte 2 of the device's report on interface 0, when byte 0 is the report id 0x01.
device.set_rewrite(
    &RewriteRule::new(RewriteClass::HidIn, 0, Direction::Both, RewriteAction::Patch)
        .matching([0x01], [0xFF])
        .at_offset(2)
        .with_payload([0x00]),
)?;`}</code></pre>
        </Card>
      </div>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="Clip rules" subtitle="Run a clip verb on a matched packet" />
          <pre class="api-signature">fn clip(class: RewriteClass, id: u16, direction: Direction, verb: ClipAction) -&gt; RewriteRule</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            The rule runs one <A href="/library/types/enums#clip-action"><code>ClipAction</code></A> on
            the box's next tick for every packet it wins. A shape the box refuses is{' '}
            <A href="/library/types/errors#errors"><code>Error::RewriteClipRule</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>clip(class, id, direction, verb)</code></td><td>Build the rule, on any <A href="/library/types/enums#rewrite-class"><code>RewriteClass</code></A>. The packet passes untouched, and a verb that starts the clip plays its first entry on that tick.</td></tr>
              <tr><td><code>.dropping()</code></td><td>Drop every packet the rule wins, on a class that takes <code>Drop</code>.</td></tr>
              <tr><td><code>.on_edge(selector_len)</code></td><td>Run the verb on the first packet of a run of matching ones, so a state a device repeats every poll fires once per hold. The first <code>selector_len</code> match bytes pick the stream, such as a report ID.</td></tr>
              <tr><td><code>.clip_verb()</code></td><td>The payload decoded into a <A href="/library/types/structs#clip-verb"><code>ClipVerb</code></A>, or <code>None</code> for any other rule.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              A packet outside the selected stream leaves the run as it was. An identical re-send of a
              rule keeps its run; an overwrite or a bus reset starts it again.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{ClipAction, Device, Direction, RewriteClass, RewriteRule};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;

// Report ID 7 on interface 2 carries a button in bit 5 of its second byte. Hold it to play.
let held = RewriteRule::clip(RewriteClass::HidIn, 2, Direction::IN, ClipAction::Start)
    .matching([0x07, 0x20], [0xFF, 0x20])
    .on_edge(1);
let let_go = RewriteRule::clip(RewriteClass::HidIn, 2, Direction::IN, ClipAction::Stop)
    .matching([0x07, 0x00], [0xFF, 0x20])
    .on_edge(1);
device.set_rewrite(&held)?;
device.set_rewrite(&let_go)?;`}</code></pre>
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
            bytes.
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
