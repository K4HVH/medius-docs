import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Frames: Component = () => {
  return (
    <>
      <div id="frames" data-search-target>
        <Card>
          <CardHeader title="Frame types" subtitle="FrameType and DecodedFrame for low-level work" />
          <p>
            Low-level types for inspecting raw <A href="/native/frame">frame</A> traffic:{' '}
            <code>FrameType</code> is the <code>TYPE</code> byte and <code>DecodedFrame</code> is one
            parsed frame.
          </p>

          <div class="api-response-label">VARIANTS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Opcode</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>Move</code></td>
                <td><code>0x01</code></td>
                <td>Motion-tagged cursor or wheel movement (PC to box).</td>
              </tr>
              <tr>
                <td><code>Inject</code></td>
                <td><code>0x03</code></td>
                <td>Class-tagged button, key, or media override (PC to box).</td>
              </tr>
              <tr>
                <td><code>Reset</code></td>
                <td><code>0x04</code></td>
                <td>Clear all injection (PC to box).</td>
              </tr>
              <tr>
                <td><code>Query</code></td>
                <td><code>0x05</code></td>
                <td>Request a state snapshot (PC to box).</td>
              </tr>
              <tr>
                <td><code>Resp</code></td>
                <td><code>0x06</code></td>
                <td>Reply to a query, with the request's seq echoed (box to PC).</td>
              </tr>
              <tr>
                <td><code>RebootDl</code></td>
                <td><code>0x07</code></td>
                <td>Reboot a chip to download or run (PC to box).</td>
              </tr>
              <tr>
                <td><code>Log</code></td>
                <td><code>0x08</code></td>
                <td>Unsolicited device diagnostics (box to PC).</td>
              </tr>
              <tr>
                <td><code>Led</code></td>
                <td><code>0x09</code></td>
                <td>Drive a status LED (PC to box).</td>
              </tr>
              <tr>
                <td><code>Lock</code></td>
                <td><code>0x0A</code></td>
                <td>Block a physical input (PC to box).</td>
              </tr>
              <tr>
                <td><code>Catch</code></td>
                <td><code>0x0B</code></td>
                <td>Subscribe to physical-input events (PC to box).</td>
              </tr>
              <tr>
                <td><code>Event</code></td>
                <td><code>0x0C</code></td>
                <td>A physical mouse snapshot (box to PC).</td>
              </tr>
              <tr>
                <td><code>KbEvent</code></td>
                <td><code>0x0F</code></td>
                <td>A physical keyboard snapshot (box to PC).</td>
              </tr>
              <tr>
                <td><code>ConsEvent</code></td>
                <td><code>0x10</code></td>
                <td>A physical media snapshot (box to PC).</td>
              </tr>
            </tbody>
          </table>

          <div class="api-response-label">DECODEDFRAME</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>ty</code></td>
                <td><code>FrameType</code></td>
                <td>Which opcode this frame carries.</td>
              </tr>
              <tr>
                <td><code>seq</code></td>
                <td><code>u8</code></td>
                <td>The sequence byte; a reply echoes the request's value.</td>
              </tr>
              <tr>
                <td><code>payload</code></td>
                <td><code>Vec&lt;u8&gt;</code></td>
                <td>The raw payload bytes, already CRC-checked.</td>
              </tr>
            </tbody>
          </table>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{FrameType, DecodedFrame};

// Byte -> variant is fallible; an unknown opcode is an Err.
assert_eq!(FrameType::try_from(0x06), Ok(FrameType::Resp));
assert!(FrameType::try_from(0xFF).is_err());

// Variant -> byte always works.
assert_eq!(u8::from(FrameType::Log), 0x08);

// Read a decoded frame by field.
let frame = DecodedFrame { ty: FrameType::Resp, seq: 7, payload: vec![1, 0x0B] };
println!("{:?} seq={} {} bytes", frame.ty, frame.seq, frame.payload.len());`}</code></pre>

          <div class="callout callout--info">
            <p>
              Full wire layout is on the <A href="/native/frame">frame</A> page. For everyday work,
              stay on <A href="/library/requests">Requests</A> and{' '}
              <A href="/library/diagnostics">Diagnostics</A> instead.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Frames;
