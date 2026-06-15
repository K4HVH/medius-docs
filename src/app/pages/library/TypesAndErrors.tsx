import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const TypesAndErrors: Component = () => {
  return (
    <>
      <div id="types-overview" data-search-target>
        <Card>
          <CardHeader
            title="Types & errors"
            subtitle="What you pass in, what you get back, and how calls fail"
          />
          <p>
            Every public type is re-exported at the crate root: import from{' '}
            <code>medius::</code>, not <code>medius::types::</code>. The argument{' '}
            <A href="/library/types/enums">enums</A>, the{' '}
            <A href="/library/types/structs">structs</A> the box reports back, and the one{' '}
            <A href="/library/types/errors"><code>Error</code></A> all live here.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, ButtonAction, Health, Version, Error, Result};

// One flat namespace. This does NOT work:
// use medius::types::Button;`}</code></pre>
        </Card>
      </div>

      <div id="sections" data-search-target>
        <Card>
          <CardHeader title="Reference pages" subtitle="Pick a group" />
          <div class="docs-grid">
            <A href="/library/types/enums" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Enums" subtitle="Button, ButtonAction, RebootTarget, LogLevel" />
              </Card>
            </A>
            <A href="/library/types/structs" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Structs" subtitle="Version, Health, LogLine, PortInfo, CountersSnapshot, LogStream" />
              </Card>
            </A>
            <A href="/library/types/frames" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Frames" subtitle="FrameType, DecodedFrame" />
              </Card>
            </A>
            <A href="/library/types/errors" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Errors" subtitle="Error, Result" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="complete-example" data-search-target>
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
    </>
  );
};

export default TypesAndErrors;
