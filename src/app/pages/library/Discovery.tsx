import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Discovery: Component = () => {
  return (
    <>
      <div id="discovery-overview" data-search-target>
        <Card>
          <CardHeader title="Discovery" subtitle="Find and open one box out of several" />
          <p>
            With more than one box plugged in,{' '}
            <A href="/library/connection#open"><code>find</code></A> just opens the first match. These
            calls enumerate every box and open a specific one by a stable{' '}
            <A href="/library/discovery#identity">identity</A>, or by the kind of device it clones.
          </p>
          <p>
            See also: <A href="/library/connection">connecting</A>,{' '}
            <A href="/library/guides/connection#choosing-a-port">choosing a port</A>, and the box{' '}
            <A href="/native/connection#handshake">handshake</A>.
          </p>
        </Card>
      </div>

      <div id="list" data-search-target>
        <Card>
          <CardHeader title="list" subtitle="Enumerate every connected box" />
          <pre class="api-signature">fn list() -&gt; Vec&lt;BoxInfo&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Opens each connected box in turn, handshakes, reads its{' '}
            <A href="/library/requests#version"><code>Version</code></A> (with the box MAC) and cloned{' '}
            <A href="/library/requests#device-info"><code>DeviceInfo</code></A>, then closes it,
            returning one <A href="/library/discovery#box-info"><code>BoxInfo</code></A> per box. Use it
            to show a picker, or to choose a box yourself.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

for b in Device::list() {
    // id() is the box MAC hex; b.device Displays as "VVVV:PPPP product".
    println!("{}  {}  {}", b.id(), b.device, b.port.path);
}`}</code></pre>
        </Card>
      </div>

      <div id="open-by-id" data-search-target>
        <Card>
          <CardHeader title="open_by_id" subtitle="Open the box with a given identity" />
          <pre class="api-signature">fn open_by_id(id: &amp;str) -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Opens the box whose identity matches <code>id</code>: either the device MAC hex (from{' '}
            <A href="/library/types/structs#version"><code>Version::mac_hex</code></A>) or the CH343{' '}
            <A href="/library/types/structs#port-info">serial</A>. Returns{' '}
            <A href="/library/types/errors"><code>Error::NotFound</code></A> when no connected box
            matches.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

// the MAC hex printed by Device::list(), stable across replugs:
let device = Device::open_by_id("123456789abc")?;`}</code></pre>
        </Card>
      </div>

      <div id="find-mouse-box" data-search-target>
        <Card>
          <CardHeader title="find_mouse_box" subtitle="Open the first box cloning a mouse" />
          <pre class="api-signature">fn find_mouse_box() -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Opens the first box whose clone's{' '}
            <A href="/library/types/enums#device-kind"><code>DeviceKind</code></A> is a mouse. Handy when
            one box clones a mouse and another a keyboard: it grabs the right one without naming an id.
            Returns <A href="/library/types/errors"><code>Error::NotFound</code></A> if no connected box
            matches.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let mouse_box = Device::find_mouse_box()?;
mouse_box.move_rel(10, 0)?;`}</code></pre>
        </Card>
      </div>

      <div id="find-keyboard-box" data-search-target>
        <Card>
          <CardHeader title="find_keyboard_box" subtitle="Open the first box cloning a keyboard" />
          <pre class="api-signature">fn find_keyboard_box() -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            The keyboard counterpart of{' '}
            <A href="/library/discovery#find-mouse-box"><code>find_mouse_box</code></A>: opens the first
            box whose clone is a keyboard.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Key};

let kbd_box = Device::find_keyboard_box()?;
kbd_box.key_down(Key::A)?;`}</code></pre>
        </Card>
      </div>

      <div id="find-where" data-search-target>
        <Card>
          <CardHeader title="find_where" subtitle="Open the first box matching a predicate" />
          <pre class="api-signature">fn find_where(pred: impl Fn(&amp;BoxInfo) -&gt; bool) -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            The general form the <code>find_*_box</code> helpers build on: opens the first box whose{' '}
            <A href="/library/discovery#box-info"><code>BoxInfo</code></A> satisfies <code>pred</code>.
            Match on any field, e.g. a specific vendor id or product string. Returns{' '}
            <A href="/library/types/errors"><code>Error::NotFound</code></A> when none match.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

// the box cloning a Logitech device:
let device = Device::find_where(|b| b.device.vid == 0x046D)?;`}</code></pre>
        </Card>
      </div>

      <div id="box-info" data-search-target>
        <Card>
          <CardHeader title="BoxInfo" subtitle="One discovered box" />
          <p>
            One entry from <A href="/library/discovery#list"><code>Device::list</code></A> (and the value
            <A href="/library/discovery#find-where"><code>find_where</code></A>'s predicate sees): the
            box's control port, firmware version, and the device it clones.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>port</code></td><td><A href="/library/types/structs#port-info"><code>PortInfo</code></A></td><td>The control port (path + CH343 serial).</td></tr>
              <tr><td><code>version</code></td><td><A href="/library/types/structs#version"><code>Version</code></A></td><td>The firmware version, with the box MAC.</td></tr>
              <tr><td><code>device</code></td><td><A href="/library/types/structs#device-info"><code>DeviceInfo</code></A></td><td>The device it clones.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>id()</code></td><td><code>String</code></td><td>The box identity: the MAC hex, as passed to <A href="/library/discovery#open-by-id"><code>open_by_id</code></A>.</td></tr>
              <tr><td><code>serial()</code></td><td><code>Option&lt;&amp;str&gt;</code></td><td>The CH343 adapter's serial, when it serves one.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="identity" data-search-target>
        <Card>
          <CardHeader title="Identity & reconnect" subtitle="The same physical box, across replugs" />
          <p>
            A box has a stable identity: the device chip's base MAC (from{' '}
            <A href="/library/types/structs#version"><code>Version::mac_hex</code></A>) and the CH343{' '}
            adapter's serial. Serial-port paths renumber when you replug, but the identity does not, so{' '}
            <A href="/library/discovery#open-by-id"><code>open_by_id</code></A> re-finds the same box every
            time.
          </p>
          <p>
            Opening a box anchors <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> to that
            identity. An automatic reconnect re-finds the <em>same</em> physical box even if the ports
            renumbered, and never adopts a different box that happens to be plugged in.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="The same discovery, awaitable device_info" />
          <pre class="api-signature">fn AsyncDevice::list() -&gt; Vec&lt;BoxInfo&gt;</pre>
          <pre class="api-signature">fn AsyncDevice::open_by_id(id: &amp;str) -&gt; Result&lt;AsyncDevice&gt;</pre>
          <pre class="api-signature">fn AsyncDevice::find_mouse_box() -&gt; Result&lt;AsyncDevice&gt;</pre>
          <pre class="api-signature">fn AsyncDevice::find_keyboard_box() -&gt; Result&lt;AsyncDevice&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> mirrors the discovery
            constructors; they block on the per-box handshake, like their{' '}
            <A href="/library/connection#async"><code>Device</code></A> counterparts. The reply-reading{' '}
            <A href="/library/requests#device-info"><code>device_info</code></A> query is the awaitable
            part.
          </p>
          <pre><code class="language-rust">{`use medius::AsyncDevice;

let device = AsyncDevice::find_mouse_box()?; // blocks on the handshake
let info = futures::executor::block_on(device.device_info())?; // awaits the reply`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Discovery;
