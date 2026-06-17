import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Flash: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Flash" subtitle="Reflash a box from Rust" />
        <p>
          Writes new firmware onto a box's two chips (see <A href="/native/flashing">Flashing</A>),
          rebooting a chip into download mode then writing the image. Behind the <code>flash</code>{' '}
          Cargo feature, off by default.
        </p>
        <pre><code>cargo add medius --features flash</code></pre>
        <p>
          With the feature off, none of the <code>medius::flash</code> items below exist.
        </p>
        <p>See also: the firmware-side <A href="/native/flashing">flashing</A> page.</p>
      </Card>

      <div id="prerequisites" data-search-target>
        <Card>
          <CardHeader title="What you need first" subtitle="esptool.py, the chip, the address" />
          <p>
            <a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer"><code>esptool.py</code></a>{' '}
            must be on <code>PATH</code> as the script, not a bare <code>esptool</code> binary (else{' '}
            <A href="#errors"><code>Error::FlashTool</code></A>).
          </p>
          <div class="callout callout--warning">
            <p>
              <A href="#flash"><code>flash</code></A> exists on Linux and Windows only, compiled out
              on macOS. The consts and <A href="#args"><code>esptool_args</code></A> are always
              present.
            </p>
          </div>
          <p>
            The four consts are public:
          </p>
          <pre class="api-signature">const ESPTOOL: &amp;str; const CHIP: &amp;str; const FLASH_ADDR: &amp;str; const ROM_SETTLE: Duration</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::flash;

println!("tool:    {}", flash::ESPTOOL);     // esptool.py
println!("chip:    {}", flash::CHIP);        // esp32s3
println!("address: {}", flash::FLASH_ADDR);  // 0x10000
println!("settle:  {:?}", flash::ROM_SETTLE); // 2s`}</code></pre>
        </Card>
      </div>

      <div id="flash" data-search-target>
        <Card>
          <CardHeader title="medius::flash" subtitle="Reboot into download mode, then write the image" />
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
                <td>Serial port the box is on, for example <code>/dev/ttyACM0</code>.</td>
              </tr>
              <tr>
                <td><code>bin_path</code></td>
                <td><code>impl AsRef&lt;Path&gt;</code></td>
                <td>Path to the firmware image to write.</td>
              </tr>
              <tr>
                <td><code>host</code></td>
                <td><code>bool</code></td>
                <td>Picks the chip. <code>false</code> flashes the device chip, <code>true</code> the host chip.</td>
              </tr>
            </tbody>
          </table>
          <p>
            The <code>host</code> flag picks the reboot target:{' '}
            <code>false</code> is <A href="/library/types/enums"><code>RebootTarget::DeviceDownload</code></A>,{' '}
            <code>true</code> is <code>RebootTarget::HostDownload</code> (see{' '}
            <A href="/library/admin#reboot"><code>reboot</code></A> for the full set).
          </p>
          <p>One call reboots the chosen chip into download mode, frees the port, then runs <code>esptool.py write_flash</code>; the firmware-side sequence is on <A href="/native/flashing#two-chips">flashing</A>.</p>
          <p>
            Blocks for the wait plus the tool's runtime, returning <code>Ok(())</code> on a clean
            exit else <A href="#errors"><code>Err(Error::FlashTool)</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::flash;

// false -> device chip
flash::flash("/dev/ttyACM0", "device.bin", false)?;

// true -> host chip
flash::flash("/dev/ttyACM0", "host.bin", true)?;`}</code></pre>
        </Card>
      </div>

      <div id="args" data-search-target>
        <Card>
          <CardHeader title="Inspecting the command" subtitle="See exactly what esptool runs" />
          <pre class="api-signature">fn esptool_args(port: &amp;str, bin_path: &amp;Path) -&gt; Vec&lt;String&gt;</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            Builds the exact argv <A href="#flash"><code>flash</code></A> passes to{' '}
            <code>esptool.py</code>, without running it. To debug, reboot the chip into download mode
            via <A href="/library/admin#reboot"><code>reboot</code></A> and run these args by hand.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::path::Path;
use medius::flash;

let argv = flash::esptool_args("/dev/ttyACM0", Path::new("device.bin"));
println!("esptool.py {}", argv.join(" "));
// esptool.py --chip esp32s3 --port /dev/ttyACM0 --before no_reset
//   --after hard_reset write_flash 0x10000 device.bin`}</code></pre>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="When it fails" subtitle="Error::FlashTool" />
          <p>
            The feature adds <code>Error::FlashTool(String)</code> to the{' '}
            <A href="/library/types/errors"><code>Error</code></A> enum. It fires when{' '}
            <code>esptool.py</code> can't be spawned (not on <code>PATH</code>) or exits non-zero, the
            inner <code>String</code> carrying the stderr tail.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{flash, Error};

match flash::flash("/dev/ttyACM0", "device.bin", false) {
    Ok(()) => println!("flashed"),
    Err(Error::FlashTool(msg)) => {
        eprintln!("flash failed: {msg}");
        eprintln!("hint: is esptool.py on PATH and the port correct?");
    }
    Err(e) => eprintln!("other error: {e}"),
}`}</code></pre>
        </Card>
      </div>

      <div id="testing" data-search-target>
        <Card>
          <CardHeader title="Flashing in tests" subtitle="Swap the runner, skip the hardware" />
          <p>
            <A href="#flash"><code>flash</code></A> wraps <code>flash_with</code>; pass a fake{' '}
            <code>CommandRunner</code> and a no-op reboot closure to test without hardware.
          </p>
          <pre class="api-signature">fn flash_with&lt;R, F&gt;(port: &amp;str, bin_path: &amp;Path, host: bool, runner: &amp;R, reboot: F) -&gt; Result&lt;()&gt;
where R: CommandRunner, F: FnOnce(&amp;str, bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
        </Card>
      </div>

    </>
  );
};

export default Flash;
