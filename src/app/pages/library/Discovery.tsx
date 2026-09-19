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
            Reads each connected box's{' '}
            <A href="/library/types/structs#version"><code>Version</code></A> (with its protocol, MAC and
            name) and, on a box that speaks{' '}
            <A href="/library/connection#zero-config"><code>PROTO_VER</code></A>, its cloned{' '}
            <A href="/library/types/structs#device-info"><code>DeviceInfo</code></A>, returning one{' '}
            <A href="/library/types/structs#box-info"><code>BoxInfo</code></A> per box. A box on another
            protocol is listed with <code>device</code> <code>None</code>, so a box that needs a{' '}
            <A href="/dashboard/update">firmware update</A> still shows up.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

for b in Device::list() {
    // id() is the box MAC hex; name() is its readable label; a DeviceInfo displays as "VVVV:PPPP product".
    match &b.device {
        Some(d) => println!("{}  {}  {}  {}", b.id(), b.name(), d, b.port.path),
        None => println!("{}  {}  protocol {}: update its firmware", b.id(), b.name(), b.version.proto_ver),
    }
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
            <A href="/library/types/errors"><code>Error::BadProtoVer</code></A> when that box speaks
            another protocol, and <A href="/library/types/errors"><code>Error::NotFound</code></A> when
            no connected box matches.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Error};

// the MAC hex printed by Device::list(), stable across replugs:
match Device::open_by_id("123456789abc") {
    Ok(device) => device.move_rel(10, 0)?,
    Err(Error::BadProtoVer { got }) => println!("that box speaks protocol {got}: update its firmware"),
    Err(e) => return Err(e),
}`}</code></pre>
        </Card>
      </div>

      <div id="find-mouse-box" data-search-target>
        <Card>
          <CardHeader title="find_mouse_box" subtitle="Open the first box cloning a mouse" />
          <pre class="api-signature">fn find_mouse_box() -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Opens the first box whose clone's{' '}
            <A href="/library/types/enums#device-kind"><code>DeviceKind</code></A> is a mouse. With none,
            a connected box on another protocol answers{' '}
            <A href="/library/types/errors"><code>Error::BadProtoVer</code></A>, since its clone is
            unread; otherwise it's <A href="/library/types/errors"><code>Error::NotFound</code></A>.
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
            box whose clone is a keyboard, with the same errors.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Key};

let kbd_box = Device::find_keyboard_box()?;
kbd_box.press(Key::A)?;`}</code></pre>
        </Card>
      </div>

      <div id="find-where" data-search-target>
        <Card>
          <CardHeader title="find_where" subtitle="Open the first box matching a predicate" />
          <pre class="api-signature">fn find_where(pred: impl Fn(&amp;BoxInfo) -&gt; bool) -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            The general form the <code>find_*_box</code> helpers build on: opens the first box whose{' '}
            <A href="/library/types/structs#box-info"><code>BoxInfo</code></A> satisfies <code>pred</code>,
            preferring a box that speaks <code>PROTO_VER</code>. A matching box on another protocol
            answers <A href="/library/types/errors"><code>Error::BadProtoVer</code></A>, and no match is{' '}
            <A href="/library/types/errors"><code>Error::NotFound</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

// the box cloning a Logitech device (device is None on a box on another protocol):
let device = Device::find_where(|b| b.device.as_ref().is_some_and(|d| d.vid == 0x046D))?;`}</code></pre>
        </Card>
      </div>

      <div id="identity" data-search-target>
        <Card>
          <CardHeader title="Identity & reconnect" subtitle="The same physical box, across replugs" />
          <p>
            A box's identity is its device chip's base MAC (from{' '}
            <A href="/library/types/structs#version"><code>Version::mac_hex</code></A>) plus the CH343{' '}
            adapter's serial. Serial paths renumber on replug; the identity does not, so{' '}
            <A href="/library/discovery#open-by-id"><code>open_by_id</code></A> re-finds the same box.
          </p>
          <p>
            Opening a box anchors <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> to that
            identity. An automatic reconnect re-finds the <em>same</em> physical box even if the ports
            renumbered, and never adopts a different box that happens to be plugged in, or this box once it
            answers on another protocol.
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
            constructors; they block on reading each box and on the handshake, like their{' '}
            <A href="/library/connection#async"><code>Device</code></A> counterparts. The reply-reading{' '}
            <A href="/library/requests#device-info"><code>device_info</code></A> query is the awaitable
            part.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::AsyncDevice;

let device = AsyncDevice::find_mouse_box()?; // blocks on the handshake
let info = futures::executor::block_on(device.device_info())?; // awaits the reply`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Discovery;
