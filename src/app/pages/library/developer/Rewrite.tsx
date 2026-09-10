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
          The box holds a table of rules that match traffic and rewrite, answer, refuse, or drop it. A
          rule is addressed in the same <code>(class, id, direction)</code> space{' '}
          <A href="/library/catch">catch</A> reads, in the write direction, narrowed by a masked head
          compare.
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
            The developer layer is gated on the imperfect-clone opt-in. With{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, <code>set_rewrite</code> returns{' '}
            <A href="/library/types/errors#errors"><code>Error::ImperfectRequired</code></A>.
          </p>
        </div>
        <p>
          <code>set_rewrite</code>, <code>remove_rewrite</code>, and <code>clear_rewrite</code> are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>;{' '}
          <A href="/library/developer/rewrite#query-rewrite"><code>query_rewrite</code></A> reads back
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
              <tr><td><code>rule</code></td><td><A href="/library/developer/rewrite#rewrite-rule"><code>RewriteRule</code></A></td><td>The rule to install: its address, its <A href="/library/developer/rewrite#action"><code>action</code></A>, and any masked match or payload.</td></tr>
            </tbody>
          </table>
          <p>
            A rule is keyed by <code>(class, id, direction, match, mask)</code>; setting one whose key
            exists overwrites it. The crate validates a rule before sending; see the{' '}
            <A href="/library/developer/rewrite#refusals">refusals</A>.
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
            Returns a <A href="/library/developer/rewrite#readback"><code>RewriteTable</code></A>: a full
            flag, a generation counter, and a row per rule without its match, mask, or payload bytes. The
            box holds up to 16 rules; a further one sets the <code>table_full</code> flag.
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
              <tr><td><code>index</code></td><td><code>u8</code></td><td>The row in the <A href="/library/developer/rewrite#query-rewrite"><code>query_rewrite</code></A> summary.</td></tr>
            </tbody>
          </table>
          <p>
            Returns one rule in full, in the shape{' '}
            <A href="/library/developer/rewrite#set-rewrite"><code>set_rewrite</code></A> takes.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let table = device.query_rewrite()?;
for i in 0..table.entries.len() as u8 {
    let rule = device.query_rewrite_entry(i)?; // replayable as a set
    let _ = rule;
}`}</code></pre>
        </Card>
      </div>

      <div id="rewrite-rule" data-search-target>
        <Card>
          <CardHeader title="RewriteRule" subtitle="The rule you install" />
          <pre class="api-signature">fn new(class: RewriteClass, id: u16, direction: Direction, action: RewriteAction) -&gt; RewriteRule</pre>
          <pre class="api-signature">fn matching(self, match_bytes: impl Into&lt;Vec&lt;u8&gt;&gt;, mask: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; RewriteRule</pre>
          <pre class="api-signature">fn at_offset(self, offset: u16) -&gt; RewriteRule</pre>
          <pre class="api-signature">fn with_payload(self, payload: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; RewriteRule</pre>
          <p>
            <code>match</code> and <code>mask</code> are the same length, compared over the packet head
            byte-for-byte; an empty match matches every packet on the address.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>class</code></td><td><A href="/library/developer/rewrite#class"><code>RewriteClass</code></A></td><td>The traffic class the rule addresses.</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The address within the class: an interface number or an endpoint number.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>The flow the rule matches: <code>Both</code>, <code>Positive</code>, or <code>Negative</code>.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/developer/rewrite#action"><code>RewriteAction</code></A></td><td>What the rule does to a matched packet.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>Where a patching action writes; other actions ignore it.</td></tr>
              <tr><td><code>match_bytes</code>, <code>mask</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The head bytes and their mask, the same length; empty matches every packet.</td></tr>
              <tr><td><code>payload</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The bytes an action that carries one supplies.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="class" data-search-target>
        <Card>
          <CardHeader title="RewriteClass" subtitle="Which traffic a rule addresses" />
          <p>
            The class picks the traffic and the id picks the address within it, the writable half of{' '}
            <A href="/library/catch">catch</A>'s address space.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr><th>Class</th><th>Value</th><th>Traffic</th><th>id</th></tr>
              </thead>
              <tbody>
                <tr><td><code>HidIn</code></td><td><code>4</code></td><td>A HID report from the device, before the renderer.</td><td>the interface number</td></tr>
                <tr><td><code>HidOut</code></td><td><code>5</code></td><td>A report the PC writes to the device.</td><td>the endpoint number</td></tr>
                <tr><td><code>VendorInterrupt</code></td><td><code>6</code></td><td>Interrupt traffic on a vendor interface.</td><td>the endpoint number</td></tr>
                <tr><td><code>VendorBulk</code></td><td><code>7</code></td><td>Bulk traffic on a vendor interface.</td><td>the endpoint number</td></tr>
                <tr><td><code>Control</code></td><td><code>8</code></td><td>A proxied control transfer, the only class that may answer or rewrite the device's reply.</td><td>the endpoint number (<code>0</code> = EP0)</td></tr>
                <tr><td><code>Emit</code></td><td><code>9</code></td><td>The outgoing wire, after the renderer. Catches injected and rendered frames as well as relayed ones.</td><td>the endpoint number</td></tr>
                <tr><td><code>Any</code></td><td><code>0xFF</code></td><td>Every rewritable class at once.</td><td>ignored</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            The direction picks the flow: on an endpoint class <code>Positive</code> is IN and{' '}
            <code>Negative</code> is OUT. <code>REWRITE</code> takes those or <code>Both</code>; the
            bearing-relative directions resolve at emit time and are refused.
          </p>
        </Card>
      </div>

      <div id="action" data-search-target>
        <Card>
          <CardHeader title="RewriteAction" subtitle="What the winning rule does" />
          <p>
            The winning rule's action decides a matched packet's fate. An action that does not fit its
            class is <A href="/library/types/errors#errors"><code>Error::RewriteActionClass</code></A>.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr><th>Action</th><th>Value</th><th>Class</th><th>Payload</th><th>Effect</th></tr>
              </thead>
              <tbody>
                <tr><td><code>Pass</code></td><td><code>0</code></td><td>any</td><td>no</td><td>Matched, but left untouched: a shadow over a broader rule.</td></tr>
                <tr><td><code>Drop</code></td><td><code>1</code></td><td>report</td><td>no</td><td>Not delivered. An <code>Emit</code> drop mutes the wire; a <code>HidIn</code> drop drops the device's contribution while injection still emits.</td></tr>
                <tr><td><code>Patch</code></td><td><code>2</code></td><td>any</td><td>yes</td><td>Overwrite the payload bytes at <code>offset</code>, length preserved.</td></tr>
                <tr><td><code>Replace</code></td><td><code>3</code></td><td>any</td><td>yes</td><td>The packet becomes the payload.</td></tr>
                <tr><td><code>Answer</code></td><td><code>4</code></td><td>control</td><td>yes</td><td>Answer from the payload without asking the device.</td></tr>
                <tr><td><code>Stall</code></td><td><code>5</code></td><td>control</td><td>no</td><td>Protocol STALL.</td></tr>
                <tr><td><code>Nak</code></td><td><code>6</code></td><td>control</td><td>no</td><td>NAK to a timeout.</td></tr>
                <tr><td><code>ReplyPatch</code></td><td><code>7</code></td><td>control</td><td>yes</td><td>Overwrite the device's reply at <code>offset</code>.</td></tr>
                <tr><td><code>ReplyReplace</code></td><td><code>8</code></td><td>control</td><td>yes</td><td>Replace the device's reply with the payload.</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="readback" data-search-target>
        <Card>
          <CardHeader title="RewriteTable and RewriteEntry" subtitle="What a query returns" />
          <table class="api-params">
            <thead>
              <tr><th>RewriteTable</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>table_full</code></td><td><code>bool</code></td><td>A further rule was, or would be, refused.</td></tr>
              <tr><td><code>generation</code></td><td><code>u8</code></td><td>Bumps only on a change that alters the table, so a host holding a last-seen value re-sends only when the box's diverges. The crate does this for you.</td></tr>
              <tr><td><code>entries</code></td><td><code>Vec&lt;RewriteEntry&gt;</code></td><td>One row per rule, in installation order, not the most-specific-first order the box selects a match by.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>RewriteEntry</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>class</code>, <code>id</code>, <code>direction</code>, <code>action</code></td><td>as set</td><td>The rule's address and action.</td></tr>
              <tr><td><code>match_len</code></td><td><code>u8</code></td><td>How many match and mask bytes the rule compares.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>The write offset for a patching action.</td></tr>
              <tr><td><code>payload_len</code></td><td><code>u16</code></td><td>How many payload bytes the rule carries.</td></tr>
              <tr><td><code>hits</code></td><td><code>u16</code></td><td>Packets the rule has matched since it was installed, saturating.</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/library/requests#health"><code>query_health</code></A> reports a non-empty table in
            its <code>rewrite_on</code> flag.
          </p>
        </Card>
      </div>

      <div id="refusals" data-search-target>
        <Card>
          <CardHeader title="Refusals" subtitle="What the crate checks before it sends" />
          <p>
            The crate validates a rule before sending, so a bad rule is a real error rather than a frame
            the box drops.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Error</th><th>When</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/library/types/errors#errors"><code>ImperfectRequired</code></A></td><td>The opt-in is off.</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RewriteMaskLength</code></A></td><td><code>match</code> and <code>mask</code> are not the same length.</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RewriteActionClass</code></A></td><td>The action does not fit the class.</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RelativeDirection</code></A></td><td>The direction is <code>With</code> or <code>Against</code>, which resolve at emit time.</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RewritePayloadTooLarge</code></A></td><td>The payload does not fit the box's head for the class: 64 bytes for a report class, an 8+2048-byte image for control.</td></tr>
            </tbody>
          </table>
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
