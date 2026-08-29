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
                <td>No device matched the expected VID/PID.</td>
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
                <td><code>BadProtoVer &#123; got &#125;</code></td>
                <td>
                  The box replied, but its <code>proto_ver</code> wasn't <code>6</code>;{' '}
                  <code>got</code> carries the reported value. See the{' '}
                  <A href="/library/connection">handshake</A>.
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
                <td><code>Update &#123; op, status, arg &#125;</code></td>
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
