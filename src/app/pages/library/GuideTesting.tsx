import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const GuideTesting: Component = () => {
  return (
    <>
      <div id="testing" data-search-target>
        <Card>
          <CardHeader title="Testing without hardware" subtitle="Assert the frames with MockBox" />
          <p>
            With the <A href="/library/features/mock"><code>mock</code></A> feature, drive a{' '}
            <A href="/library/connection"><code>Device</code></A> with a{' '}
            <A href="/library/features/mock"><code>MockBox</code></A> and assert the queued frames through{' '}
            <A href="/library/features/mock#inspect"><code>recorded_frames</code></A>.
          </p>
          <pre><code class="language-bash">cargo add medius --features mock</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Device, FrameType, MockBox};

#[test]
fn press_queues_an_inject() {
    let mock = MockBox::new();
    let device = Device::with_mock(mock.clone());

    device.press(Button::Left).unwrap();

    assert!(mock.saw(FrameType::Inject));
    let frame = mock
        .recorded_frames()
        .into_iter()
        .find(|f| f.ty == FrameType::Inject)
        .unwrap();
    assert_eq!(frame.payload, vec![0, 0, 0, 1]);
}`}</code></pre>
        </Card>
      </div>

      <div id="logs-without-hardware" data-search-target>
        <Card>
          <CardHeader title="Driving logs in a test" subtitle="Push log lines with a MockBox" />
          <p>
            <code>push_log</code> on a <code>MockBox</code> emits a{' '}
            <A href="/native/commands/admin#log"><code>LOG</code></A> frame that surfaces on{' '}
            <A href="/library/diagnostics#logs"><code>logs()</code></A> like a real one.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, LogLevel, MockBox};
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
        </Card>
      </div>

      <div id="mock-async" data-search-target>
        <Card>
          <CardHeader title="Testing async code" subtitle="A MockBox behind an AsyncDevice" />
          <p>
            There's no <code>AsyncDevice::with_mock</code>: build a mocked <code>Device</code>, then call{' '}
            <A href="/library/features/async"><code>into_async</code></A>. Drive the futures with{' '}
            <A href="/library/guides/calls#block-on"><code>block_on</code></A>, so the test needs no async
            runtime. A <A href="/library/features/mock"><code>silent</code></A> box never answers, resolving
            the query to{' '}
            <A href="/library/types/errors"><code>Err(Error::QueryTimeout)</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{Device, Error, MockBox, Version};

let mock = MockBox::new().with_version(Version {
    proto_ver: 3, fw_major: 1, fw_minor: 2, fw_patch: 3, mac: [0; 6], name: "Loki".into(),
});
let device = Device::with_mock(mock).into_async();
let v = block_on(device.query_version())?;
assert_eq!((v.fw_major, v.fw_minor, v.fw_patch), (1, 2, 3));

// a silent box times out:
let device = Device::with_mock(MockBox::new().silent()).into_async();
assert!(matches!(block_on(device.query_version()).unwrap_err(), Error::QueryTimeout));`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default GuideTesting;
