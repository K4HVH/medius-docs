import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Mock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Mock" subtitle="Test without hardware" />
        <p>
          A <code>MockBox</code> is an in-process fake Medius box behind the{' '}
          <code>mock</code> cargo feature.
        </p>
        <pre><code class="language-bash">cargo add medius --features mock</code></pre>
        <p>
          It's a cheap <code>Clone</code>: hand one to the{' '}
          <A href="/library/connection"><code>Device</code></A>, keep one to script and inspect.
        </p>
        <p>See also: <A href="/library/guides/testing#testing">testing with MockBox</A>.</p>
      </Card>

      <div id="create" data-search-target>
        <Card>
          <CardHeader title="Building a MockBox" subtitle="new, and why you clone it" />
          <pre class="api-signature">fn new() -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>

          <p>
            <code>new()</code> records every command and auto-replies to{' '}
            <code>QUERY(VERSION)</code> and <code>QUERY(HEALTH)</code> with defaults.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, MockBox};

let mock = MockBox::new();
let device = Device::with_mock(mock.clone());
// \`device\` drives the fake; \`mock\` still scripts and observes it.`}</code></pre>
        </Card>
      </div>

      <div id="wrap" data-search-target>
        <Card>
          <CardHeader title="Wrapping it in a Device" subtitle="with_mock and open_mock" />
          <pre class="api-signature">fn with_mock(mock: MockBox) -&gt; Device</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn open_mock(mock: MockBox) -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <div class="api-response-label">CONSTRUCTORS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Constructor</th>
                <th>Handshake</th>
                <th>Returns</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>with_mock</code></td>
                <td>No</td>
                <td><code>Device</code></td>
                <td>Wraps the fake and returns the device directly.</td>
              </tr>
              <tr>
                <td><code>open_mock</code></td>
                <td>Yes</td>
                <td><A href="/library/types/errors"><code>Result&lt;Device&gt;</code></A></td>
                <td>Also runs the version handshake, so it can fail the same way a real port can.</td>
              </tr>
            </tbody>
          </table>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, MockBox};

let device = Device::open_mock(MockBox::new())?;
device.move_rel(5, 5)?;`}</code></pre>

          <p>
            See the <A href="/library/features/mock#silent">silent-box card</A> for the two ways{' '}
            <code>open_mock</code> can fail.
          </p>
        </Card>
      </div>

      <div id="responses" data-search-target>
        <Card>
          <CardHeader title="Scripting query replies" subtitle="Set the version, health, and device-info a query returns" />
          <pre class="api-signature">fn with_version(self, version: Version) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn with_health(self, health: Health) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn with_device_info(self, device_info: DeviceInfo) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn with_caps(self, caps: Caps) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn with_mouse_caps(self, mouse: MouseCaps) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn with_kbd_caps(self, keyboard: KbdCaps) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn with_rate(self, rate: Rate) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn with_stats(self, stats: Stats) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn set_version(&self, version: Version)</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn set_health(&self, health: Health)</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>

          <p>
            The <code>with_*</code> builders set what each{' '}
            <A href="/library/requests">query</A> returns. <code>set_*</code> changes a live fake in
            place to flip the version or health mid-test.
          </p>
          <p>
            The <A href="/library/types/structs">structs</A> they take live on the types page;{' '}
            <A href="/library/types/structs#health"><code>Health::from_flags</code></A> builds one
            from the raw status byte.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Health, MockBox, Version};

let mock = MockBox::new()
    .with_version(Version { proto_ver: 5, fw_major: 5, fw_minor: 6, fw_patch: 7, mac: [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc], name: "Loki".into() })
    .with_health(Health::from_flags(0x0F));
let device = Device::with_mock(mock.clone());

let v = device.query_version()?;
assert_eq!((v.fw_major, v.fw_minor, v.fw_patch), (5, 6, 7));
assert!(device.query_health()?.mouse_attached);

// Change it mid-test: flip a later query_health.
mock.set_health(Health::from_flags(0x00));
assert!(!device.query_health()?.mouse_attached);`}</code></pre>
        </Card>
      </div>

      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="Injecting inbound traffic" subtitle="push_log, push_raw, and the three event pushes" />
          <pre class="api-signature">fn push_log(&self, level: LogLevel, text: &str)</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn push_raw(&self, bytes: &[u8])</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn push_motion(&self, seq: u8, ts_us: u32, dx: i16, dy: i16, dz: i16)</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn push_usages(&self, seq: u8, ts_us: u32, class: Class, direction: Direction, usages: &[Usage])</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn push_traffic(&self, seq: u8, ts_us: u32, clock: ClockDomain, class: CatchClass, id: u16, direction: Direction, flags: u8, true_len: u16, bytes: &[u8])</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>

          <p>
            All put bytes on the inbound stream as if the box emitted them. The three event calls each
            raise one <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A> variant on
            an <A href="/library/catch#event-stream"><code>EventStream</code></A>;{' '}
            <code>push_log</code> raises a <A href="/library/types/structs#log-line"><code>LogLine</code></A>{' '}
            on <A href="/library/diagnostics#logs"><code>logs()</code></A>, and <code>push_raw</code>{' '}
            sends arbitrary bytes.
          </p>

          <p>
            The <code>seq</code> counter is shared across all three, exactly as it is on the wire.
          </p>
          <p>
            Real losses do not show up here. Exercise loss handling through{' '}
            <code>CatchState::dropped</code> instead.
          </p>
          <p>
            <code>push_motion</code> and <code>push_usages</code> stamp themselves{' '}
            <A href="/library/types/enums#clock-domain"><code>ClockDomain::HostChip</code></A>, the only
            domain the box stamps those two frames in. <code>push_usages</code> carries its own{' '}
            <code>class</code>, so a test can push the empty snapshot.
          </p>
          <p>
            On <code>push_traffic</code>, <code>true_len</code> need not agree with{' '}
            <code>bytes.len()</code>, which is how you exercise <code>truncated()</code> with no real
            capture behind it.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use std::time::Duration;
use medius::{CatchClass, CatchEvent, CatchFilter, Class, ClockDomain, Device, Direction, Key,
             LogLevel, MockBox, Usage};

let mock = MockBox::new();
let device = Device::with_mock(mock.clone());
let rx = device.logs();

mock.push_log(LogLevel::Warn, "overheating");
let line = rx.recv_timeout(Duration::from_secs(1)).expect("a log line");
assert_eq!(line.text, "overheating");

// Feed the snapshot a Key subscription gets while A is held.
let stream = device.catch_events([CatchFilter::watch_class(Class::Key)])?;
mock.push_usages(0, 1_000, Class::Key, Direction::PRESS, &[Usage::from(Key::A)]);
assert!(matches!(stream.recv()?, CatchEvent::Usages(s) if s.is_held(Key::A)));

// Fake a truncated vendor-interrupt capture: 4 bytes captured of a 64-byte packet.
mock.push_traffic(
    1, 2_000, ClockDomain::HostChip, CatchClass::VendorInterrupt, 0x83, Direction::IN,
    0, 64, &[0x11, 0x22, 0x33, 0x44],
);
assert!(matches!(stream.recv()?, CatchEvent::Traffic(t) if t.truncated()));`}</code></pre>
        </Card>
      </div>

      <div id="inspect" data-search-target>
        <Card>
          <CardHeader title="Asserting what was sent" subtitle="recorded_frames, saw, recorded, clear_recorded" />
          <pre class="api-signature">fn recorded_frames(&self) -&gt; Vec&lt;DecodedFrame&gt;</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn recorded(&self) -&gt; usize</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn saw(&self, ty: FrameType) -&gt; bool</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn clear_recorded(&self)</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>

          <div class="api-response-label">METHODS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Method</th>
                <th>Returns</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>recorded_frames</code></td>
                <td><A href="/library/types/frames"><code>Vec&lt;DecodedFrame&gt;</code></A></td>
                <td>Every command the host sent so far, decoded, in order.</td>
              </tr>
              <tr>
                <td><code>recorded</code></td>
                <td><code>usize</code></td>
                <td>The count of commands recorded so far.</td>
              </tr>
              <tr>
                <td><code>saw</code></td>
                <td><code>bool</code></td>
                <td>Whether the host sent at least one frame of the given type.</td>
              </tr>
              <tr>
                <td><code>clear_recorded</code></td>
                <td><code>()</code></td>
                <td>Drops the recorded history so you can assert only on the next phase.</td>
              </tr>
            </tbody>
          </table>

          <p>
            A <A href="/library/types/frames"><code>DecodedFrame</code></A> is{' '}
            <code>{`{ ty, seq, payload }`}</code>; a{' '}
            <A href="/library/inject"><code>press(Button::Left)</code></A> records a{' '}
            <A href="/library/types/frames"><code>FrameType::Inject</code></A> frame with payload{' '}
            <code>[0, 0, 0, 1]</code> (class <code>0</code> = button, id <code>0</code>, action{' '}
            <code>1</code>).
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Device, FrameType, MockBox};

let mock = MockBox::new();
let device = Device::with_mock(mock.clone());

device.press(Button::Left)?;

let frames = mock.recorded_frames();
let inject = frames
    .iter()
    .find(|f| f.ty == FrameType::Inject)
    .expect("press recorded");
assert_eq!(inject.payload, vec![0, 0, 0, 1]);
assert!(mock.saw(FrameType::Inject));

mock.clear_recorded(); // next assertions start from an empty record`}</code></pre>
        </Card>
      </div>

      <div id="silent" data-search-target>
        <Card>
          <CardHeader title="Simulating a box that never replies" subtitle="silent, and the handshake failures" />
          <pre class="api-signature">fn silent(self) -&gt; MockBox</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>

          <p>
            <code>silent()</code> records commands but sends no reply to a query. The two{' '}
            <A href="/library/features/mock#wrap"><code>open_mock</code></A> failures are a silent box
            (<A href="/library/types/errors"><code>Error::NoReply</code></A>) and an unknown protocol
            version (<A href="/library/types/errors"><code>Error::BadProtoVer</code></A>).
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Error, MockBox, Version};

// A silent box sends no reply.
let err = Device::open_mock(MockBox::new().silent()).unwrap_err();
assert!(matches!(err, Error::NoReply));

// A box on an unknown protocol version fails the handshake.
let mock = MockBox::new().with_version(Version {
    proto_ver: 9,
    fw_major: 0,
    fw_minor: 0,
    fw_patch: 0,
    mac: [0; 6],
    name: String::new(),
});
let err = Device::open_mock(mock).unwrap_err();
assert!(matches!(err, Error::BadProtoVer { got: 9 }));`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Mock;
