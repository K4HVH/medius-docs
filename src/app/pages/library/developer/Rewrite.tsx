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
          The box holds a table of rewrite rules that match traffic in flight and rewrite, answer,
          refuse, or drop it. A rule is addressed in the same{' '}
          <code>(class, id, direction)</code> space <A href="/library/catch">catch</A> uses, in the
          write direction: the class picks the traffic, the id picks the endpoint or interface within
          it, and the direction picks the flow. A masked head compare narrows the match further.
        </p>
        <p>
          Rules are session state. They are re-asserted on reconnect and held alive by the keepalive,
          exactly like a <A href="/library/lock#lock">lock</A> or a{' '}
          <A href="/library/catch">catch subscription</A>, and the box clears them on control-PC
          silence, <A href="/library/admin#reset"><code>reset</code></A>, a re-clone, and when the
          opt-in goes off. Every stage the pipeline exposes is a place a rule can act.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN--->  reads report
                          ^ pre-render               ^ post-render, the wire
  relayed     <--OUT---  [ HID_OUT ]<-- relay <---------------- interrupt-OUT <--  writes report
                          ^ VEND_INTR / VEND_BULK
  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  GET_DESCRIPTOR, SET_*
                          ^ id = endpoint number

              a rewrite rule acts at any [ bracketed ] stage`}</pre>
        <div class="callout callout--warning">
          <p>
            The developer layer is gated on the imperfect-clone opt-in. With{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, <code>set_rewrite</code> returns{' '}
            <A href="/library/types/errors#errors"><code>Error::ImperfectRequired</code></A>.
          </p>
        </div>
      </Card>

      <div id="class" data-search-target>
        <Card>
          <CardHeader title="The class and its id" subtitle="Which traffic, and where within it" />
          <p>
            A class is one of the write-direction catch classes the box will rewrite. The parsed-input
            classes (button, key, media, axis) and the bus class are not rewritable and have no rule
            class. <code>Any</code> is the wire wildcard, matching every rewritable class at once.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Class</th><th>Value</th><th>Traffic</th><th><code>id</code> is</th></tr></thead>
              <tbody>
                <tr><td><code>HidIn</code></td><td><code>4</code></td><td>The device's HID input report, before the renderer.</td><td>the interface number</td></tr>
                <tr><td><code>HidOut</code></td><td><code>5</code></td><td>An interrupt-OUT report the game PC wrote, relayed to the device.</td><td>the endpoint address</td></tr>
                <tr><td><code>VendorInterrupt</code></td><td><code>6</code></td><td>Interrupt traffic on a vendor interface.</td><td>the endpoint address</td></tr>
                <tr><td><code>VendorBulk</code></td><td><code>7</code></td><td>Bulk traffic on a vendor interface.</td><td>the endpoint address</td></tr>
                <tr><td><code>Control</code></td><td><code>8</code></td><td>A proxied control transfer. The only class that may answer or rewrite the device's reply.</td><td>the endpoint number (<code>0</code> = EP0)</td></tr>
                <tr><td><code>Emit</code></td><td><code>9</code></td><td>The outgoing wire, after the renderer. Catches injected and rendered frames as well as relayed ones.</td><td>the endpoint address</td></tr>
                <tr><td><code>Any</code></td><td><code>0xFF</code></td><td>Every rewritable class at once.</td><td>ignored</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            The direction picks the flow the rule matches. <code>REWRITE</code> takes a fixed value only;
            the bearing-relative directions are rejected, since they resolve at emit time, after a rule
            is addressed.
          </p>
          <table class="api-params">
            <thead><tr><th>Direction</th><th>Matches</th></tr></thead>
            <tbody>
              <tr><td><code>Both</code></td><td>Either flow.</td></tr>
              <tr><td><code>Positive</code> (<code>In</code>)</td><td>Device to PC.</td></tr>
              <tr><td><code>Negative</code> (<code>Out</code>)</td><td>PC to device.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="action" data-search-target>
        <Card>
          <CardHeader title="The action" subtitle="What the winning rule does to a matched packet" />
          <p>
            The action decides the packet's fate. A report class may pass, drop, patch, or replace. The
            control class adds the answer, stall, nak, and the two reply rewrites, which act on the
            device's own reply.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Action</th><th>Value</th><th>Carries a payload</th><th>Effect</th></tr></thead>
              <tbody>
                <tr><td><code>Pass</code></td><td><code>0</code></td><td>no</td><td>Matched, but the packet is left untouched. A shadow over a broader rule.</td></tr>
                <tr><td><code>Drop</code></td><td><code>1</code></td><td>no</td><td>The packet is not delivered. An <code>Emit</code> drop mutes the wire; a <code>HidIn</code> drop drops the device's contribution while injection still emits.</td></tr>
                <tr><td><code>Patch</code></td><td><code>2</code></td><td>yes</td><td>Overwrite the payload bytes at <code>offset</code>, length preserved.</td></tr>
                <tr><td><code>Replace</code></td><td><code>3</code></td><td>yes</td><td>The packet becomes the payload.</td></tr>
                <tr><td><code>Answer</code></td><td><code>4</code></td><td>yes</td><td>Answer from the payload without asking the device.</td></tr>
                <tr><td><code>Stall</code></td><td><code>5</code></td><td>no</td><td>Protocol STALL.</td></tr>
                <tr><td><code>Nak</code></td><td><code>6</code></td><td>no</td><td>NAK to a timeout.</td></tr>
                <tr><td><code>ReplyPatch</code></td><td><code>7</code></td><td>yes</td><td>Overwrite the device's reply at <code>offset</code>.</td></tr>
                <tr><td><code>ReplyReplace</code></td><td><code>8</code></td><td>yes</td><td>Replace the device's reply with the payload.</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="matrix" data-search-target>
        <Card>
          <CardHeader title="Which action fits which class" subtitle="The admissibility matrix" />
          <p>
            The box refuses a rule whose action does not fit its class with{' '}
            <A href="/library/types/errors#errors"><code>Error::RewriteActionClass</code></A>, and the
            crate mirrors that check before it sends. <code>Drop</code> is a report surface only;{' '}
            <code>Answer</code>, <code>Stall</code>, <code>Nak</code>, and the two reply rewrites are
            control-only.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr>
                  <th>Action</th>
                  <th><code>HidIn</code></th>
                  <th><code>HidOut</code></th>
                  <th><code>VendorInterrupt</code></th>
                  <th><code>VendorBulk</code></th>
                  <th><code>Emit</code></th>
                  <th><code>Control</code></th>
                  <th><code>Any</code></th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>Pass</code></td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
                <tr><td><code>Drop</code></td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>&mdash;</td><td>&mdash;</td></tr>
                <tr><td><code>Patch</code></td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
                <tr><td><code>Replace</code></td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
                <tr><td><code>Answer</code></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>✓</td><td>&mdash;</td></tr>
                <tr><td><code>Stall</code></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>✓</td><td>&mdash;</td></tr>
                <tr><td><code>Nak</code></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>✓</td><td>&mdash;</td></tr>
                <tr><td><code>ReplyPatch</code></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>✓</td><td>&mdash;</td></tr>
                <tr><td><code>ReplyReplace</code></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>✓</td><td>&mdash;</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="rule" data-search-target>
        <Card>
          <CardHeader title="RewriteRule" subtitle="The rule you install" />
          <p>
            A rule is keyed by <code>(class, id, direction, match, mask)</code>: two rules that differ in
            any of those are separate entries, and setting one whose key exists overwrites it.{' '}
            <code>match</code> and <code>mask</code> are the same length &mdash; the box compares the
            packet head byte-for-byte under <code>mask</code> &mdash; and an empty match matches every
            packet on the address. <code>offset</code> is where <code>Patch</code> and{' '}
            <code>ReplyPatch</code> write; <code>payload</code> is the bytes an action that carries one
            supplies.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class</code></td><td><A href="/library/developer/rewrite#class"><code>RewriteClass</code></A></td><td>The traffic class the rule addresses.</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The address within the class: an interface number, endpoint address, or endpoint number.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>The flow the rule matches. <code>Both</code>, <code>Positive</code>, or <code>Negative</code>.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/developer/rewrite#action"><code>RewriteAction</code></A></td><td>What the rule does to a matched packet.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>Where a patching action writes; other actions ignore it.</td></tr>
              <tr><td><code>match_bytes</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The head bytes compared under <code>mask</code>; empty matches every packet.</td></tr>
              <tr><td><code>mask</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The mask over <code>match_bytes</code>; same length.</td></tr>
              <tr><td><code>payload</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The bytes an action that carries a payload supplies.</td></tr>
            </tbody>
          </table>
          <p>
            The Rust builder starts from <code>RewriteRule::new(class, id, direction, action)</code> and
            adds a masked match with <code>matching</code>, a write offset with <code>at_offset</code>,
            and a payload with <code>with_payload</code>.
          </p>
          <div class="api-response-label">RUST</div>
          <pre><code class="language-rust">{`use medius::{Device, Direction, RewriteRule, RewriteClass, RewriteAction};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;

// Mute the clone's own wire on interrupt-IN endpoint 1.
device.set_rewrite(&RewriteRule::new(RewriteClass::Emit, 0x81, Direction::Both, RewriteAction::Drop))?;

// Overwrite byte 2 of the device's report on interface 0, whenever byte 0 is the report id 0x01.
device.set_rewrite(
    &RewriteRule::new(RewriteClass::HidIn, 0, Direction::Both, RewriteAction::Patch)
        .matching([0x01], [0xFF])
        .at_offset(2)
        .with_payload([0x00]),
)?;`}</code></pre>
          <div class="api-response-label">C</div>
          <pre><code class="language-c">{`MediusRewriteRule rule = {0};
rule.class_ = MEDIUS_REWRITE_CLASS_EMIT;
rule.id = 0x81;
rule.direction = MEDIUS_DIRECTION_BOTH;
rule.action = MEDIUS_REWRITE_ACTION_DROP;
medius_device_set_rewrite(dev, &rule);  // mute the wire on interrupt-IN endpoint 1`}</code></pre>
          <div class="api-response-label">PYTHON</div>
          <pre><code class="language-python">{`from medius import RewriteRule, RewriteClass, RewriteAction, Direction

# Mute the clone's own wire on interrupt-IN endpoint 1.
device.set_rewrite(RewriteRule(RewriteClass.EMIT, 0x81, Direction.BOTH, RewriteAction.DROP))

# Overwrite byte 2 of the device's report on interface 0, when byte 0 is the report id 0x01.
device.set_rewrite(RewriteRule(
    RewriteClass.HID_IN, 0, Direction.BOTH, RewriteAction.PATCH,
    offset=2, match_bytes=bytes([0x01]), mask=bytes([0xFF]), payload=bytes([0x00]),
))`}</code></pre>
        </Card>
      </div>

      <div id="table" data-search-target>
        <Card>
          <CardHeader title="The table" subtitle="Set, remove, clear, and read back" />
          <p>
            Delivery is fire-and-forget; a query confirms what the box actually holds.{' '}
            <code>set_rewrite</code> adds or overwrites a rule, <code>remove_rewrite</code> drops the one
            keyed by a rule's <code>(class, id, direction, match, mask)</code> (its action and payload
            ignored), and <code>clear_rewrite</code> drops the whole table &mdash; the last always clears
            the crate's held rules, whatever the opt-in.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Returns</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>set_rewrite(&amp;rule)</code></td><td><code>Result&lt;()&gt;</code></td><td>Install or overwrite one rule.</td></tr>
              <tr><td><code>remove_rewrite(&amp;rule)</code></td><td><code>Result&lt;()&gt;</code></td><td>Drop the rule at that key; a no-op if none is held.</td></tr>
              <tr><td><code>clear_rewrite()</code></td><td><code>Result&lt;()&gt;</code></td><td>Drop every rule.</td></tr>
              <tr><td><code>query_rewrite()</code></td><td><A href="/library/developer/rewrite#readback"><code>RewriteTable</code></A></td><td>The whole table's summary.</td></tr>
              <tr><td><code>query_rewrite_entry(index)</code></td><td><code>RewriteRule</code></td><td>One rule in full, in the shape <code>set_rewrite</code> takes.</td></tr>
            </tbody>
          </table>
          <p>
            The box holds up to 16 rules; a further one is refused and the table's{' '}
            <code>table_full</code> flag is set.
          </p>
          <div class="api-response-label">RUST</div>
          <pre><code class="language-rust">{`let table = device.query_rewrite()?;
println!("{} rules, gen {}", table.entries.len(), table.generation);
for (i, e) in table.entries.iter().enumerate() {
    println!("  {i}: {:?} id {:#04x} -> {:?}, {} hits", e.class, e.id, e.action, e.hits);
    let full = device.query_rewrite_entry(i as u8)?;   // the full rule, replayable as a set
    let _ = full;
}`}</code></pre>
          <div class="api-response-label">PYTHON</div>
          <pre><code class="language-python">{`table = device.query_rewrite()
print(len(table.entries), "rules, gen", table.generation)
for i, e in enumerate(table.entries):
    print(f"  {i}: {e.rewrite_class!r} id {e.id:#04x} -> {e.action!r}, {e.hits} hits")
    full = device.query_rewrite_entry(i)   # the full rule, replayable as a set`}</code></pre>
        </Card>
      </div>

      <div id="readback" data-search-target>
        <Card>
          <CardHeader title="RewriteTable and RewriteEntry" subtitle="The summary a query returns" />
          <p>
            <code>query_rewrite</code> returns the table's summary: a flag, a generation counter, and a
            row per rule without its match, mask, or payload bytes. Read a full rule with{' '}
            <code>query_rewrite_entry</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>RewriteTable</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>table_full</code></td><td><code>bool</code></td><td>The table is full: a further rule was, or would be, refused.</td></tr>
              <tr><td><code>generation</code></td><td><code>u8</code></td><td>Bumps only on a change that alters the table, so a host holding a last-seen value re-sends only when the box's diverges. The crate does this for you.</td></tr>
              <tr><td><code>entries</code></td><td><code>Vec&lt;RewriteEntry&gt;</code></td><td>One row per rule, in installation order &mdash; not the most-specific-first order the box selects a match by.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>RewriteEntry</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class</code>, <code>id</code>, <code>direction</code>, <code>action</code></td><td>&mdash;</td><td>The rule's address and action.</td></tr>
              <tr><td><code>match_len</code></td><td><code>u8</code></td><td>How many match/mask bytes the rule compares.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>The write offset for a patching action.</td></tr>
              <tr><td><code>payload_len</code></td><td><code>u16</code></td><td>How many payload bytes the rule carries.</td></tr>
              <tr><td><code>hits</code></td><td><code>u16</code></td><td>Packets the rule has matched since it was installed, saturating.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="rewrite_on in HEALTH" subtitle="The flag word widened for the developer layer" />
          <p>
            <A href="/library/requests#health"><code>query_health</code></A> reports a non-empty rewrite
            table in its <code>rewrite_on</code> flag. The developer layer widened{' '}
            <A href="/library/types/structs#health"><code>Health</code></A> from a byte to a{' '}
            <code>u16</code>: bits 0&ndash;7 keep their meaning, and the high byte carries the three
            developer flags. A host that reads only the low byte still sees the original eight.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Bit</th><th>Mask</th><th>Flag</th><th>Set when</th></tr></thead>
              <tbody>
                <tr><td>b0</td><td><code>0x0001</code></td><td><code>link_up</code></td><td>The inter-chip link to the host chip is up.</td></tr>
                <tr><td>b1</td><td><code>0x0002</code></td><td><code>mouse_attached</code></td><td>A real mouse is attached on the host chip.</td></tr>
                <tr><td>b2</td><td><code>0x0004</code></td><td><code>clone_configured</code></td><td>The clone has been configured by the game PC.</td></tr>
                <tr><td>b3</td><td><code>0x0008</code></td><td><code>injection_active</code></td><td>Injection is currently active.</td></tr>
                <tr><td>b4</td><td><code>0x0010</code></td><td><code>rate_confident</code></td><td>The native-rate estimator window is full.</td></tr>
                <tr><td>b5</td><td><code>0x0020</code></td><td><code>lock_on</code></td><td>At least one input is off a full pass.</td></tr>
                <tr><td>b6</td><td><code>0x0040</code></td><td><code>catch_on</code></td><td>A catch subscription is active.</td></tr>
                <tr><td>b7</td><td><code>0x0080</code></td><td><code>kbd_attached</code></td><td>A keyboard is attached on the host chip.</td></tr>
                <tr><td>b8</td><td><code>0x0100</code></td><td><code>rewrite_on</code></td><td>The rewrite-rule table is non-empty.</td></tr>
                <tr><td>b9</td><td><code>0x0200</code></td><td><code>patch_on</code></td><td>A <A href="/library/developer/patch">descriptor-patch set</A> is applied to the clone.</td></tr>
                <tr><td>b10</td><td><code>0x0400</code></td><td><code>transform_on</code></td><td>A field transform is active (reserved).</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Refusals" subtitle="What the crate checks before it sends" />
          <p>
            The crate validates a rule before sending it, so a bad rule is a real error rather than a
            frame the box drops.
          </p>
          <table class="api-params">
            <thead><tr><th>Error</th><th>When</th></tr></thead>
            <tbody>
              <tr><td><A href="/library/types/errors#errors"><code>ImperfectRequired</code></A></td><td>The opt-in is off.</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RewriteMaskLength</code></A></td><td><code>match</code> and <code>mask</code> are not the same length.</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RewriteActionClass</code></A></td><td>The action does not fit the class (the <A href="/library/developer/rewrite#matrix">matrix</A> above).</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RelativeDirection</code></A></td><td>The direction is <code>With</code> or <code>Against</code>, which resolve at emit time.</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>RewritePayloadTooLarge</code></A></td><td>The payload does not fit the box's head for the class.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The box holds a 64-byte head for a report class and an 8+2048-byte image for the control
              class. A <code>Patch</code> or <code>ReplyPatch</code> is checked against that head at its
              <code>offset</code>; a <code>Replace</code>, <code>Answer</code>, or <code>ReplyReplace</code>{' '}
              against the whole head.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Rewrite;
