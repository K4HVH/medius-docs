import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Testing: Component = () => {
  return (
    <>
      <div id="testing" data-search-target>
        <Card>
          <CardHeader title="Testing without hardware" subtitle="Assert the frames with MockBox" />
          <p>
            Drive a <code>Device</code> with a{' '}
            <A href="/library/features/mock"><code>MockBox</code></A> and assert the queued frames.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device, FrameType, MockBox};

let mock = MockBox::new();
let device = Device::with_mock(mock.clone());

device.press(Button::Left)?;

assert!(mock.saw(FrameType::Button));
// the recorded BUTTON payload is [id, action] = [0, 1]
let frame = mock
    .recorded_frames()
    .into_iter()
    .find(|f| f.ty == FrameType::Button)
    .unwrap();
assert_eq!(frame.payload, vec![0, 1]);`}</code></pre>
          <div class="callout callout--info">
            <p>
              Pull in the fake box with <code>cargo add medius --features mock</code>.
            </p>
          </div>
        </Card>
      </div>

      <div id="logs-without-hardware" data-search-target>
        <Card>
          <CardHeader title="Driving logs in a test" subtitle="Push log lines with a MockBox" />
          <p>
            With the <A href="/library/features/mock"><code>mock</code></A> feature,{' '}
            <code>push_log</code> on a <code>MockBox</code> emits a{' '}
            <A href="/native/commands/admin#log"><code>LOG</code></A> frame that surfaces on{' '}
            <code>logs()</code> like a real one.
          </p>

          <pre><code>cargo add medius --features mock</code></pre>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, LogLevel, MockBox};
use std::time::Duration;

#[test]
fn logs_reach_the_stream() {
    let mock = MockBox::new();
    let device = Device::with_mock(mock.clone());
    let stream = device.logs();

    mock.push_log(LogLevel::Warn, "overheating");

    let line = stream.recv_timeout(Duration::from_secs(1)).unwrap();
    assert_eq!(line.level, LogLevel::Warn);
    assert_eq!(line.text, "overheating");
}`}</code></pre>

          <p>
            Run with <code>cargo test --features mock</code>; see{' '}
            <A href="/library/features/mock"><code>MockBox</code></A> for the rest of the API.
          </p>
        </Card>
      </div>

      <div id="mock" data-search-target>
        <Card>
          <CardHeader title="Testing async code" subtitle="AsyncDevice over a MockBox" />
          <p>
            With <A href="/library/features/mock"><code>mock</code></A> on alongside <code>async</code>,{' '}
            <code>with_mock</code> drives an <code>AsyncDevice</code> over a fake box, skipping the handshake.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{Device, MockBox, Version};

let mock = MockBox::new().with_version(Version {
    proto_ver: 1,
    fw_major: 1,
    fw_minor: 2,
    fw_patch: 3,
});
let device = Device::with_mock(mock).into_async();
let v = block_on(device.query_version())?;
assert_eq!((v.fw_major, v.fw_minor, v.fw_patch), (1, 2, 3));`}</code></pre>

          <p>
            A <code>silent</code> box never answers, so the query resolves to{' '}
            <code>Err(Error::QueryTimeout)</code>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{Device, Error, MockBox};

let device = Device::with_mock(MockBox::new().silent()).into_async();
let err = block_on(device.query_version()).unwrap_err();
assert!(matches!(err, Error::QueryTimeout));`}</code></pre>
        </Card>
      </div>

      <div id="mock-async" data-search-target>
        <Card>
          <CardHeader title="Mocking an AsyncDevice" subtitle="Wrap, then into_async" />

          <p>
            There's no <code>AsyncDevice::with_mock</code>: build a mocked <code>Device</code>, then
            call <A href="/library/features/async"><code>into_async</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{Device, MockBox};

let device = Device::with_mock(MockBox::new()).into_async();
device.move_rel(10, 0)?; // fire-and-forget, stays sync
let v = block_on(device.query_version())?;`}</code></pre>

          <div class="callout callout--info">
            <p>
              <code>block_on</code> works under any runtime, so the same mocked{' '}
              <A href="/library/features/async"><code>AsyncDevice</code></A> tests run with no async
              runtime at all.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Testing;
