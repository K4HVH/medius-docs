import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Examples: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Cookbook" subtitle="Full worked programs, one per task" />
        <p>
          Each section is a complete program lifted from its{' '}
          <A href="/library/connection">guide</A> page.
        </p>
      </Card>

      <div id="connect" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Open, handshake, use, release" />
          <p>
            Open, handshake, move, click, hand back with <code>reset</code>, print the{' '}
            <A href="/library/diagnostics#counters">counters</A>, and drop.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device, Error};

fn main() -> medius::Result<()> {
    // open by path if one is given, else auto-detect:
    let device = match std::env::args().nth(1) {
        Some(path) => Device::open(path)?,
        None => match Device::find() {
            Ok(device) => device,
            Err(Error::NotFound) => {
                eprintln!("no box found; plug one in");
                return Ok(());
            }
            Err(Error::BadProtoVer { got }) => {
                eprintln!("box speaks proto {got}, this crate speaks 1");
                return Ok(());
            }
            Err(e) => return Err(e),
        },
    };

    let version = device.query_version()?;
    println!("connected: {version}");

    device.move_rel(40, 0)?;       // 40 units right
    device.press(Button::Left)?;   // hold left
    device.soft_release(Button::Left)?;

    device.reset()?;               // back to passthrough now

    println!("counters: {:?}", device.counters());
    Ok(())
    // device drops here: threads stop, port closes
}`}</code></pre>
        </Card>
      </div>

      <div id="move-scroll" data-search-target>
        <Card>
          <CardHeader title="Putting it together" subtitle="Open, glide the cursor, scroll, done" />
          <p>
            Find the box, glide the cursor, scroll, return.
          </p>
          <pre><code>cargo add medius</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;
use std::thread::sleep;
use std::time::Duration;

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    // Glide ~400 counts to the right at roughly 1 kHz.
    for _ in 0..200 {
        device.move_rel(2, 0)?;
        sleep(Duration::from_millis(1));
    }

    // Scroll down three notches.
    device.wheel(-3)?;

    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="click" data-search-target>
        <Card>
          <CardHeader title="Full example" subtitle="Open, click, reset" />
          <p>
            Open, click, then clear every override with{' '}
            <A href="/library/admin#reset"><code>reset</code></A>. Mirrors{' '}
            <code>examples/basic.rs</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::{thread, time::Duration};
use medius::{Button, Device};

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    device.press(Button::Left)?;
    thread::sleep(Duration::from_millis(20));
    device.soft_release(Button::Left)?;

    device.reset()?; // drop every override, back to plain passthrough
    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="version-health" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Find the box, read version and health, check readiness" />
          <p>
            Drop into <code>src/main.rs</code>: finds the box, reads both queries, reports inject
            readiness.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    let v = device.query_version()?;
    let h = device.query_health()?;

    println!("connected: {v}");
    println!(
        "health: link_up={} mouse_attached={} clone_configured={} injection_active={}",
        h.link_up, h.mouse_attached, h.clone_configured, h.injection_active,
    );

    if h.link_up && h.mouse_attached && h.clone_configured {
        println!("chain is live, safe to inject");
    } else {
        println!("not ready yet");
    }

    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="admin" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Connect, inject, reset, reboot" />
          <pre><code>cargo add medius</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device, RebootTarget};

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    let version = device.query_version()?;
    let health = device.query_health()?;
    println!("connected: {version}");
    println!("link_up={} mouse_attached={}", health.link_up, health.mouse_attached);

    // inject something
    device.move_rel(40, 0)?;
    device.press(Button::Left)?;
    device.soft_release(Button::Left)?;

    // and undo it: back to pure passthrough
    device.reset()?;
    println!("counters: {:?}", device.counters());

    // restart the device chip; this drops the serial link we're on
    device.reboot(RebootTarget::DeviceRun)?;
    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="lifecycle" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Hold a button, force a reconnect, restore state" />
          <p>
            Hold a button, force a reconnect and confirm the counter rose, reapply, then return to
            passthrough.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device};

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    // Hold a button. The keepalive thread now keeps it alive on its
    // own; no further calls are needed to survive the silence window.
    device.press(Button::Left)?;

    // Force a rescan as if the cable was just replugged.
    let before = device.counters().reconnects;
    device.reconnect()?;
    println!("reconnects: {} -> {}", before, device.counters().reconnects);

    // reconnect already reapplied; this is the no-op-when-held path.
    device.reapply()?;

    // Back to passthrough. This clears the held override too.
    device.reset()?;
    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="logs-counters" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Watch logs and counters together" />
          <p>
            <code>Device</code> is <code>Clone</code>, so the log thread and main thread share one
            connection.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;
use std::thread;

fn main() -> medius::Result<()> {
    let device = match std::env::args().nth(1) {
        Some(path) => Device::open(path)?,
        None => Device::find()?,
    };

    // a background thread that prints box messages until the link drops
    let log_device = device.clone();
    thread::spawn(move || {
        for line in log_device.logs() {
            println!("[{:?}] {}", line.level, line.text);
        }
    });

    let before = device.counters();

    for _ in 0..100 {
        device.move_rel(1, 0)?;
    }

    let after = device.counters();
    println!("frames_tx   +{}", after.frames_tx - before.frames_tx);
    println!("frames_rx   +{}", after.frames_rx - before.frames_rx);
    println!("crc_drops   +{}", after.crc_drops - before.crc_drops);
    println!("reconnects  +{}", after.reconnects - before.reconnects);

    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Open, query concurrently, move, all in one file" />
          <p>
            Open the first box, run both queries together, fire a move, reset, then hand the sync handle back
            to read counters.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{Device, Result};

fn main() -> Result<()> {
    let device = Device::find()?.into_async();

    let (v, h) = block_on(futures::future::join(
        device.query_version(),
        device.query_health(),
    ));
    let v = v?;
    let h = h?;
    println!("connected: {v}");
    println!("link_up={} mouse_attached={}", h.link_up, h.mouse_attached);

    device.move_rel(40, 0)?;   // fire-and-forget, no .await
    device.reset()?;

    // counters live on the sync Device, so hand it back
    let device = device.into_inner();
    println!("counters: {:?}", device.counters());
    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="mock-test" data-search-target>
        <Card>
          <CardHeader title="Full test example" subtitle="A complete unit test" />
          <p>
            A complete <code>#[test]</code> to paste into a module.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device, FrameType, Health, MockBox, Version};

#[test]
fn box_reports_config_and_records_input() -> medius::Result<()> {
    let mock = MockBox::new()
        .with_version(Version { proto_ver: 1, fw_major: 5, fw_minor: 6, fw_patch: 7 })
        .with_health(Health::from_flags(0x0F));
    let device = Device::with_mock(mock.clone());

    // Queries come back as scripted.
    let v = device.query_version()?;
    assert_eq!((v.fw_major, v.fw_minor, v.fw_patch), (5, 6, 7));
    assert!(device.query_health()?.mouse_attached);

    // Drive input through the normal API.
    device.press(Button::Left)?;
    device.move_rel(20, -5)?;

    // Assert on what reached the wire.
    let frames = mock.recorded_frames();
    let button = frames
        .iter()
        .find(|f| f.ty == FrameType::Button)
        .expect("press recorded");
    assert_eq!(button.payload, vec![0, 1]);
    assert!(mock.saw(FrameType::Move));

    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="flash" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Update a box end to end" />
          <p>
            Reads port and image from argv and flashes the device chip; build with the{' '}
            <code>flash</code> feature on.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{flash, Error};

fn main() -> medius::Result<()> {
    let mut args = std::env::args().skip(1);
    let port = args.next().unwrap_or_else(|| "/dev/ttyACM0".into());
    let bin = args.next().unwrap_or_else(|| "device.bin".into());

    // false -> device chip, true -> host chip
    match flash::flash(&port, &bin, false) {
        Ok(()) => {
            println!("flashed {bin} onto {port}");
            Ok(())
        }
        Err(Error::FlashTool(msg)) => {
            eprintln!("flash failed: {msg}");
            eprintln!("check that esptool.py is on PATH and {port} is right");
            Err(Error::FlashTool(msg))
        }
        Err(e) => Err(e),
    }
}`}</code></pre>
          <p>
            Hardware-free test: pass a fake <code>CommandRunner</code> and a no-op reboot to{' '}
            <A href="/library/features/flash#testing"><code>flash_with</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::path::Path;
use medius::flash::{flash_with, CommandOutput, CommandRunner};
use medius::Result;

struct FakeRunner;

impl CommandRunner for FakeRunner {
    fn run(&self, _program: &str, _args: &[String]) -> Result<CommandOutput> {
        Ok(CommandOutput {
            success: true,
            stdout: "wrote 0 bytes".into(),
            stderr: String::new(),
        })
    }
}

#[test]
fn flashes_without_hardware() {
    let result = flash_with(
        "/dev/null",
        Path::new("device.bin"),
        false,
        &FakeRunner,
        |_port, _host| Ok(()), // no-op reboot: no box needed
    );
    assert!(result.is_ok());
}`}</code></pre>
        </Card>
      </div>

      <div id="tracing" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Subscriber, connect, traced calls" />
          <p>
            Subscriber, connect, and two traced calls, with stderr lines shown as trailing comments.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

fn main() -> medius::Result<()> {
    // INFO and up by default; bump medius to DEBUG to see queries resolve.
    tracing_subscriber::fmt()
        .with_env_filter("medius=debug")
        .init();

    let device = Device::find()?;
    //   INFO connect: medius::device: connected proto_ver=1 fw_major=1 fw_minor=2 fw_patch=0

    device.move_rel(40, 0)?;

    let health = device.query_health()?;
    //   DEBUG medius::device: query resolved selector=17 seq=3 resp_len=4
    println!("link_up={}", health.link_up);

    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="types" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Every type flowing through one program" />
          <p>
            Every type in one file on the{' '}
            <A href="/library/features/mock"><code>mock</code></A> feature; swap{' '}
            <code>Device::open_mock(...)</code> for <code>Device::find()?</code> for real hardware.
          </p>
          <pre><code>{`// cargo add medius --features mock
use medius::{Device, Error, Health, MockBox, Version};

fn main() -> medius::Result<()> {
    let mock = MockBox::new()
        .with_version(Version { proto_ver: 1, fw_major: 1, fw_minor: 4, fw_patch: 0 })
        .with_health(Health::from_flags(0b0000_0111));

    // open_mock runs the handshake, so a bad proto_ver surfaces here.
    let device = match Device::open_mock(mock) {
        Ok(device) => device,
        Err(Error::NotFound) => return Ok(eprintln!("no box found")),
        Err(Error::BadProtoVer { got }) => {
            return Ok(eprintln!("unsupported protocol {got}"));
        }
        Err(other) => return Err(other),
    };

    // Version: Display omits proto_ver, so print the field too.
    let version: Version = device.query_version()?;
    println!("{version} (protocol {})", version.proto_ver);

    // Health: four bools off the health byte.
    let health: Health = device.query_health()?;
    println!(
        "link_up={} mouse_attached={} clone_configured={} injection_active={}",
        health.link_up,
        health.mouse_attached,
        health.clone_configured,
        health.injection_active,
    );

    // CountersSnapshot: a plain copy of the running link totals.
    let counters = device.counters();
    println!("frames_tx={} frames_rx={}", counters.frames_tx, counters.frames_rx);

    Ok(())
}`}</code></pre>
        </Card>
      </div>

      <div id="error-handling" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="The Error enum and the Result alias" />
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

fn main() -> medius::Result<()> {
    let device = Device::find()?;       // ? bubbles a NotFound / NoReply up
    let version = device.query_version()?;
    println!("{version}");
    Ok(())
}`}</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, Error};

fn connect() -> medius::Result<Device> {
    match Device::find() {
        Ok(device) => Ok(device),
        Err(Error::NotFound) => {
            eprintln!("no box plugged in");
            Err(Error::NotFound)
        }
        Err(Error::NoReply) => {
            eprintln!("found a port but it didn't answer the handshake");
            Err(Error::NoReply)
        }
        Err(Error::BadProtoVer { got }) => {
            eprintln!("box speaks protocol {got}, this build expects 1");
            Err(Error::BadProtoVer { got })
        }
        Err(Error::QueryTimeout) => Err(Error::QueryTimeout),
        Err(Error::Disconnected) => Err(Error::Disconnected),
        Err(Error::FrameTooLong) => Err(Error::FrameTooLong),
        // Required: Error is #[non_exhaustive], so the wildcard is mandatory.
        Err(other) => Err(other),
    }
}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Examples;
