import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Flash: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Flash" subtitle="Firmware flashing from Rust" />
        <p>
          Flashing writes new firmware onto the box, to update it or recover one. The box has two
          chips, each reflashed separately (see <A href="/native/flashing">Flashing</A>). This feature
          drives the whole sequence from Rust: it puts a chip into download mode, then writes the
          image. Use it to update a box from your own tool instead of running the flasher by hand.
        </p>
      </Card>

      <div id="feature" data-search-target>
        <Card>
          <CardHeader title="The flash feature" subtitle="Build-time opt-in" />
          <p>
            The flashing code sits behind the <code>flash</code> Cargo feature. Turn it on with{' '}
            <code>cargo add medius --features flash</code>. With it off, none of the types or functions
            below exist.
          </p>
        </Card>
      </div>

      <div id="module" data-search-target>
        <Card>
          <CardHeader title="medius::flash" subtitle="Reboot into download mode, then image write" />
          <pre class="api-signature">fn flash(port: &amp;str, bin_path: impl AsRef&lt;Path&gt;, host: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>port</code></td>
                <td><code>&amp;str</code></td>
                <td>Serial port the box is on.</td>
              </tr>
              <tr>
                <td><code>bin_path</code></td>
                <td><code>impl AsRef&lt;Path&gt;</code></td>
                <td>Path to the firmware image to write.</td>
              </tr>
              <tr>
                <td><code>host</code></td>
                <td><code>bool</code></td>
                <td>Picks the chip: true flashes the host chip, false the device chip.</td>
              </tr>
            </tbody>
          </table>
          <p>
            <code>medius::flash</code> runs two steps in order:
          </p>
          <ol>
            <li>
              Send a <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> frame to drop a
              chip into ROM download mode, the loader built into the chip that takes firmware over the
              serial link.
            </li>
            <li>
              Hand off to <a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer"><code>esptool</code></a>, <a href="https://www.espressif.com" target="_blank" rel="noreferrer">Espressif</a>'s flashing tool for these chips, which writes
              the image.
            </li>
          </ol>
          <p>
            The <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> payload byte{' '}
            <code>target</code> picks which chip reboots and whether it comes back in download mode or
            running. The Rust side names those choices as the{' '}
            <A href="/library/types#enums"><code>RebootTarget</code></A> enum. For flashing, use one of
            the two download variants; the <A href="/library/admin#reboot"><code>reboot</code></A>{' '}
            method covers the full set.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// false flashes the device chip, true the host chip
medius::flash("/dev/ttyACM0", "device.bin", false)?;`}</code></pre>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="Tool failure variant" />
          <p>
            The feature adds one variant to the{' '}
            <A href="/library/types#errors"><code>Error</code></A> enum:{' '}
            <code>Error::FlashTool(String)</code>, returned when <code>esptool</code> can't be run or
            exits with a failure. The <code>String</code> carries the tool's message. It exists only
            with the <code>flash</code> feature on.
          </p>
          <div class="callout callout--info">
            <p>
              See <A href="/native/flashing">Flashing</A> for the native side,{' '}
              <A href="/library/admin#reboot"><code>reboot</code></A> for the full set of{' '}
              <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> targets, and{' '}
              <A href="/library/types#errors"><code>Error</code></A> for the rest of the error enum.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              The other features are <A href="/library/features/async"><code>async</code></A>,{' '}
              <A href="/library/features/mock"><code>mock</code></A>, and{' '}
              <A href="/library/features/tracing"><code>tracing</code></A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Flash;
