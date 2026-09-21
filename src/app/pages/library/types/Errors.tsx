import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Errors: Component = () => {
  return (
    <>
      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="The Error enum and the Result alias" />
          <p>
            Every fallible call returns <code>Result&lt;T&gt;</code>, the crate's alias for{' '}
            <code>core::result::Result&lt;T, Error&gt;</code>.
          </p>

          <p>
            <code>Error</code> is{' '}
            <a
              href="https://doc.rust-lang.org/reference/attributes/type_system.html"
              target="_blank"
              rel="noreferrer"
            >
              <code>#[non_exhaustive]</code>
            </a>
            , so any <code>match</code> needs a wildcard arm.
          </p>

          <table class="api-params">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>Io(std::io::Error)</code></td>
                <td>An underlying serial or OS error.</td>
              </tr>
              <tr>
                <td><code>NotFound</code></td>
                <td>
                  No port has the box's VID/PID, or no box matches the{' '}
                  <A href="/library/discovery">discovery</A> id or predicate.
                </td>
              </tr>
              <tr>
                <td><code>NoReply</code></td>
                <td>
                  No reply to the version query during the{' '}
                  <A href="/library/connection">handshake</A>: wrong port or baud, or not a Medius
                  box.
                </td>
              </tr>
              <tr>
                <td><code>BadProtoVer {'{'} got {'}'}</code></td>
                <td>
                  The box replied, but its <code>proto_ver</code> wasn't <code>9</code>;{' '}
                  <code>got</code> carries the reported value. The{' '}
                  <A href="/library/discovery">discovery</A> openers return it for a matched box on
                  another protocol. See the <A href="/library/connection">handshake</A>.
                </td>
              </tr>
              <tr>
                <td><code>QueryTimeout</code></td>
                <td>
                  A <A href="/library/requests"><code>query</code></A> hit its deadline with no{' '}
                  <A href="/native/commands/requests#resp"><code>RESP</code></A> back.
                </td>
              </tr>
              <tr>
                <td><code>Disconnected</code></td>
                <td>The device disconnected.</td>
              </tr>
              <tr>
                <td><code>FrameTooLong</code></td>
                <td>
                  A payload was over the <A href="/native/frame#layout">512-byte</A> frame limit.
                </td>
              </tr>
              <tr>
                <td><code>CatchTableFull {'{'} needed, limit {'}'}</code></td>
                <td>
                  A <A href="/library/catch"><code>catch_events</code></A> call needs{' '}
                  <code>needed</code> entries and the box holds <code>limit</code>. Refused before
                  anything is sent, because the box reports a refusal only in a flag.
                </td>
              </tr>
              <tr>
                <td><code>EmptySubscription</code></td>
                <td>A catch subscription named no filters, so the stream would never yield.</td>
              </tr>
              <tr>
                <td><code>CaptureNotApplicable {'{'} class {'}'}</code></td>
                <td>
                  A <A href="/library/types/enums#capture"><code>Capture</code></A> on an input class,
                  which arrives decoded and carries no packet.
                </td>
              </tr>
              <tr>
                <td><code>NotAnInputFilter {'{'} class {'}'}</code></td>
                <td>
                  <A href="/library/catch#input-events"><code>input_events</code></A> was given a
                  traffic class, which cannot decode to an input edge.
                </td>
              </tr>
              <tr>
                <td><code>WildcardNotInput</code></td>
                <td>
                  <code>CatchFilter::everything()</code> covers traffic too; use{' '}
                  <code>CatchFilter::all_input()</code>.
                </td>
              </tr>
              <tr>
                <td><code>RelativeDirection {'{'} direction, what {'}'}</code></td>
                <td>
                  A call addressed <code>Direction::With</code> or <code>Against</code> where only a
                  fixed sign or edge fits; <code>what</code> names it. Those are resolved against the{' '}
                  <A href="/native/commands/lock#bearing">bearing</A> at emit time, after the call is
                  made; use <code>Both</code>, <code>Positive</code>, or <code>Negative</code>.
                </td>
              </tr>
              <tr>
                <td><code>LockScaleRange {'{'} scale, min, max {'}'}</code></td>
                <td>
                  A <A href="/library/lock#scale">lock scale</A> outside <code>min</code> to{' '}
                  <code>max</code>. The percent is signed, so the range runs from a full reversal to a
                  full amplification.
                </td>
              </tr>
              <tr>
                <td><code>LockScaleUsage {'{'} scale, class {'}'}</code></td>
                <td>
                  A negative (reversing) <A href="/library/lock#scale">lock scale</A> on a button, key
                  or media usage. One bit has nothing to reverse: use <code>0</code> to block it or{' '}
                  <code>100</code> to pass it.
                </td>
              </tr>
              <tr>
                <td><code>ImperfectRequired</code></td>
                <td>
                  <A href="/library/advanced/rewrite#set-rewrite"><code>set_rewrite</code></A> or{' '}
                  <A href="/library/advanced/patch#apply-patch"><code>apply_patch</code></A> while the
                  imperfect-clone opt-in is off. Turn it on with{' '}
                  <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones(true)</code></A>.
                </td>
              </tr>
              <tr>
                <td><code>RawDirection {'{'} direction {'}'}</code></td>
                <td>
                  A <A href="/library/advanced/raw"><code>raw</code></A> call's direction, or a{' '}
                  <A href="/library/clip#frame"><code>ClipFrame</code></A> raw report's, was not{' '}
                  <code>IN</code> or <code>OUT</code>.
                </td>
              </tr>
              <tr>
                <td><code>ClipFrameCount {'{'} what, count, limit {'}'}</code></td>
                <td>
                  A <A href="/library/clip#frame"><code>ClipFrame</code></A> has <code>count</code> of{' '}
                  <code>what</code> (edges or raw reports) and carries at most <code>limit</code>.
                </td>
              </tr>
              <tr>
                <td><code>ClipFrameTooLong {'{'} len {'}'}</code></td>
                <td>
                  A <code>ClipFrame</code> encodes to <code>len</code> bytes and one append carries at
                  most 512 (<code>CLIP_ENTRY_MAX</code>). Split it across frames.
                </td>
              </tr>
              <tr>
                <td><code>ClipTransferData {'{'} want, got {'}'}</code></td>
                <td>
                  A clip transfer has <code>got</code> data bytes where its setup packet announces{' '}
                  <code>want</code>: <code>wLength</code> for an OUT request, none for an IN one.
                </td>
              </tr>
              <tr>
                <td><code>ClipPacketTrigger {'{'} reason {'}'}</code></td>
                <td>
                  A clip packet trigger in a shape the box refuses, caught before anything is sent;{' '}
                  <code>reason</code> names which of the{' '}
                  <A href="/library/clip#packet-triggers">refusals</A> it is.
                </td>
              </tr>
              <tr>
                <td><code>RewriteMaskLength {'{'} match_len, mask_len {'}'}</code></td>
                <td>
                  A <A href="/library/advanced/rewrite">rewrite rule</A>'s <code>match</code> and{' '}
                  <code>mask</code> were not the same length.
                </td>
              </tr>
              <tr>
                <td><code>RewriteMatchTooLong {'{'} len, limit {'}'}</code></td>
                <td>
                  A rewrite rule has <code>len</code> match bytes and the box compares at most{' '}
                  <code>limit</code> (<code>REWRITE_MATCH_MAX</code>, 16).
                </td>
              </tr>
              <tr>
                <td><code>RewriteActionClass {'{'} action, class {'}'}</code></td>
                <td>
                  A rewrite rule's{' '}
                  <A href="/library/types/enums#rewrite-action"><code>action</code></A> does not fit its{' '}
                  <A href="/library/types/enums#rewrite-class"><code>class</code></A>.
                </td>
              </tr>
              <tr>
                <td><code>RewritePayloadTooLarge {'{'} action, class, len, offset, cap {'}'}</code></td>
                <td>
                  A rewrite rule's payload does not fit the box's <code>cap</code>-byte head for the
                  class.
                </td>
              </tr>
              <tr>
                <td><code>RewriteTableFull {'{'} limit {'}'}</code></td>
                <td>
                  A further <A href="/library/advanced/rewrite">rewrite rule</A> with all{' '}
                  <code>limit</code> already in use. Remove one first.
                </td>
              </tr>
              <tr>
                <td><code>TransformOpFields {'{'} op, src, dst {'}'}</code></td>
                <td>
                  A <A href="/library/types/structs#transform">transform</A>'s{' '}
                  <A href="/library/types/enums#transform-op"><code>op</code></A> does not fit its
                  source and destination fields, or names one field as both. To weigh a field in
                  place, use <A href="/library/lock#scale"><code>scale</code></A>.
                </td>
              </tr>
              <tr>
                <td><code>TransformTableFull {'{'} limit {'}'}</code></td>
                <td>
                  A further <A href="/library/transform">transform</A> with all <code>limit</code>{' '}
                  already in use. Remove one first.
                </td>
              </tr>
              <tr>
                <td><code>HalfEdgeInputFilter</code></td>
                <td>
                  An input subscription narrowed to one edge: without the release, a fresh press
                  cannot be told from a chord. Match on <code>Input::Press</code> instead.
                </td>
              </tr>
              <tr>
                <td><code>ReservedId {'{'} class, id {'}'}</code></td>
                <td>
                  An exact id of <code>0xFFFF</code>, which is the every-id sentinel on the wire, so
                  the subscription would address the whole class instead. Only a media usage is wide
                  enough to reach it.
                </td>
              </tr>
              <tr>
                <td><code>Update {'{'} op, status, arg {'}'}</code></td>
                <td>
                  The box refused a{' '}
                  <A href="/library/update">firmware update</A> op. Carries the op, the{' '}
                  <A href="/native/commands/update#resp"><code>UpdateStatus</code></A> and its arg.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Errors;
