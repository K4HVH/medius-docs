import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Rewrite: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Rewrite" subtitle="Match traffic in flight and change it" />
        <p>
          <A href="/native/commands/rewrite#rewrite"><code>REWRITE</code></A> manages up to 32 rules
          on the device chip. A rule matches packets at one surface and passes, drops,
          patches, replaces, answers or refuses them before they reach the game PC or the real
          device.
        </p>
        <pre class="diagram">{`  real device                                                        game PC

  report      --> [ HID_IN ] --> input pipeline --> [ EMIT ] -------------->
                                                        ^
                        inject, render, clip entries ---+
  vendor IN   --> [ VEND_INTR, VEND_BULK ] -------------------------------->
  IN reply    --> [ CONTROL, reply side ] --------------------------------->

  OUT packet  <-- [ HID_OUT, VEND_INTR, VEND_BULK ] <-----------------------
  request     <-- [ CONTROL, request side ] <-------------------------------
                    |
                    +-- ANSWER, STALL and NAK end the request here`}</pre>
        <p>
          A surface is a <A href="/native/commands/catch#catch"><code>CATCH</code></A> traffic
          class, addressed by the same <code>(class, id, dir)</code>.
        </p>
        <div class="table-scroll">
        <table class="api-params">
          <thead>
            <tr><th>Name</th><th>Value</th><th><code>id</code> is</th><th>Carries</th><th>Head</th></tr>
          </thead>
          <tbody>
            <tr><td><code>HID_IN</code></td><td><code>4</code></td><td>an interface number; <code>0xFFFF</code> = every HID interface</td><td>IN</td><td>the device's report as it arrived, report ID first</td></tr>
            <tr><td><code>HID_OUT</code></td><td><code>5</code></td><td>an endpoint number; <code>0xFFFF</code> = every HID interrupt-OUT endpoint</td><td>OUT</td><td>a report the PC writes to the device</td></tr>
            <tr><td><code>VEND_INTR</code></td><td><code>6</code></td><td>an endpoint number; <code>0xFFFF</code> = every vendor interrupt endpoint</td><td>IN, OUT</td><td>a relayed vendor interrupt packet</td></tr>
            <tr><td><code>VEND_BULK</code></td><td><code>7</code></td><td>an endpoint number; <code>0xFFFF</code> = every vendor bulk endpoint</td><td>IN, OUT</td><td>a relayed vendor bulk packet</td></tr>
            <tr><td><code>CONTROL</code></td><td><code>8</code></td><td>an endpoint number, <code>0</code> = EP0; <code>0xFFFF</code> = every control endpoint</td><td>IN, OUT</td><td>the 8 SETUP bytes, then the first 8 OUT data bytes</td></tr>
            <tr><td><code>EMIT</code></td><td><code>9</code></td><td>an endpoint number; <code>0xFFFF</code> = every cloned HID interrupt-IN endpoint</td><td>IN</td><td>the report going on the wire</td></tr>
            <tr><td><code>ANY</code></td><td><code>0xFF</code></td><td>not compared</td><td>IN, OUT</td><td>the head at each surface a packet crosses, so a mouse report meets the rule at <code>HID_IN</code> and again at <code>EMIT</code></td></tr>
          </tbody>
        </table>
        </div>
        <div class="callout callout--warning">
          <p>
            Rules need <A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A>.
            Otherwise the box discards every <code>REWRITE</code> but the whole-table clear; turning
            it off empties the table.
          </p>
        </div>
      </Card>

      <div id="rewrite" data-search-target>
        <Card>
          <CardHeader title="REWRITE" subtitle="Install, overwrite, or remove one rule" />
          <p>
            A rule is keyed by <code>(cls, id, dir, mlen, match, mask)</code>; setting one whose key
            exists overwrites it. <A href="/native/frame#opcodes">Opcode</A> <code>0x1C</code>.
          </p>
          <pre class="api-signature">REWRITE  0x1C  ·  payload 9 + 2 x mlen + plen bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <div class="table-scroll">
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>cls</code></td><td><code>u8</code></td><td>surface, <code>4</code>-<code>9</code> or <code>0xFF</code>, as the <A href="/native/commands/rewrite">table above</A></td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>class address, little-endian; <code>0xFFFF</code> = every id in the class</td></tr>
              <tr><td>3</td><td><code>dir</code></td><td><code>u8</code></td><td><code>0</code> both, <code>1</code> IN, <code>2</code> OUT; on <code>CONTROL</code>, the request's direction</td></tr>
              <tr><td>4</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> set (add or overwrite), <code>0</code> remove the keyed rule</td></tr>
              <tr><td>5</td><td><code>action</code></td><td><code>u8</code></td><td>rule action, <A href="/native/commands/rewrite#actions"><code>0</code>-<code>8</code></A></td></tr>
              <tr><td>6</td><td><code>off</code></td><td><code>u16</code></td><td>byte offset a <code>PATCH</code> or <code>REPLY_PATCH</code> writes at, little-endian</td></tr>
              <tr><td>8</td><td><code>mlen</code></td><td><code>u8</code></td><td>match length, <code>0</code>-<code>16</code>; <code>0</code> takes every packet on the address</td></tr>
              <tr><td>9</td><td><code>match</code></td><td><code>u8[]</code></td><td><code>mlen</code> bytes compared against the <A href="/native/commands/rewrite">packet head</A></td></tr>
              <tr><td>9+mlen</td><td><code>mask</code></td><td><code>u8[]</code></td><td><code>mlen</code> bytes: a head byte ANDed with its mask byte must equal the match byte</td></tr>
              <tr><td>9+2 x mlen</td><td><code>payload</code></td><td><code>u8[]</code></td><td>rest of the frame, <code>plen</code> bytes: what the action writes or replies with</td></tr>
            </tbody>
          </table>
          </div>
          <p>
            <code>state = 0</code> removes the rule under that key and ignores{' '}
            <code>action</code>, <code>off</code> and the payload. <code>cls = 0xFF</code>,{' '}
            <code>id = 0xFFFF</code>, <code>state = 0</code> clears the whole table.
          </p>
          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td><code>OPTION(IMPERFECT)</code> off, for any frame but the whole-table clear</td><td>the advanced layer needs the opt-in</td></tr>
              <tr><td>frame shorter than <code>9 + 2 x mlen</code></td><td>malformed</td></tr>
              <tr><td><code>11 + 2 x mlen + plen</code> above 512</td><td>a rule must fit its own <A href="/native/commands/requests#rewrite-entry">readback</A> in one frame</td></tr>
              <tr><td><code>cls</code> is not <code>4</code>-<code>9</code> or <code>0xFF</code></td><td>other classes carry no packet</td></tr>
              <tr><td><code>dir</code> above <code>2</code></td><td>a packet travels IN or OUT</td></tr>
              <tr><td><code>mlen</code> above <code>16</code></td><td>the head compare reads at most 16 bytes</td></tr>
              <tr><td>action invalid on <code>cls</code></td><td>the <A href="/native/commands/rewrite#actions">action table</A> lists each action's classes</td></tr>
              <tr><td><code>off + plen</code> of a <code>PATCH</code> or <code>REPLY_PATCH</code> passes 64 on a report class or <code>ANY</code>, or 2056 on <code>CONTROL</code></td><td>the write lands past the largest packet the surface carries</td></tr>
              <tr><td>a <code>REPLACE</code> payload above 64 bytes on a report class or <code>ANY</code></td><td>a report is at most 64 bytes</td></tr>
              <tr><td>all rule payloads would pass 2048 bytes</td><td>one shared pool; an overwrite is costed with its old payload returned, and a refused one keeps the old rule; <A href="/native/commands/requests#rewrite"><code>RESP(REWRITE)</code></A> sets its full flag</td></tr>
              <tr><td>a 33rd rule</td><td>nothing is evicted; <A href="/native/commands/requests#rewrite"><code>RESP(REWRITE)</code></A> sets its full flag</td></tr>
              <tr><td><code>state = 0</code> with no rule under that key</td><td>nothing to remove</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            A rule applies from the next packet at its surface. A refused frame changes nothing, so
            compare <A href="/native/commands/requests#rewrite"><code>QUERY(REWRITE)</code></A> with
            what was sent.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Drop every report the clone emits on endpoint 1: <code>cls = 9</code>,{' '}
            <code>id = 1</code>, <code>dir = 1</code>, <code>action = 1</code> (<code>DROP</code>),{' '}
            <code>mlen = 0</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1C     | 00     | 09 00  | 09     | 01 00  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | cls    | id     |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+--------+
| 01     | 01     | 01     | 00 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| dir    | state  | action | off    | mlen   | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Answer every HID <code>GET_REPORT</code> on EP0 with report ID 7's four bytes:{' '}
            <code>cls = 8</code>, <code>dir = 1</code>, <code>action = 4</code>, and a two-byte
            match on <code>bmRequestType</code> and <code>bRequest</code> under mask{' '}
            <code>FF FF</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1C     | 01     | 11 00  | 08     | 00 00  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | cls    | id     |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+--------+
| 01     | 01     | 04     | 00 00  | 02     | A1 01  |
+--------+--------+--------+--------+--------+--------+
| dir    | state  | action | off    | mlen   | match  |
+--------+--------+--------+--------+--------+--------+

+--------+--------------+--------+
| FF FF  | 07 01 00 00  | lo hi  |
+--------+--------------+--------+
| mask   | payload      | CRC16  |
+--------+--------------+--------+`}</pre>
          <p>
            Library bindings:{' '}
            <A href="/library/advanced/rewrite#set-rewrite"><code>set_rewrite</code></A>,{' '}
            <A href="/library/advanced/rewrite#remove-rewrite"><code>remove_rewrite</code></A>, and{' '}
            <A href="/library/advanced/rewrite#clear-rewrite"><code>clear_rewrite</code></A>.
          </p>
        </Card>
      </div>

      <div id="actions" data-search-target>
        <Card>
          <CardHeader title="Actions" subtitle="Top-ranked rule's effect" />
          <p>
            Report classes are <code>4</code>-<code>7</code> and <code>9</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>PASS</code></td><td><code>0</code></td><td>Any class. The packet passes unchanged, and a broader rule it outranks doesn't act.</td></tr>
              <tr><td><code>DROP</code></td><td><code>1</code></td><td>Report classes. The packet is dropped.</td></tr>
              <tr><td><code>PATCH</code></td><td><code>2</code></td><td>Any class. Writes the payload at <code>off</code> and keeps the length; a write past the packet's end is left unapplied.</td></tr>
              <tr><td><code>REPLACE</code></td><td><code>3</code></td><td>Any class. A report becomes the payload, length included.</td></tr>
              <tr><td><code>ANSWER</code></td><td><code>4</code></td><td><code>CONTROL</code>. The box completes the request itself.</td></tr>
              <tr><td><code>STALL</code></td><td><code>5</code></td><td><code>CONTROL</code>. The request ends in a STALL handshake.</td></tr>
              <tr><td><code>NAK</code></td><td><code>6</code></td><td><code>CONTROL</code>. EP0 NAKs until the PC times out; a control endpoint above 0 STALLs.</td></tr>
              <tr><td><code>REPLY_PATCH</code></td><td><code>7</code></td><td><code>CONTROL</code>. Writes the payload into the device's IN reply at <code>off</code>, unapplied past the reply's end.</td></tr>
              <tr><td><code>REPLY_REPLACE</code></td><td><code>8</code></td><td><code>CONTROL</code>. The IN reply becomes the payload, cut to <code>wLength</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTROL</div>
          <p>
            On <code>CONTROL</code> an action depends on the request's direction. The reply actions
            apply only when the device completed the request.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Action</th><th>IN request</th><th>OUT request</th></tr>
            </thead>
            <tbody>
              <tr><td><code>PASS</code></td><td>proxied unchanged</td><td>proxied unchanged</td></tr>
              <tr><td><code>PATCH</code></td><td>proxied unchanged</td><td>the data stage is patched at <code>off</code> before the device gets it</td></tr>
              <tr><td><code>REPLACE</code></td><td>proxied unchanged</td><td>the payload overwrites the start of the data stage; <code>wLength</code> is kept</td></tr>
              <tr><td><code>ANSWER</code></td><td>the payload is the reply, cut to <code>wLength</code></td><td>the status stage is ACKed and the data goes no further</td></tr>
              <tr><td><code>STALL</code>, <code>NAK</code></td><td>refused</td><td>refused</td></tr>
              <tr><td><code>REPLY_PATCH</code>, <code>REPLY_REPLACE</code></td><td>the device's reply is rewritten</td><td>proxied unchanged</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              On EP0 the table matches class and vendor requests. The clone serves standard requests
              such as <code>GET_DESCRIPTOR</code> itself; change a descriptor with{' '}
              <A href="/native/commands/patch"><code>PATCH</code></A>. A control endpoint above 0
              passes every request to the table.
            </p>
          </div>
        </Card>
      </div>

      <div id="matching" data-search-target>
        <Card>
          <CardHeader title="Matching" subtitle="Which rule a packet reaches" />
          <p>
            A packet shorter than <code>mlen</code> does not match. A match bit outside its mask, or
            a <code>dir</code> the class never carries, is stored and matches nothing.
          </p>
          <div class="api-response-label">RANK</div>
          <p>Only the highest-ranked match applies to a packet.</p>
          <pre class="diagram">{`  rank   1  exact (cls, id)       over  id = 0xFFFF   over  cls = 0xFF
         2  more mask bits set    over  fewer
         3  dir 1 or 2            over  dir 0
         4  lower table index

  table (every rule dir 1)                      action
    #0  EMIT  id 0xFFFF  mlen 0                 PASS
    #1  EMIT  id 1       mlen 0                 DROP
    #2  EMIT  id 1       match 02  mask FF      PATCH

  report 02 ... on endpoint 1
    +- #2  exact id, 8 mask bits      top-ranked  --> patched
    +- #1  exact id, 0 mask bits      outranked
    +- #0  id 0xFFFF                  outranked

  report 01 ... on endpoint 1
    +- #2  01 AND FF is not 02        no match
    +- #1  exact id                   top-ranked  --> dropped
    +- #0  id 0xFFFF                  outranked

  report on endpoint 2
    +- #0  id 0xFFFF                  top-ranked  --> passed`}</pre>
          <div class="callout callout--info">
            <p>
              An overwrite moves the rule to the end of the table with its hits at 0, so an
              equal-ranked rule installed earlier now outranks it. A remove or an overwrite shifts
              every later rule down one index; re-read the list before a{' '}
              <A href="/native/commands/requests#rewrite-entry"><code>QUERY(REWRITE_ENTRY)</code></A>.
            </p>
          </div>
          <div class="api-response-label">HITS</div>
          <p>
            A rule counts one hit per packet it matches as top-ranked, <code>PASS</code> included. A{' '}
            <code>cls = 0xFF</code> rule counts, and its <code>PATCH</code> applies, at each surface
            it matches. <A href="/native/commands/requests#rewrite"><code>RESP(REWRITE)</code></A>{' '}
            reports hits saturated at 65535.
          </p>
        </Card>
      </div>

      <div id="order" data-search-target>
        <Card>
          <CardHeader title="Order" subtitle="Clip triggers, pipeline, RAW" />
          <p>Each surface runs its packets through two tables before delivery.</p>
          <pre class="diagram">{`  packet at a surface
        |
        v
  [ clip packet triggers ]   a consuming trigger stops the packet here
        |
        v
  [ rewrite table ]          the top-ranked match counts a hit and applies
        |
        v
  delivered                  to the game PC (IN) or the real device (OUT)`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Behaviour</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/native/commands/clip#packet-triggers">packet triggers</A></td><td>A packet can fire a trigger and then match a rule. A report a trigger consumes reaches no rule and counts no hit.</td></tr>
              <tr><td><code>HID_IN</code></td><td>Buttons, keys, media and a secondary mouse's report are read from the rewritten bytes by <A href="/native/commands/lock"><code>LOCK</code></A>, <A href="/native/commands/transform#order"><code>TRANSFORM</code></A> and injection. A <code>DROP</code> removes the native report; injection still emits on the frame clock.</td></tr>
              <tr><td><code>EMIT</code></td><td>Acts last, on native, injected and rendered reports and a clip's entries. A rewritten report that carries no event against the last one sent is suppressed, unless the device reports every poll.</td></tr>
              <tr><td><A href="/native/commands/raw"><code>RAW</code></A></td><td>Goes straight to the endpoint, past every rule and trigger, as a clip's <A href="/native/commands/clip#items">raw items</A> do.</td></tr>
              <tr><td><A href="/native/commands/transfer"><code>TRANSFER</code></A></td><td>Runs on its own messages to the device, past every rule.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              The host chip weighs the bound mouse's relative axes from the report as it arrived.
              Whenever a scale, injection or rendering changes them, the host chip's values replace a{' '}
              <code>HID_IN</code> rewrite of those bytes. Rewrite motion at <code>EMIT</code>.
            </p>
          </div>
          <div class="api-response-label">CATCH</div>
          <p>
            Each <A href="/native/commands/catch#traffic-event"><code>CATCH</code></A> tap sits at a
            fixed side of the table, and flags bit 7 marks a packet a rule acted on: changed, dropped,
            answered or refused. A <code>PASS</code> leaves it clear. A{' '}
            <code>CONTROL</code> event is the transaction the game PC received, on every control
            endpoint; each class is in <A href="/native/commands/catch#rules">rules and taps</A>.
          </p>
        </Card>
      </div>

      <div id="lifecycle" data-search-target>
        <Card>
          <CardHeader title="Lifecycle" subtitle="Rules are PC-owned session state" />
          <p>
            The table holds until one of these empties it, on the same terms as{' '}
            <A href="/native/injection#safety">injection and locks</A>.
          </p>
          <div class="api-response-label">CLEARS ON</div>
          <pre class="diagram">{`remove      a REWRITE with state = 0 and the rule's key
clear       state 0 with cls = 0xFF and id = 0xFFFF
silence     ~1 s with no control-PC frame
RESET       a RESET command
link loss   the inter-chip link drops
detach      the real device goes away
re-clone    the box clones the device again: a replug, or a patch presentation
opt-in off  OPTION(IMPERFECT) turned off`}</pre>
          <p>
            Any valid frame resets the silence timer, so a keepalive holds the table. The library
            re-asserts its held rules on keepalive and across a control-link reconnect, as for{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>.
          </p>
          <p>Every clear here but remove and clear moves the <A href="/native/commands/requests#stats"><code>session</code></A> count.</p>
          <div class="api-response-label">GEN</div>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>a rule added, overwritten or removed</td><td><code>gen</code> goes up by one, wrapping at 255.</td></tr>
              <tr><td>a re-send identical to the stored rule</td><td><code>gen</code> stays.</td></tr>
              <tr><td>a clear or silence that empties a non-empty table</td><td><code>gen</code> goes up by one.</td></tr>
              <tr><td><A href="/native/commands/admin#reset"><code>RESET</code></A>, link loss, detach, re-clone, opt-in off</td><td>The table and <code>gen</code> both return to <code>0</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">READBACK</div>
          <p>
            <A href="/native/commands/requests#rewrite"><code>QUERY(REWRITE)</code></A> returns{' '}
            <code>gen</code>, the full flag and a line per rule;{' '}
            <A href="/native/commands/requests#rewrite-entry"><code>QUERY(REWRITE_ENTRY)</code></A>{' '}
            returns one rule in this frame's shape.{' '}
            <A href="/native/commands/requests#health"><code>HEALTH</code></A> sets{' '}
            <code>REWRITE_ON</code> (<code>0x0100</code>) while the table is non-empty.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Clear the whole table:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1C     | 02     | 09 00  | FF     | FF FF  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | cls    | id     |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+--------+
| 00     | 00     | 00     | 00 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| dir    | state  | action | off    | mlen   | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Library bindings:{' '}
            <A href="/library/advanced/rewrite#query-rewrite"><code>query_rewrite</code></A> and{' '}
            <A href="/library/advanced/rewrite#query-rewrite-entry"><code>query_rewrite_entry</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Rewrite;
