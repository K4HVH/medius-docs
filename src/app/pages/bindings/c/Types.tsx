import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Types: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Types & errors" subtitle="Every C struct, enum, and status code, by table" />
        <p>
          The <code>Medius*</code> types and <code>MEDIUS_*</code> enumerators from{' '}
          <A href="/bindings/c"><code>medius.h</code></A>.
          The calls that produce and consume them are on <A href="/bindings/c/api">API index</A>;
          streams on <A href="/bindings/c/streams">Streams</A>. What each value means lives with the
          canonical type docs in the <A href="/library">Rust Library</A> and{' '}
          <A href="/native">Native API</A> sections.
        </p>
        <div class="callout callout--info">
          <p>
            Each enum has a fixed-width backing:{' '}
            <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> is <code>int32_t</code>;
            every other enum is <code>uint8_t</code>.
          </p>
          <p>
            On{' '}
            <a href="https://en.cppreference.com/w/c/language/enum" target="_blank" rel="noreferrer">C23</a>{' '}
            and <a href="https://en.cppreference.com/w/cpp/language/enum" target="_blank" rel="noreferrer">C++</a>{' '}
            the tag carries that underlying type directly (<code>enum MediusButton : uint8_t</code>); on{' '}
            <a href="https://en.cppreference.com/w/c/language/history" target="_blank" rel="noreferrer">C99</a>{' '}
            the tag is{' '}
            <a href="https://en.cppreference.com/w/c/language/typedef" target="_blank" rel="noreferrer"><code>typedef</code></a>'d
            to the integer and you pass the prefixed enumerators
            (<code>MEDIUS_BUTTON_LEFT</code>).
          </p>
          <p>
            Structs are plain PODs, nothing heap-allocated: pass by value, read fields directly, free
            nothing per value. Only the opaque handles have a{' '}
            <A href="/bindings/c/api"><code>*_free</code></A>.
          </p>
          <p>
            Anything variable-length on the wire lands in an inline fixed-cap array with a count beside
            it, never a pointer you own. The shapes on this page are ABI version <code>5</code>, the
            number <A href="/bindings/c/api#module"><code>medius_abi_version()</code></A> returns.
          </p>
        </div>
      </Card>

      <div id="capacities" data-search-target>
        <Card>
          <CardHeader title="Sizing constants" subtitle="Fixed-cap arrays sized to the wire limits" />
          <p>
            The event, lock, and log PODs embed fixed-cap arrays sized to the protocol's own limits,
            with a count field saying how many slots are live. <code>char</code> arrays are
            NUL-terminated.
          </p>
          <table class="api-params">
            <thead><tr><th>Macro</th><th>Value</th><th>Caps</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_MAX_USAGES</code></td><td><code>256</code></td><td><A href="/bindings/c/types#usage-event"><code>MediusUsageEvent.usages</code></A>, <A href="/bindings/c/types#clip-status"><code>MediusClipStatus.held</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_LOCKS</code></td><td><code>256</code></td><td><A href="/bindings/c/types#locks"><code>MediusLocks.entries</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_PATH</code></td><td><code>512</code></td><td><A href="/bindings/c/types#portinfo"><code>MediusPortInfo.path</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_LOG_TEXT</code></td><td><code>512</code></td><td><A href="/bindings/c/types#log-line"><code>MediusLogLine.text</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_PRODUCT</code></td><td><code>128</code></td><td><A href="/bindings/c/types#device-info"><code>MediusDeviceInfo.product</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_SERIAL</code></td><td><code>128</code></td><td><A href="/bindings/c/types#portinfo"><code>MediusPortInfo.serial</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_NAME</code></td><td><code>33</code></td><td><A href="/bindings/c/types#version"><code>MediusVersion.name</code></A></td></tr>
              <tr><td><code>MEDIUS_CLIP_TRIG_MAX</code></td><td><code>8</code></td><td><A href="/bindings/c/types#clip-settings"><code>MediusClipSettings.triggers</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_CATCH_ENTRIES</code></td><td><code>32</code></td><td><A href="/bindings/c/types#catch-state"><code>MediusCatchState.entries</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_TRAFFIC_BYTES</code></td><td><code>180</code></td><td><A href="/bindings/c/types#traffic-event"><code>MediusTrafficEvent.bytes</code></A></td></tr>
            </tbody>
          </table>
          <p>
            <code>MEDIUS_MAX_CATCH_ENTRIES</code> is the box's subscription table size, so a{' '}
            <A href="/bindings/c/types#catch-state"><code>MediusCatchState</code></A> always carries
            the whole live table.
          </p>
          <p>
            <code>MEDIUS_MAX_TRAFFIC_BYTES</code> is the largest payload one traffic event carries, so
            the inline array is never what truncates: a short <code>len</code> means the box cut the
            packet at your <code>capture</code>.
          </p>
        </Card>
      </div>

      <div id="enums" data-search-target>
        <Card>
          <CardHeader title="Enums" subtitle="uint8_t-backed selectors (MediusStatus is int32_t)" />
          <p>
            Each value is a wire byte; the canonical meaning lives on{' '}
            <A href="/library/types/enums">Enums</A>. The <code>*Kind</code> enums (and{' '}
            <A href="/bindings/c/types#input-kind"><code>MediusClass</code></A>) tag which arm of a
            built value (<A href="/bindings/c/types#input"><code>MediusUsage</code></A>,{' '}
            <A href="/bindings/c/types#motion"><code>MediusMotion</code></A>,{' '}
            <A href="/bindings/c/types#catch-event"><code>MediusCatchEvent</code></A>) is populated.
          </p>
        </Card>
      </div>

      <div id="device-kind" data-search-target>
        <Card>
          <CardHeader title="MediusDeviceKind" subtitle="The cloned device's primary kind" />
          <pre class="api-signature">{`enum MediusDeviceKind : uint8_t`}</pre>
          <p>
            The <code>kind</code> field of a{' '}
            <A href="/bindings/c/types#device-info"><code>MediusDeviceInfo</code></A>, from the cloned
            device's Boot-interface protocol. Also what{' '}
            <A href="/bindings/c/api#discovery"><code>medius_device_find_mouse_box</code></A> /{' '}
            <code>_find_keyboard_box</code> select on. See <A href="/library/types/enums#device-kind">DeviceKind</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_DEVICE_KIND_UNKNOWN</code></td><td><code>0</code></td><td>Neither a Boot keyboard nor mouse.</td></tr>
              <tr><td><code>MEDIUS_DEVICE_KIND_KEYBOARD</code></td><td><code>1</code></td><td>The device is a keyboard.</td></tr>
              <tr><td><code>MEDIUS_DEVICE_KIND_MOUSE</code></td><td><code>2</code></td><td>The device is a mouse.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="button" data-search-target>
        <Card>
          <CardHeader title="MediusButton" subtitle="A mouse button id" />
          <pre class="api-signature">{`enum MediusButton : uint8_t   /* values match the firmware button id */`}</pre>
          <p>
            The button an <A href="/library/inject">inject</A> call drives. Ids on{' '}
            <A href="/native/commands/usage#buttons">Usage IDs</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_BUTTON_LEFT</code></td><td><code>0</code></td><td>Left button.</td></tr>
              <tr><td><code>MEDIUS_BUTTON_RIGHT</code></td><td><code>1</code></td><td>Right button.</td></tr>
              <tr><td><code>MEDIUS_BUTTON_MIDDLE</code></td><td><code>2</code></td><td>Middle button.</td></tr>
              <tr><td><code>MEDIUS_BUTTON_SIDE1</code></td><td><code>3</code></td><td>First thumb button.</td></tr>
              <tr><td><code>MEDIUS_BUTTON_SIDE2</code></td><td><code>4</code></td><td>Second thumb button.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="axis" data-search-target>
        <Card>
          <CardHeader title="MediusAxis" subtitle="A relative axis id" />
          <pre class="api-signature">{`enum MediusAxis : uint8_t   /* values match the wire axis id */`}</pre>
          <p>
            The axis a{' '}
            <A href="/bindings/c/api#catch-filters"><code>medius_catch_filter_watch_axis</code></A>{' '}
            subscribes to: the same ids a <A href="/library/catch">catch</A> or{' '}
            <A href="/library/lock">lock</A> entry carries on the wire.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_AXIS_X</code></td><td><code>0</code></td><td>Horizontal cursor movement.</td></tr>
              <tr><td><code>MEDIUS_AXIS_Y</code></td><td><code>1</code></td><td>Vertical cursor movement.</td></tr>
              <tr><td><code>MEDIUS_AXIS_WHEEL</code></td><td><code>2</code></td><td>The scroll wheel.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="action" data-search-target>
        <Card>
          <CardHeader title="MediusAction" subtitle="The press / release tri-state" />
          <pre class="api-signature">{`enum MediusAction : uint8_t`}</pre>
          <p>
            The override action shared by <A href="/library/inject">inject</A> calls, whether a
            button, key, or media usage. See the{' '}
            <A href="/native/injection">injection model</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_ACTION_SOFT_RELEASE</code></td><td><code>0</code></td><td>Drop the <A href="/native/hardware">box</A>'s override, press or force; a physical hold stays down.</td></tr>
              <tr><td><code>MEDIUS_ACTION_PRESS</code></td><td><code>1</code></td><td>Force the input down.</td></tr>
              <tr><td><code>MEDIUS_ACTION_FORCE_RELEASE</code></td><td><code>2</code></td><td>Force the input up, masking a physical hold.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="input-kind" data-search-target>
        <Card>
          <CardHeader title="MediusClass" subtitle="Which arm of a MediusUsage is set" />
          <pre class="api-signature">{`enum MediusClass : uint8_t`}</pre>
          <p>
            The <code>kind</code> tag of a <A href="/bindings/c/types#input"><code>MediusUsage</code></A> you build with{' '}
            <A href="/bindings/c/api#builders"><code>medius_usage_button/_key/_media</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CLASS_BUTTON</code></td><td><code>0</code></td><td><code>id</code> is a mouse button id.</td></tr>
              <tr><td><code>MEDIUS_CLASS_KEY</code></td><td><code>1</code></td><td><code>id</code> is a HID keyboard usage.</td></tr>
              <tr><td><code>MEDIUS_CLASS_MEDIA</code></td><td><code>2</code></td><td><code>id</code> is a 16-bit Consumer usage.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="motion-kind" data-search-target>
        <Card>
          <CardHeader title="MediusMotionKind" subtitle="Which arm of a MediusMotion is set" />
          <pre class="api-signature">{`enum MediusMotionKind : uint8_t`}</pre>
          <p>
            Tags the <A href="/bindings/c/types#motion"><code>MediusMotion</code></A> you build with{' '}
            <A href="/bindings/c/api#builders"><code>medius_motion_cursor/_wheel</code></A>. See <A href="/library/move">Move</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_MOTION_KIND_CURSOR</code></td><td><code>0</code></td><td><code>dx</code>/<code>dy</code> apply.</td></tr>
              <tr><td><code>MEDIUS_MOTION_KIND_WHEEL</code></td><td><code>1</code></td><td><code>wheel</code> applies.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="lock-target-kind" data-search-target>
        <Card>
          <CardHeader title="MediusLockTargetKind" subtitle="Which input a MediusLockTarget addresses" />
          <pre class="api-signature">{`enum MediusLockTargetKind : uint8_t`}</pre>
          <p>
            The <code>kind</code> of a <A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A>.
            See <A href="/library/lock">Lock</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_LOCK_TARGET_KIND_X</code></td><td><code>0</code></td><td>Horizontal movement.</td></tr>
              <tr><td><code>MEDIUS_LOCK_TARGET_KIND_Y</code></td><td><code>1</code></td><td>Vertical movement.</td></tr>
              <tr><td><code>MEDIUS_LOCK_TARGET_KIND_WHEEL</code></td><td><code>2</code></td><td>Scroll wheel.</td></tr>
              <tr><td><code>MEDIUS_LOCK_TARGET_KIND_USAGE</code></td><td><code>3</code></td><td>A momentary usage (the struct's <code>usage</code> field selects which).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="direction" data-search-target>
        <Card>
          <CardHeader title="MediusDirection" subtitle="An axis sign, a usage edge, or a transfer direction" />
          <pre class="api-signature">{`enum MediusDirection : uint8_t`}</pre>
          <p>
            One enum with three readings, picked by what it is attached to: an axis sign, a usage
            edge, or the transfer direction on a{' '}
            <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A> naming a
            byte-oriented <A href="/bindings/c/types#catch-class">catch class</A>.
            See <A href="/native/commands/lock">LOCK</A> and <A href="/library/catch">Catch</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>On an axis or wheel</th><th>On a button or key</th><th>On a traffic-class filter</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_DIRECTION_BOTH</code></td><td><code>0</code></td><td>Both signs; on a scale, a full pass to the relative pair.</td><td>Press and release.</td><td>Both directions.</td></tr>
              <tr><td><code>MEDIUS_DIRECTION_POSITIVE</code></td><td><code>1</code></td><td>Positive (<code>+</code>).</td><td>The press edge.</td><td>IN, device to PC.</td></tr>
              <tr><td><code>MEDIUS_DIRECTION_NEGATIVE</code></td><td><code>2</code></td><td>Negative (<code>-</code>).</td><td>The release edge.</td><td>OUT, PC to device.</td></tr>
              <tr><td><code>MEDIUS_DIRECTION_WITH</code></td><td><code>3</code></td><td>The sign the box is injecting.</td><td>Refused.</td><td>No meaning.</td></tr>
              <tr><td><code>MEDIUS_DIRECTION_AGAINST</code></td><td><code>4</code></td><td>The sign opposing it.</td><td>Refused.</td><td>No meaning.</td></tr>
            </tbody>
          </table>
          <p>
            Only an axis has a bearing, so <code>WITH</code> or <code>AGAINST</code> on a lock
            anywhere else is <code>MEDIUS_STATUS_ERR_RELATIVE_DIRECTION</code>. A media usage has no
            edges: an edge named on one goes out as <code>MEDIUS_DIRECTION_BOTH</code>, which is what{' '}
            <A href="/bindings/c/types#locks"><code>MediusLocks</code></A> reports it as.
          </p>
          <div class="api-response-label">UNNAMED DIRECTION BYTES</div>
          <p>
            Parameters and struct fields carrying a direction are declared <code>uint8_t</code>, so a
            value outside the enum reaches the boundary rather than the wire.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Comes back as</th></tr></thead>
            <tbody>
              <tr><td>Any call returning a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A></td><td><code>MEDIUS_STATUS_ERR_INVALID_ARG</code>; no frame goes out.</td></tr>
              <tr><td><code>medius_locks_scale_of</code></td><td>It names no entry, so <code>MEDIUS_LOCK_SCALE_PASS</code>.</td></tr>
              <tr><td><code>medius_locks_is_locked</code></td><td>Unlocked, for the same reason.</td></tr>
              <tr><td><code>medius_catch_filter_with_direction</code></td><td>Stored, then refused at subscribe time, where there is a status to carry it.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="edge" data-search-target>
        <Card>
          <CardHeader title="MediusEdge" subtitle="Which edge of a trigger usage fires a clip binding" />
          <pre class="api-signature">{`enum MediusEdge : uint8_t`}</pre>
          <p>
            The edge of a <A href="/bindings/c/types#clip-trigger"><code>MediusClipTrigger</code></A>'s{' '}
            <code>on</code> usage that runs its action. Same wire values as{' '}
            <A href="/bindings/c/types#direction"><code>MediusDirection</code></A>. See <A href="/library/clip">Clip</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_EDGE_BOTH</code></td><td><code>0</code></td><td>Both press and release.</td></tr>
              <tr><td><code>MEDIUS_EDGE_PRESS</code></td><td><code>1</code></td><td>The press edge only.</td></tr>
              <tr><td><code>MEDIUS_EDGE_RELEASE</code></td><td><code>2</code></td><td>The release edge only.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="clip-action" data-search-target>
        <Card>
          <CardHeader title="MediusClipAction" subtitle="The engine action a clip trigger drives" />
          <pre class="api-signature">{`enum MediusClipAction : uint8_t`}</pre>
          <p>
            What a bound <A href="/bindings/c/types#clip-trigger"><code>MediusClipTrigger</code></A> does to
            the clip on its edge; the same verbs as the <A href="/bindings/c/api#clip"><code>medius_clip_start/_stop/...</code></A> calls. See <A href="/library/clip">Clip</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CLIP_ACTION_START</code></td><td><code>0</code></td><td>Rewind and play (resume from a pause).</td></tr>
              <tr><td><code>MEDIUS_CLIP_ACTION_STOP</code></td><td><code>1</code></td><td>Stop and release held input and the auto-lock.</td></tr>
              <tr><td><code>MEDIUS_CLIP_ACTION_PAUSE</code></td><td><code>2</code></td><td>Halt mid-clip, retaining the cursor and held input.</td></tr>
              <tr><td><code>MEDIUS_CLIP_ACTION_RESUME</code></td><td><code>3</code></td><td>Continue from the paused cursor.</td></tr>
              <tr><td><code>MEDIUS_CLIP_ACTION_RESTART</code></td><td><code>4</code></td><td>Force a rewind and play, even mid-playback.</td></tr>
              <tr><td><code>MEDIUS_CLIP_ACTION_TOGGLE</code></td><td><code>5</code></td><td>Play if idle/paused, stop if playing.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="blanket" data-search-target>
        <Card>
          <CardHeader title="MediusBlanket" subtitle="A whole-group lock selector" />
          <pre class="api-signature">{`enum MediusBlanket : uint8_t`}</pre>
          <p>A whole input group: which one <A href="/bindings/c/api#lock"><code>medius_device_lock_all/_unlock_all</code></A> block in one call, and the scope <A href="/bindings/c/api#clip"><code>medius_clip_set_autolock</code></A> auto-locks while a clip plays. See <A href="/library/lock">Lock</A>.</p>
          <p>The values are ABI-local ordinals (matching the crate's <A href="/library/types/enums#blanket"><code>Blanket</code></A> order), not the <code>CLIP_LOCK_*</code> wire bits.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th><th>What dir picks</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_BLANKET_AIM</code></td><td><code>0</code></td><td>The X and Y cursor axes.</td><td>A sign, on each axis.</td></tr>
              <tr><td><code>MEDIUS_BLANKET_WHEEL</code></td><td><code>1</code></td><td>The wheel.</td><td>A sign.</td></tr>
              <tr><td><code>MEDIUS_BLANKET_BUTTONS</code></td><td><code>2</code></td><td>Every mouse button.</td><td>An edge, on each button.</td></tr>
              <tr><td><code>MEDIUS_BLANKET_KEYS</code></td><td><code>3</code></td><td>Every keyboard key and modifier.</td><td>An edge: <code>POSITIVE</code> blocks presses, <code>NEGATIVE</code> releases, <code>BOTH</code> both.</td></tr>
              <tr><td><code>MEDIUS_BLANKET_MEDIA</code></td><td><code>4</code></td><td>Every media (Consumer) usage.</td><td>Nothing. Media has no edges.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="led-target" data-search-target>
        <Card>
          <CardHeader title="MediusLedTarget" subtitle="Which chip's status LED to drive" />
          <pre class="api-signature">{`enum MediusLedTarget : uint8_t`}</pre>
          <p>See <A href="/native/commands/led">LED</A>.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_LED_TARGET_DEVICE</code></td><td><code>0</code></td><td>The device chip's own LED.</td></tr>
              <tr><td><code>MEDIUS_LED_TARGET_HOST</code></td><td><code>1</code></td><td>The host chip's LED, relayed over the inter-chip link.</td></tr>
              <tr><td><code>MEDIUS_LED_TARGET_BOTH</code></td><td><code>2</code></td><td>Both LEDs at once.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="led-mode" data-search-target>
        <Card>
          <CardHeader title="MediusLedMode" subtitle="What to drive the LED to" />
          <pre class="api-signature">{`enum MediusLedMode : uint8_t`}</pre>
          <p>See <A href="/library/led">LED</A>. <code>Solid</code> / <code>Blink</code> use the command's <code>level</code>.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_LED_MODE_AUTO</code></td><td><code>0</code></td><td>Restore the chip's own status display.</td></tr>
              <tr><td><code>MEDIUS_LED_MODE_OFF</code></td><td><code>1</code></td><td>LED dark.</td></tr>
              <tr><td><code>MEDIUS_LED_MODE_SOLID</code></td><td><code>2</code></td><td>Lit steadily at <code>level</code>.</td></tr>
              <tr><td><code>MEDIUS_LED_MODE_BLINK</code></td><td><code>3</code></td><td>Blinks at <code>level</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="reboot-target" data-search-target>
        <Card>
          <CardHeader title="MediusRebootTarget" subtitle="Which chip to restart, and how" />
          <pre class="api-signature">{`enum MediusRebootTarget : uint8_t`}</pre>
          <p>See <A href="/native/commands/admin">Admin</A>.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_REBOOT_TARGET_DEVICE_DOWNLOAD</code></td><td><code>0</code></td><td>Device chip into ROM download mode (flash over the serial link).</td></tr>
              <tr><td><code>MEDIUS_REBOOT_TARGET_HOST_DOWNLOAD</code></td><td><code>1</code></td><td>Host chip into ROM download mode (flash over its own USB).</td></tr>
              <tr><td><code>MEDIUS_REBOOT_TARGET_DEVICE_RUN</code></td><td><code>2</code></td><td>Restart the device chip and run its firmware.</td></tr>
              <tr><td><code>MEDIUS_REBOOT_TARGET_HOST_RUN</code></td><td><code>3</code></td><td>Restart the host chip and run its firmware.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="emit-mode" data-search-target>
        <Card>
          <CardHeader title="MediusEmitMode" subtitle="What paces injected motion" />
          <pre class="api-signature">{`enum MediusEmitMode : uint8_t`}</pre>
          <p>See <A href="/library/options">Options</A>.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_EMIT_MODE_LEARNED</code></td><td><code>0</code></td><td>Pace to the mouse's learnt native report rate (the default).</td></tr>
              <tr><td><code>MEDIUS_EMIT_MODE_INTERVAL</code></td><td><code>1</code></td><td>Pace to the cloned mouse's declared poll rate (its bInterval).</td></tr>
              <tr><td><code>MEDIUS_EMIT_MODE_FIXED</code></td><td><code>2</code></td><td>Pace to a fixed rate in Hz (snapped to 1000/n, capped 1 kHz).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="catch-event-kind" data-search-target>
        <Card>
          <CardHeader title="MediusCatchEventKind" subtitle="Which arm of a MediusCatchEvent is set" />
          <pre class="api-signature">{`enum MediusCatchEventKind : uint8_t`}</pre>
          <p>
            Tells you which member of the <A href="/bindings/c/types#catch-event"><code>MediusCatchEvent</code></A>{' '}
            union to read. Which arms you can see follows from the{' '}
            <A href="/bindings/c/types#catch-class"><code>MediusCatchClass</code></A> values you
            subscribed to: the four input classes decode into <code>motion</code> and{' '}
            <code>usages</code>, every byte-oriented class into <code>traffic</code>. See{' '}
            <A href="/library/catch">Catch</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Read</th><th>Raised by</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_MOTION</code></td><td><code>0</code></td><td><code>data.motion</code></td><td><code>AXIS</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_USAGES</code></td><td><code>1</code></td><td><code>data.usages</code></td><td><code>BUTTON</code>, <code>KEY</code>, <code>MEDIA</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_TRAFFIC</code></td><td><code>2</code></td><td><code>data.traffic</code></td><td><code>HID_IN</code>, <code>HID_OUT</code>, <code>VENDOR_INTERRUPT</code>, <code>VENDOR_BULK</code>, <code>CONTROL</code>, <code>EMIT</code>, <code>BUS</code></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="clock-domain" data-search-target>
        <Card>
          <CardHeader title="MediusClockDomain" subtitle="Which chip's clock stamped an event" />
          <pre class="api-signature">{`enum MediusClockDomain : uint8_t`}</pre>
          <p>
            The <code>clock</code> field of a <A href="/bindings/c/types#catch-event"><code>MediusCatchEvent</code></A>,
            beside <code>ts_us</code>. Which domain an event carries is fixed by where it is tapped.
          </p>
          <p>
            The <A href="/native/hardware">box</A> is two ESP32-S3s that boot independently, so a stamp
            is only meaningful against other stamps from the <em>same</em> domain.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Stamped</th><th>Carries</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CLOCK_DOMAIN_HOST_CHIP</code></td><td><code>0</code></td><td>In USB interrupt context on the host chip, when the real device's transfer completed.</td><td>Motion and usage events, <code>HID_IN</code>, and the IN direction of <code>VENDOR_INTERRUPT</code> / <code>VENDOR_BULK</code>.</td></tr>
              <tr><td><code>MEDIUS_CLOCK_DOMAIN_DEVICE_CHIP</code></td><td><code>1</code></td><td>At the tap on the device chip, the side facing the game PC.</td><td><code>HID_OUT</code>, both OUT directions, <code>CONTROL</code>, <code>EMIT</code>, and <code>BUS</code>.</td></tr>
            </tbody>
          </table>
          <p>
            Both clocks are box-local and unrelated to any PC clock. Each is a <code>uint32_t</code>{' '}
            of microseconds: it wraps every ~71.6 minutes and returns to zero when that chip reboots.
          </p>
          <p>
            A stamp below the previous one is a wrap, a reboot, or a domain change.
          </p>
          <p>
            To put both on this machine's clock, feed events to a{' '}
            <A href="/bindings/c/streams#timeline"><code>MediusTimeline</code></A>. To relate the two
            box domains directly, read the estimate on{' '}
            <A href="/bindings/c/types#catch-state"><code>MediusCatchState</code></A>.
          </p>
        </Card>
      </div>

      <div id="input-event-kind" data-search-target>
        <Card>
          <CardHeader title="MediusInputKind" subtitle="Which arm of a MediusInputEvent is set" />
          <pre class="api-signature">{`enum MediusInputKind : uint8_t`}</pre>
          <p>
            Tags a <A href="/bindings/c/types#input-event"><code>MediusInputEvent</code></A> off the{' '}
            <A href="/bindings/c/streams#input">decoded-input stream</A>. The box sends held-usage
            snapshots; the stream diffs them into these edges.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Read</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_INPUT_KIND_PRESS</code></td><td><code>0</code></td><td><code>usage</code>: a momentary usage went down.</td></tr>
              <tr><td><code>MEDIUS_INPUT_KIND_RELEASE</code></td><td><code>1</code></td><td><code>usage</code>: a momentary usage came up.</td></tr>
              <tr><td><code>MEDIUS_INPUT_KIND_MOTION</code></td><td><code>2</code></td><td><code>dx</code> / <code>dy</code> / <code>dz</code>: one relative-motion report.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="log-level" data-search-target>
        <Card>
          <CardHeader title="MediusLogLevel" subtitle="Severity tag on a log line" />
          <pre class="api-signature">{`enum MediusLogLevel : uint8_t`}</pre>
          <p>The severity of a <A href="/bindings/c/types#log-line"><code>MediusLogLine</code></A>. See <A href="/library/diagnostics">Logs &amp; counters</A>.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_LOG_LEVEL_ERROR</code></td><td><code>0</code></td><td>A failure the box couldn't recover from.</td></tr>
              <tr><td><code>MEDIUS_LOG_LEVEL_WARN</code></td><td><code>1</code></td><td>Something off that the box handled.</td></tr>
              <tr><td><code>MEDIUS_LOG_LEVEL_INFO</code></td><td><code>2</code></td><td>Normal operational notices.</td></tr>
              <tr><td><code>MEDIUS_LOG_LEVEL_DEBUG</code></td><td><code>3</code></td><td>Detail for diagnosing a problem.</td></tr>
              <tr><td><code>MEDIUS_LOG_LEVEL_VERBOSE</code></td><td><code>4</code></td><td>The finest-grained trace output.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="catch-class" data-search-target>
        <Card>
          <CardHeader title="MediusCatchClass" subtitle="What a catch filter addresses" />
          <pre class="api-signature">{`typedef uint8_t MediusCatchClass;   /* one MEDIUS_CATCH_CLASS_* value */`}</pre>
          <p>
            The class half of a <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A>,
            and the <code>class_</code> field of both{' '}
            <A href="/bindings/c/types#traffic-event"><code>MediusTrafficEvent</code></A> and{' '}
            <A href="/bindings/c/types#catch-state"><code>MediusCatchEntry</code></A>.
          </p>
          <p>
            Classes <code>0</code> to{' '}
            <code>3</code> are the same vocabulary <A href="/library/lock">Lock</A> uses; the rest
            address the box's USB plumbing and surface as byte-oriented traffic. See{' '}
            <A href="/library/catch">Catch</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th><code>id</code> addresses</th><th>With <code>MEDIUS_CATCH_ID_ANY</code></th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_CLASS_BTN</code></td><td><code>0</code></td><td>A mouse button id.</td><td>Every button.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_KEY</code></td><td><code>1</code></td><td>A HID keyboard usage (modifiers are <code>0xE0</code> to <code>0xE7</code>).</td><td>Every key and modifier.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_MEDIA</code></td><td><code>2</code></td><td>A 16-bit Consumer usage.</td><td>Every media usage.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_AXIS</code></td><td><code>3</code></td><td>A <A href="/bindings/c/types#axis"><code>MediusAxis</code></A>: X, Y, or the wheel.</td><td>Every axis.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_HID_IN</code></td><td><code>4</code></td><td>A cloned HID interface number.</td><td>Every HID interface.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_HID_OUT</code></td><td><code>5</code></td><td>An interrupt-OUT endpoint address.</td><td>Every interrupt-OUT endpoint.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_VENDOR_INTERRUPT</code></td><td><code>6</code></td><td>A vendor interrupt endpoint address.</td><td>Every vendor interrupt endpoint.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_VENDOR_BULK</code></td><td><code>7</code></td><td>A vendor bulk endpoint address.</td><td>Every vendor bulk endpoint.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_CONTROL</code></td><td><code>8</code></td><td>A control endpoint number (<code>0</code> is EP0).</td><td>Every control endpoint.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_EMIT</code></td><td><code>9</code></td><td>An emitting endpoint address.</td><td>Every emitting endpoint.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_BUS</code></td><td><code>10</code></td><td>Nothing; pass <code>MEDIUS_CATCH_ID_ANY</code>.</td><td>Every bus event.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_ANY</code></td><td><code>0xFF</code></td><td>Nothing; must be <code>MEDIUS_CATCH_ID_ANY</code>.</td><td>Every class at once.</td></tr>
            </tbody>
          </table>
          <p>
            Test one with{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_catch_class_is_input</code></A> (the four
            parsed classes, which arrive decoded and carry no packet) or{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_catch_class_is_traffic</code></A> (the
            seven byte-oriented ones).
          </p>
          <div class="api-response-label">WHERE EACH CLASS IS TAPPED</div>
          <p>
            The four input classes are captured at the emission merge point <strong>before</strong>{' '}
            lock suppression and before injection, so a locked input still reports.
          </p>
          <p>
            <code>MEDIUS_CATCH_CLASS_EMIT</code> is the mirror image: what the clone put on the wire{' '}
            <em>after</em> injection, locks, and the suppression gate.
          </p>
        </Card>
      </div>

      <div id="catch-filter" data-search-target>
        <Card>
          <CardHeader title="MediusCatchFilter" subtitle="One subscription entry: class, id, direction, capture" />
          <pre class="api-signature">{`struct MediusCatchFilter {
    MediusCatchClass class_;      /* MEDIUS_CATCH_CLASS_*                   */
    uint16_t         id;          /* class-specific, or MEDIUS_CATCH_ID_ANY */
    uint8_t          direction;   /* MEDIUS_DIRECTION_*: edge, sign, or flow */
    uint8_t          capture;     /* 0 = whole packet; traffic classes only */
};`}</pre>
          <p>
            The array you hand to{' '}
            <A href="/bindings/c/api#streams"><code>medius_device_catch_events</code></A> or{' '}
            <A href="/bindings/c/api#streams"><code>medius_device_input_events</code></A>. Build each
            one with a <A href="/bindings/c/api#catch-filters"><code>medius_catch_filter_*</code></A>{' '}
            helper, then narrow it with a modifier.
          </p>
          <p>
            Each element becomes one entry in the box's table; read the accepted set back with{' '}
            <A href="/bindings/c/api#queries"><code>medius_device_query_catch</code></A>. The field is
            spelled <code>class_</code> because <code>class</code> is a C++ keyword and the header
            compiles as both.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class_</code></td><td><A href="/bindings/c/types#catch-class"><code>MediusCatchClass</code></A></td><td>Which address space this entry subscribes in.</td></tr>
              <tr><td><code>id</code></td><td><code>uint16_t</code></td><td>The id inside that class, or <code>MEDIUS_CATCH_ID_ANY</code> for every id in it.</td></tr>
              <tr><td><code>direction</code></td><td><code>uint8_t</code>, a <A href="/bindings/c/types#direction"><code>MEDIUS_DIRECTION_*</code></A> value</td><td>For an input class, the press/release edge exactly as for a lock. For a traffic class, the transfer direction: <code>POSITIVE</code> is IN (device to PC), <code>NEGATIVE</code> is OUT (PC to device). No class is both, so one byte carries either reading unambiguously.</td></tr>
              <tr><td><code>capture</code></td><td><code>uint8_t</code></td><td>Bytes kept per event; <code>0</code> keeps the whole packet. Traffic classes only: an input class carries no packet, and a non-zero <code>capture</code> on one is refused with <code>MEDIUS_STATUS_ERR_CAPTURE_NOT_APPLICABLE</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SENTINELS AND CAPACITY</div>
          <table class="api-params">
            <thead><tr><th>Macro</th><th>Value</th><th>Means</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_ID_ANY</code></td><td><code>65535</code></td><td>Every id in the class. A blanket is one table entry, not an expansion into per-id entries, matching how a blanket <A href="/library/lock">lock</A> works.</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_ANY</code></td><td><code>255</code></td><td>Every class. A real <code>id</code> beside it addresses nothing and is refused.</td></tr>
              <tr><td><code>MEDIUS_MAX_CATCH_ENTRIES</code></td><td><code>32</code></td><td>Entries the box's table holds. Ask for more and the call fails with <code>MEDIUS_STATUS_ERR_CATCH_TABLE_FULL</code>.</td></tr>
            </tbody>
          </table>
          <p>
            The useful capture length differs between classes by orders of magnitude. A 64-byte vendor
            interrupt report is worth having whole; a bulk pipe traced only for framing is worth 16
            bytes. So it lives on the entry that matched, not box-wide.
          </p>
          <p>
            Matching is most-specific-first, and the winning entry is the one whose{' '}
            <code>capture</code> applies. That is what makes "everything at 16 bytes, except endpoint{' '}
            <code>0x83</code> in full" two entries rather than an impossibility.
          </p>
          <pre class="diagram">{`  a report arrives on VENDOR_INTERRUPT endpoint 0x83
          │
          ├─ exact   { class_ = VENDOR_INTERRUPT, id = 0x0083 }  ──▶ resolves first
          ├─ blanket { class_ = VENDOR_INTERRUPT, id = ID_ANY }  ──▶ used if no exact entry
          └─ any     { class_ = ANY,              id = ID_ANY }  ──▶ used if neither matched
                     ties inside one tier go to the earlier entry in your array`}</pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-c">{`/* everything the box can see, first 16 bytes only */
MediusCatchFilter blanket =
    medius_catch_filter_with_capture(medius_catch_filter_everything(), 16);

/* except this endpoint's IN traffic, which we want whole */
MediusCatchFilter whole = medius_catch_filter_inbound(
    medius_catch_filter_traffic(MEDIUS_CATCH_CLASS_VENDOR_INTERRUPT, 0x83));

MediusCatchFilter filters[2] = { blanket, whole };
MediusEventStream *events = NULL;
medius_device_catch_events(dev, filters, 2, &events);`}</code></pre>
          <p>
            A malformed entry now fails the whole call with its own{' '}
            <A href="/bindings/c/types#errors"><code>MediusStatus</code></A>, rather than being dropped
            with no status. Two filters naming the same table entry, whatever their captures, are what{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_catch_filter_same_address</code></A> tests.
          </p>
        </Card>
      </div>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="MediusKey" subtitle="A HID keyboard/keypad usage" />
          <pre class="api-signature">{`typedef uint8_t MediusKey;   /* modifiers are 0xE0 to 0xE7 */`}</pre>
          <p>
            A raw{' '}
            <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID keyboard usage</a>{' '}
            passed to the <A href="/library/inject">key</A> calls. Pass any usage byte, or one of the{' '}
            <code>MEDIUS_KEY_*</code> macros. The full set of usages is on{' '}
            <A href="/native/commands/usage#keycodes">Usage IDs</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Macro group</th><th>Example</th><th>Usage</th></tr></thead>
            <tbody>
              <tr><td>Letters</td><td><code>MEDIUS_KEY_A</code> .. <code>MEDIUS_KEY_Z</code></td><td><code>4</code> to <code>29</code></td></tr>
              <tr><td>Digits</td><td><code>MEDIUS_KEY_1</code> .. <code>MEDIUS_KEY_0</code></td><td><code>30</code> to <code>39</code></td></tr>
              <tr><td>Function</td><td><code>MEDIUS_KEY_F1</code> .. <code>MEDIUS_KEY_F12</code></td><td><code>58</code> to <code>69</code></td></tr>
              <tr><td>Editing / nav</td><td><code>MEDIUS_KEY_ENTER</code>, <code>_ESCAPE</code>, <code>_TAB</code>, <code>_SPACE</code>, <code>_INSERT</code>, <code>_HOME</code>, <code>_DELETE</code>, arrows</td><td>various</td></tr>
              <tr><td>Modifiers</td><td><code>MEDIUS_KEY_LEFT_CTRL</code> .. <code>MEDIUS_KEY_RIGHT_GUI</code></td><td><code>224</code> to <code>231</code> (<code>0xE0</code> to <code>0xE7</code>)</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="media-key" data-search-target>
        <Card>
          <CardHeader title="MediusMediaKey" subtitle="A 16-bit HID Consumer usage" />
          <pre class="api-signature">{`typedef uint16_t MediusMediaKey;`}</pre>
          <p>
            A raw Consumer usage passed to the <A href="/library/inject">media</A> calls. Pass any
            16-bit usage, or a <code>MEDIUS_MEDIA_*</code> macro. The full set is on{' '}
            <A href="/native/commands/usage#consumer">Usage IDs</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Macro</th><th>Usage</th><th>Macro</th><th>Usage</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_MEDIA_PLAY_PAUSE</code></td><td><code>205</code></td><td><code>MEDIUS_MEDIA_MUTE</code></td><td><code>226</code></td></tr>
              <tr><td><code>MEDIUS_MEDIA_NEXT_TRACK</code></td><td><code>181</code></td><td><code>MEDIUS_MEDIA_VOLUME_UP</code></td><td><code>233</code></td></tr>
              <tr><td><code>MEDIUS_MEDIA_PREV_TRACK</code></td><td><code>182</code></td><td><code>MEDIUS_MEDIA_VOLUME_DOWN</code></td><td><code>234</code></td></tr>
              <tr><td><code>MEDIUS_MEDIA_STOP</code></td><td><code>183</code></td><td><code>MEDIUS_MEDIA_PLAY</code></td><td><code>176</code></td></tr>
              <tr><td><code>MEDIUS_MEDIA_PAUSE</code></td><td><code>177</code></td><td></td><td></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="frame-type" data-search-target>
        <Card>
          <CardHeader title="MediusFrameType" subtitle="A wire frame TYPE byte (mock only)" />
          <pre class="api-signature">{`enum MediusFrameType : uint8_t   /* always defined; read only by the mock recorder */`}</pre>
          <p>
            The TYPE byte of a wire <A href="/native/frame">frame</A>, used with the mock recorder
            (<A href="/bindings/c/api#mock"><code>medius_mock_saw</code></A> / <A href="/bindings/c/api#mock"><code>medius_mock_recorded_frame</code></A>). See the{' '}
            <A href="/library/features/mock">mock feature</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Enumerator</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_FRAME_TYPE_MOVE</code></td><td><code>1</code></td><td><code>MEDIUS_FRAME_TYPE_LOCK</code></td><td><code>10</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_INJECT</code></td><td><code>3</code></td><td><code>MEDIUS_FRAME_TYPE_CATCH</code></td><td><code>11</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_RESET</code></td><td><code>4</code></td><td><code>MEDIUS_FRAME_TYPE_MOTION_EVENT</code></td><td><code>12</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_QUERY</code></td><td><code>5</code></td><td><code>MEDIUS_FRAME_TYPE_USAGE_EVENT</code></td><td><code>15</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_RESP</code></td><td><code>6</code></td><td><code>MEDIUS_FRAME_TYPE_OPTION</code></td><td><code>17</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_REBOOT_DL</code></td><td><code>7</code></td><td><code>MEDIUS_FRAME_TYPE_CLIP_APPEND</code></td><td><code>18</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_LOG</code></td><td><code>8</code></td><td><code>MEDIUS_FRAME_TYPE_CLIP_CTRL</code></td><td><code>19</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_LED</code></td><td><code>9</code></td><td><code>MEDIUS_FRAME_TYPE_CLIP_SET</code></td><td><code>20</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_TRAFFIC_EVENT</code></td><td><code>22</code></td><td><code>MEDIUS_FRAME_TYPE_CLIP_TRIGGER</code></td><td><code>21</code></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="arguments" data-search-target>
        <Card>
          <CardHeader title="Argument structs" subtitle="Tagged values you build, then pass in" />
          <p>
            Three small PODs you build with a helper and hand to a call. The <code>medius_*_*</code>{' '}
            constructors set the <code>kind</code> tag and the right field for you.
          </p>
        </Card>
      </div>

      <div id="input" data-search-target>
        <Card>
          <CardHeader title="MediusUsage" subtitle="A momentary usage for inject" />
          <p>
            What <A href="/bindings/c/api#inject"><code>medius_device_inject</code></A> drives. Build with{' '}
            <A href="/bindings/c/api#builders"><code>medius_usage_button(...)</code></A>, <code>_key(...)</code>, or <code>_media(...)</code>;{' '}
            <code>id</code> holds the button id or usage per <A href="/bindings/c/types#input-kind"><code>kind</code></A>.
            See <A href="/library/inject">Inject</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#input-kind"><code>MediusClass</code></A></td><td>Which class <code>id</code> names.</td></tr>
              <tr><td><code>id</code></td><td><code>uint16_t</code></td><td>Button id, key usage, or media usage.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="move-timing" data-search-target>
        <Card>
          <CardHeader title="MediusMoveTiming" subtitle="When a move reaches the game PC" />
          <pre class="api-signature">{`enum MediusMoveTiming : uint8_t`}</pre>
          <p>
            The <code>timing</code> argument of <A href="/bindings/c/api#move"><code>medius_device_move_axis</code></A>,
            against <A href="/library/options#set-movement-riding">movement riding</A>. See <A href="/library/move">Move</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_MOVE_TIMING_RIDE</code></td><td><code>0</code></td><td>Wait for a real cursor move to carry the delta.</td></tr>
              <tr><td><code>MEDIUS_MOVE_TIMING_NOW</code></td><td><code>1</code></td><td>Emit on the box's own clock.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="pending-motion" data-search-target>
        <Card>
          <CardHeader title="MediusPendingMotion" subtitle="What a move does to held motion" />
          <pre class="api-signature">{`enum MediusPendingMotion : uint8_t`}</pre>
          <p>
            The <code>pending</code> argument of <A href="/bindings/c/api#move"><code>medius_device_move_axis</code></A>.
            See <A href="/library/move">Move</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_PENDING_MOTION_KEEP</code></td><td><code>0</code></td><td>Leave motion held for a ride alone.</td></tr>
              <tr><td><code>MEDIUS_PENDING_MOTION_FLUSH</code></td><td><code>1</code></td><td>Emit it now, ignoring the ride window.</td></tr>
              <tr><td><code>MEDIUS_PENDING_MOTION_DISCARD</code></td><td><code>2</code></td><td>Drop it.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="motion" data-search-target>
        <Card>
          <CardHeader title="MediusMotion" subtitle="A relative axis for move_axis" />
          <p>
            What <A href="/bindings/c/api#move"><code>medius_device_move_axis</code></A> drives. Build with{' '}
            <A href="/bindings/c/api#builders"><code>medius_motion_cursor(dx, dy)</code></A> or <code>medius_motion_wheel(delta)</code>. See{' '}
            <A href="/library/move">Move</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#motion-kind"><code>MediusMotionKind</code></A></td><td>Cursor vs wheel.</td></tr>
              <tr><td><code>dx</code></td><td><code>int16_t</code></td><td>X movement (Cursor only).</td></tr>
              <tr><td><code>dy</code></td><td><code>int16_t</code></td><td>Y movement (Cursor only).</td></tr>
              <tr><td><code>wheel</code></td><td><code>int16_t</code></td><td>Scroll delta (Wheel only).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="lock-target" data-search-target>
        <Card>
          <CardHeader title="MediusLockTarget" subtitle="What a lock acts on" />
          <p>
            Passed to <A href="/bindings/c/api#lock"><code>medius_device_lock</code></A> / <code>_unlock</code>. Build it with{' '}
            <A href="/bindings/c/api#builders"><code>medius_lock_target_axis</code></A> or <code>medius_lock_target_usage</code>;{' '}
            <code>usage</code> is read only when <code>kind</code> is <code>USAGE</code>. See <A href="/library/lock">Lock</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#lock-target-kind"><code>MediusLockTargetKind</code></A></td><td>X, Y, Wheel, or Usage.</td></tr>
              <tr><td><code>usage</code></td><td><A href="/bindings/c/types#input"><code>MediusUsage</code></A></td><td>The button, key, or media usage, when <code>kind == USAGE</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="values" data-search-target>
        <Card>
          <CardHeader title="Query values" subtitle="PODs written through a query's out-param" />
          <p>
            Each <A href="/bindings/c/api#queries"><code>medius_device_query_*</code></A> / <code>_caps</code> / <code>_counters</code> call
            fills one of these by value. Canonical field docs are on{' '}
            <A href="/library/types/structs">Structs</A>; query semantics on{' '}
            <A href="/native/commands/requests#requests">Requests</A>.
          </p>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="MediusVersion" subtitle="Decoded firmware version and box name" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_version</code></A>. Set the box's <code>name</code> with <A href="/bindings/c/api#led-admin-options"><code>medius_device_set_name</code></A>.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>proto_ver</code></td><td><code>uint8_t</code></td><td>Wire-protocol version the firmware speaks.</td></tr>
              <tr><td><code>fw_major</code></td><td><code>uint8_t</code></td><td>Firmware major version.</td></tr>
              <tr><td><code>fw_minor</code></td><td><code>uint8_t</code></td><td>Firmware minor version.</td></tr>
              <tr><td><code>fw_patch</code></td><td><code>uint8_t</code></td><td>Firmware patch version.</td></tr>
              <tr><td><code>mac</code></td><td><code>uint8_t[6]</code></td><td>The device chip's base MAC, a stable per-box id.</td></tr>
              <tr><td><code>name</code></td><td><code>char[MEDIUS_MAX_NAME]</code></td><td>The box's human-readable name (NUL-terminated; a synthesized default when unset).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="MediusHealth" subtitle="Box readiness flags (each 0 or 1)" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_health</code></A>.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>True (1) when</th></tr></thead>
            <tbody>
              <tr><td><code>link_up</code></td><td><code>uint8_t</code></td><td>The link to the host chip is up.</td></tr>
              <tr><td><code>mouse_attached</code></td><td><code>uint8_t</code></td><td>A real mouse is plugged in.</td></tr>
              <tr><td><code>clone_configured</code></td><td><code>uint8_t</code></td><td>The PC has set up the cloned mouse.</td></tr>
              <tr><td><code>injection_active</code></td><td><code>uint8_t</code></td><td>At least one injected button or move is held.</td></tr>
              <tr><td><code>rate_confident</code></td><td><code>uint8_t</code></td><td>The native-rate estimator window is full.</td></tr>
              <tr><td><code>lock_on</code></td><td><code>uint8_t</code></td><td>At least one input is off a full pass: blocked, or merely weighed.</td></tr>
              <tr><td><code>catch_on</code></td><td><code>uint8_t</code></td><td>A catch subscription is streaming.</td></tr>
              <tr><td><code>kbd_attached</code></td><td><code>uint8_t</code></td><td>A keyboard is attached, cloned, and injectable.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="device-info" data-search-target>
        <Card>
          <CardHeader title="MediusDeviceInfo" subtitle="The cloned device's USB identity, kind, and product" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_device_info</code></A>; all-zero/empty when nothing is cloned. <code>product</code> is a NUL-terminated UTF-8 string.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>vid</code></td><td><code>uint16_t</code></td><td>USB vendor id (idVendor).</td></tr>
              <tr><td><code>pid</code></td><td><code>uint16_t</code></td><td>USB product id (idProduct).</td></tr>
              <tr><td><code>bcd_device</code></td><td><code>uint16_t</code></td><td>Device release (bcdDevice).</td></tr>
              <tr><td><code>bcd_usb</code></td><td><code>uint16_t</code></td><td>USB version (bcdUSB), e.g. <code>0x0200</code>.</td></tr>
              <tr><td><code>has_serial</code></td><td><code>uint8_t</code></td><td>The clone serves a serial string.</td></tr>
              <tr><td><code>has_bos</code></td><td><code>uint8_t</code></td><td>The clone serves a BOS descriptor.</td></tr>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#device-kind"><code>MediusDeviceKind</code></A></td><td>The device's primary kind (Boot-interface protocol).</td></tr>
              <tr><td><code>product</code></td><td><code>char[MEDIUS_MAX_PRODUCT]</code></td><td>The product string (NUL-terminated; empty when none).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="caps" data-search-target>
        <Card>
          <CardHeader title="MediusCaps" subtitle="The whole cloned device's capabilities" />
          <p>
            From <A href="/bindings/c/api#queries"><code>medius_device_caps</code></A>: a mouse half and a keyboard half plus the per-class
            change-driven flags. Test it with <A href="/bindings/c/api#inspectors"><code>medius_caps_has_mouse</code></A>,{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_caps_has_keyboard</code></A>, <A href="/bindings/c/api#inspectors"><code>medius_caps_is_composite</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mouse</code></td><td><A href="/bindings/c/types#mouse-caps"><code>MediusMouseCaps</code></A></td><td>The mouse half (all-zero when no mouse is bound).</td></tr>
              <tr><td><code>keyboard</code></td><td><A href="/bindings/c/types#kbd-caps"><code>MediusKbdCaps</code></A></td><td>The keyboard half (all-zero when no keyboard is bound).</td></tr>
              <tr><td><code>mouse_change_driven</code></td><td><code>uint8_t</code></td><td>Always 0: mouse motion is continuous, so it has a learned cadence.</td></tr>
              <tr><td><code>kbd_change_driven</code></td><td><code>uint8_t</code></td><td>1 when a keyboard is bound: it reports only on a key change.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="mouse-caps" data-search-target>
        <Card>
          <CardHeader title="MediusMouseCaps" subtitle="What the cloned mouse can do" />
          <p>The mouse half of <A href="/bindings/c/types#caps"><code>MediusCaps</code></A>; all-zero when no mouse interface is bound.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>n_buttons</code></td><td><code>uint8_t</code></td><td>Buttons the mouse report carries.</td></tr>
              <tr><td><code>has_x</code></td><td><code>uint8_t</code></td><td>The report carries an X axis.</td></tr>
              <tr><td><code>has_y</code></td><td><code>uint8_t</code></td><td>The report carries a Y axis.</td></tr>
              <tr><td><code>has_wheel</code></td><td><code>uint8_t</code></td><td>The report carries a wheel.</td></tr>
              <tr><td><code>has_report_id</code></td><td><code>uint8_t</code></td><td>The mouse report sits behind a HID report ID.</td></tr>
              <tr><td><code>n_hid</code></td><td><code>uint8_t</code></td><td>Cloned HID interfaces; <code>&gt;1</code> = composite.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="kbd-caps" data-search-target>
        <Card>
          <CardHeader title="MediusKbdCaps" subtitle="What the cloned keyboard can do" />
          <p>
            The keyboard half of <A href="/bindings/c/types#caps"><code>MediusCaps</code></A>; all-zero
            when no keyboard is bound. <code>n_keys == 0xFF</code> signals an NKRO bitmap.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>n_keys</code></td><td><code>uint8_t</code></td><td>Keycode-array slots, or <code>0xFF</code> for an NKRO bitmap.</td></tr>
              <tr><td><code>nkro</code></td><td><code>uint8_t</code></td><td>The keyboard reports an NKRO bitmap.</td></tr>
              <tr><td><code>has_consumer</code></td><td><code>uint8_t</code></td><td>A Consumer collection is present (media injectable).</td></tr>
              <tr><td><code>has_system</code></td><td><code>uint8_t</code></td><td>A system-control collection is present (passthrough-only).</td></tr>
              <tr><td><code>has_report_id</code></td><td><code>uint8_t</code></td><td>The keyboard report sits behind a HID report ID.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="rate" data-search-target>
        <Card>
          <CardHeader title="MediusRate" subtitle="The native report rate and clone poll period" />
          <p>
            From <A href="/bindings/c/api#queries"><code>medius_device_query_rate</code></A>. Convert to Hz with{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_rate_native_hz(rate, &amp;hz)</code></A> (returns false when there's no
            continuous cadence).
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>native_period_us</code></td><td><code>uint16_t</code></td><td>Realised native period in µs; <code>0</code> = not learned, or change-driven.</td></tr>
              <tr><td><code>poll_period_us</code></td><td><code>uint16_t</code></td><td>Cloned inject-endpoint poll period in µs.</td></tr>
              <tr><td><code>confident</code></td><td><code>uint8_t</code></td><td>The estimator window is full and the value is trustworthy.</td></tr>
              <tr><td><code>change_driven</code></td><td><code>uint8_t</code></td><td>The active input is event-driven (keyboard/media), so no continuous cadence.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="stats" data-search-target>
        <Card>
          <CardHeader title="MediusStats" subtitle="Box-side delivery / telemetry counters" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_stats</code></A>. A nonzero <code>tx_drops</code> or <code>tx_wedges</code> means delivery degraded under load.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>inject_emits</code></td><td><code>uint32_t</code></td><td>Pure-injection reports emitted.</td></tr>
              <tr><td><code>tx_drops</code></td><td><code>uint16_t</code></td><td>Reports dropped on TX-queue overflow (should stay 0).</td></tr>
              <tr><td><code>tx_merges</code></td><td><code>uint16_t</code></td><td>Backed-up reports merged instead of queued.</td></tr>
              <tr><td><code>tx_maxdepth</code></td><td><code>uint8_t</code></td><td>Deepest the TX queue has reached.</td></tr>
              <tr><td><code>tx_wedges</code></td><td><code>uint8_t</code></td><td>Wedged-endpoint recoveries.</td></tr>
              <tr><td><code>wakeups</code></td><td><code>uint16_t</code></td><td>Remote-wakeups issued.</td></tr>
              <tr><td><code>reset_count</code></td><td><code>uint16_t</code></td><td>USB bus resets seen.</td></tr>
              <tr><td><code>config_count</code></td><td><code>uint16_t</code></td><td>SET_CONFIGURATION events (re-enumerations).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="locks" data-search-target>
        <Card>
          <CardHeader title="MediusLocks & MediusLockEntry" subtitle="The active scales, as an entry list" />
          <p>
            From <A href="/bindings/c/api#queries"><code>medius_device_query_locks</code></A>: <code>entries[0..n]</code>, one per weighed direction. Read one with{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_locks_scale_of(&amp;locks, target, dir)</code></A>, or ask whether it is blocked outright with <code>medius_locks_is_locked</code>; both count a covering whole-class <code>is_blanket</code> entry. Wire layout on the native{' '}
            <A href="/native/commands/requests#requests">LOCKS</A> reply.
          </p>
          <table class="api-params">
            <thead><tr><th>Asked with <code>MEDIUS_DIRECTION_BOTH</code></th><th>Answers about</th></tr></thead>
            <tbody>
              <tr><td><code>medius_locks_scale_of</code></td><td>The lowest scale across every direction, relative pair included. Not the figure a delta meets: a delta picks up one from each pair, multiplied.</td></tr>
              <tr><td><code>medius_locks_is_locked</code></td><td>The two fixed signs only. Name <code>_WITH</code> or <code>_AGAINST</code> to ask about one of those.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>n</code></td><td><code>uint16_t</code></td><td>Live entries in <code>entries</code>.</td></tr>
              <tr><td><code>entries</code></td><td><code>MediusLockEntry[MEDIUS_MAX_LOCKS]</code></td><td>One per weighed direction of an axis or usage.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SCALE CONSTANTS</div>
          <table class="api-params">
            <thead><tr><th>Macro</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_LOCK_SCALE_BLOCK</code></td><td><code>0</code></td><td>Keep none of the physical value.</td></tr>
              <tr><td><code>MEDIUS_LOCK_SCALE_PASS</code></td><td><code>100</code></td><td>Keep all of it, untouched.</td></tr>
              <tr><td><code>MEDIUS_LOCK_SCALE_MAX</code></td><td><code>255</code></td><td>2.55x, the ceiling.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MEDIUSLOCKENTRY</div>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A></td><td>The weighed axis or usage.</td></tr>
              <tr><td><code>is_blanket</code></td><td><code>bool</code></td><td>The entry covers a whole class; <code>target.usage.kind</code> names it and <code>target.usage.id</code> is unused.</td></tr>
              <tr><td><code>direction</code></td><td><code>uint8_t</code>, a <A href="/bindings/c/types#direction"><code>MEDIUS_DIRECTION_*</code></A> value</td><td>Which direction of the target this entry weighs.</td></tr>
              <tr><td><code>scale</code></td><td><code>uint8_t</code></td><td>Percent of the physical value kept; <code>0</code> is blocked. A momentary usage carries one bit, so the box stores the block or pass it renders and this never reads between them.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">READBACK</div>
          <table class="api-params">
            <thead><tr><th>Case</th><th>What the array holds</th></tr></thead>
            <tbody>
              <tr><td>A blanket key lock</td><td>One entry per blocked edge, never <code>MEDIUS_DIRECTION_BOTH</code>.</td></tr>
              <tr><td>A media lock, blanket or specific</td><td><code>MEDIUS_DIRECTION_BOTH</code>, always.</td></tr>
              <tr><td>A relative direction under <code>MEDIUS_BEARING_MODE_VECTOR</code></td><td>The effective scale, the lower of X's and Y's, on both axes.</td></tr>
              <tr><td>The wire cap</td><td>One reply carries 96 entries, well under <code>MEDIUS_MAX_LOCKS</code>; past that the rest is absent, with nothing marking it. See the native <A href="/native/commands/requests#locks">LOCKS</A> budget.</td></tr>
              <tr><td>A <code>direction</code> byte no constant names</td><td>The entry is dropped rather than trusted, and <code>n</code> moves with the drop.</td></tr>
            </tbody>
          </table>

        </Card>
      </div>

      <div id="bearing" data-search-target>
        <Card>
          <CardHeader title="MediusBearing & MediusBearingMode" subtitle="What WITH and AGAINST are measured against" />
          <pre class="api-signature">{`struct MediusBearing {
    uint16_t          window_ms;  /* 0 = off */
    MediusBearingMode mode;
};`}</pre>
          <p>
            From <A href="/bindings/c/api#queries"><code>medius_device_query_bearing</code></A>, set
            with <code>medius_device_set_bearing</code>. See the native{' '}
            <A href="/native/commands/lock#bearing">bearing</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>window_ms</code></td><td><code>uint16_t</code></td><td>How long an axis holds the direction of its last injected delta. <code>0</code> is off, leaving <code>WITH</code> and <code>AGAINST</code> inert whatever their scale.</td></tr>
              <tr><td><code>mode</code></td><td><code>MediusBearingMode</code></td><td>How the bearing is read; see below.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MEDIUSBEARINGMODE</div>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_BEARING_MODE_PER_AXIS</code></td><td><code>0</code></td><td>Each axis compares its own sign against its own bearing, independently. The default.</td></tr>
              <tr><td><code>MEDIUS_BEARING_MODE_VECTOR</code></td><td><code>1</code></td><td>The delta is projected onto the injected XY vector, and the relative scale weighs only the part along it. The fixed-sign scales still reach what the projection leaves on each axis. One relative scale, the lower of X's and Y's, governs the whole aim; what <A href="/bindings/c/types#locks"><code>MediusLocks</code></A> reports back is there.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONSTANT</div>
          <table class="api-params">
            <thead><tr><th>Macro</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_BEARING_WINDOW_DEFAULT_MS</code></td><td><code>20</code></td><td>The factory window. A box that has been set boots at its own value.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="catch-state" data-search-target>
        <Card>
          <CardHeader title="MediusCatchState & MediusCatchEntry" subtitle="The live subscription table, plus the inter-chip clock estimate" />
          <p>
            From <A href="/bindings/c/api#queries"><code>medius_device_query_catch</code></A>: a header
            followed by <code>entries[0..n]</code>, one per accepted{' '}
            <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A>. The array is
            inline and capped at <A href="/bindings/c/types#capacities"><code>MEDIUS_MAX_CATCH_ENTRIES</code></A>{' '}
            (32), the box's own table size, so the reply always carries the whole table.
          </p>
          <p>
            The order is the order the box accepted them in, not the order it matches in: matching is
            worked out per event, most-specific-first, with ties going to the earlier entry.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>table_full</code></td><td><code>uint8_t</code></td><td>1 when an entry was refused because the table was already full.</td></tr>
              <tr><td><code>dropped</code></td><td><code>uint32_t</code></td><td>Box-wide events shed under back-pressure, across every entry.</td></tr>
              <tr><td><code>clock</code></td><td><code>MediusClockEstimate</code></td><td>The measured difference between the two chips' clocks (below).</td></tr>
              <tr><td><code>n</code></td><td><code>uint16_t</code></td><td>Live entries in <code>entries</code>; 0 means nothing is subscribed.</td></tr>
              <tr><td><code>entries</code></td><td><code>MediusCatchEntry[MEDIUS_MAX_CATCH_ENTRIES]</code></td><td>One per accepted filter, in insertion order.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MEDIUSCATCHENTRY</div>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>filter</code></td><td><A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A></td><td>The accepted subscription: class, id, direction, and the <code>capture</code> that applies when this entry is the match.</td></tr>
              <tr><td><code>dropped</code></td><td><code>uint16_t</code></td><td>Events <em>this entry</em> could not queue.</td></tr>
            </tbody>
          </table>
          <p>
            Delivery is four strict-priority queues: input and bus first, then the byte-oriented
            traffic classes, then control, then vendor bulk. Under a busy mouse, bulk can starve
            completely.
          </p>
          <p>
            So the count is kept twice. The header's <code>dropped</code> says you are losing events;
            the per-entry one says <em>which subscription</em> is losing them, and those want different
            fixes.
          </p>
          <div class="api-response-label">MEDIUSCLOCKESTIMATE</div>
          <p>
            The box measures the difference with a four-timestamp exchange across the inter-chip link,
            stamping each frame as it reaches the wire rather than when it is queued. Queueing is the
            largest and most variable delay on that link.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>offset_us</code></td><td><code>int32_t</code></td><td>The host chip's clock minus the device chip's. Add it to a <code>DEVICE_CHIP</code> stamp to read that stamp on the <A href="/bindings/c/types#clock-domain"><code>HOST_CHIP</code></A> timeline; subtract to go the other way.</td></tr>
              <tr><td><code>rate_ppb</code></td><td><code>int32_t</code></td><td>Relative drift in parts per billion, for extrapolating between exchanges. <code>MEDIUS_CLOCK_RATE_NONE</code> means none was fitted, which is a different answer from a fitted <code>0</code>.</td></tr>
              <tr><td><code>delay_us</code></td><td><code>uint16_t</code></td><td>The best round trip measured in the window; the offset is good to about half of it. This is what says whether a cross-domain comparison is worth making.</td></tr>
              <tr><td><code>age_ms</code></td><td><code>uint32_t</code></td><td>How old the estimate is. <code>MEDIUS_CLOCK_AGE_NONE</code> keeps "never measured" distinct from an offset that happens to be zero; both read as <code>offset_us == 0</code> and only one is usable.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="imperfect-status" data-search-target>
        <Card>
          <CardHeader title="MediusImperfectStatus" subtitle="The imperfect-clone state (each 0 or 1)" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_imperfect</code></A>. See <A href="/library/options">Options</A>.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>True (1) when</th></tr></thead>
            <tbody>
              <tr><td><code>allowed</code></td><td><code>uint8_t</code></td><td>The opt-in toggle; cloning an over-capacity device is allowed.</td></tr>
              <tr><td><code>over_capacity</code></td><td><code>uint8_t</code></td><td>The device needs an interrupt-IN endpoint the box can't service.</td></tr>
              <tr><td><code>clone_imperfect</code></td><td><code>uint8_t</code></td><td>The live clone is over-capacity and was cloned anyway, so one interface is dead.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="emit-pace-status" data-search-target>
        <Card>
          <CardHeader title="MediusEmitPaceStatus" subtitle="The emit-rate pacing state" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_emit_pace</code></A>. See <A href="/library/options">Options</A>.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mode</code></td><td><A href="/bindings/c/types#emit-mode"><code>MediusEmitMode</code></A></td><td>The selected mode.</td></tr>
              <tr><td><code>fixed_hz</code></td><td><code>uint16_t</code></td><td>The rate requested for <code>FIXED</code> (0 otherwise).</td></tr>
              <tr><td><code>resolved_hz</code></td><td><code>uint16_t</code></td><td>The ceiling in effect; 0 = learnt/adaptive, or no device yet in <code>INTERVAL</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="counters" data-search-target>
        <Card>
          <CardHeader title="MediusCountersSnapshot" subtitle="Host-side always-on link counters" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_counters</code></A>. See <A href="/library/diagnostics">Logs &amp; counters</A>.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>frames_tx</code></td><td><code>uint64_t</code></td><td>Frames sent to the box.</td></tr>
              <tr><td><code>frames_rx</code></td><td><code>uint64_t</code></td><td>Frames received from the box.</td></tr>
              <tr><td><code>crc_drops</code></td><td><code>uint64_t</code></td><td>Inbound frames dropped on a bad <A href="/native/frame">checksum</A>.</td></tr>
              <tr><td><code>reconnects</code></td><td><code>uint64_t</code></td><td>Times the library reopened the port.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="portinfo" data-search-target>
        <Card>
          <CardHeader title="MediusPortInfo" subtitle="A discovered medius serial port" />
          <p>
            Filled by <A href="/bindings/c/api#connect"><code>medius_find_ports</code></A>; <code>path</code> and <code>serial</code> are NUL-terminated. Canonical
            docs on <A href="/library/types/structs#port-info"><code>PortInfo</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>path</code></td><td><code>char[MEDIUS_MAX_PATH]</code></td><td>Serial port path (NUL-terminated).</td></tr>
              <tr><td><code>vid</code></td><td><code>uint16_t</code></td><td>USB vendor id (<code>0x1A86</code>).</td></tr>
              <tr><td><code>pid</code></td><td><code>uint16_t</code></td><td>USB product id (<code>0x55D3</code>).</td></tr>
              <tr><td><code>serial</code></td><td><code>char[MEDIUS_MAX_SERIAL]</code></td><td>The CH343 adapter's serial (NUL-terminated); empty when <code>has_serial == 0</code>.</td></tr>
              <tr><td><code>has_serial</code></td><td><code>uint8_t</code></td><td>Whether the adapter serves a serial string.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="box-info" data-search-target>
        <Card>
          <CardHeader title="MediusBoxInfo" subtitle="One discovered box: port, version, and cloned device" />
          <p>
            Filled by <A href="/bindings/c/api#discovery"><code>medius_list</code></A>: one entry per
            connected box, each opened and handshaked in turn. See <A href="/library/discovery#box-info"><code>BoxInfo</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>port</code></td><td><A href="/bindings/c/types#portinfo"><code>MediusPortInfo</code></A></td><td>The box's control port (path + CH343 serial).</td></tr>
              <tr><td><code>version</code></td><td><A href="/bindings/c/types#version"><code>MediusVersion</code></A></td><td>Its firmware version, with the box MAC and name.</td></tr>
              <tr><td><code>device</code></td><td><A href="/bindings/c/types#device-info"><code>MediusDeviceInfo</code></A></td><td>The device it clones.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="events" data-search-target>
        <Card>
          <CardHeader title="Event & log types" subtitle="Fixed-size PODs off the streams" />
          <p>
            The values you read off the <A href="/bindings/c/streams">catch and log streams</A>.
            Catch semantics on <A href="/library/catch">Catch</A>; canonical docs on{' '}
            <A href="/library/types/structs">Structs</A>.
          </p>
        </Card>
      </div>

      <div id="motion-event" data-search-target>
        <Card>
          <CardHeader title="MediusMotionEvent" subtitle="One physical relative-axis snapshot" />
          <p>
            The user's real motion at the merge point, before any lock suppression or injection. Surfaces
            as the <code>Motion</code> arm of a <A href="/bindings/c/types#catch-event"><code>MediusCatchEvent</code></A>,
            raised by a <A href="/bindings/c/types#catch-class"><code>MEDIUS_CATCH_CLASS_AXIS</code></A>{' '}
            subscription.
          </p>
          <p>
            It carries no timestamp of its own: the enclosing event's{' '}
            <code>ts_us</code> and <A href="/bindings/c/types#clock-domain"><code>clock</code></A> cover
            it, and for motion the domain is always{' '}
            <code>MEDIUS_CLOCK_DOMAIN_HOST_CHIP</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>dx</code></td><td><code>int16_t</code></td><td>Relative X this report (right positive).</td></tr>
              <tr><td><code>dy</code></td><td><code>int16_t</code></td><td>Relative Y this report (down positive).</td></tr>
              <tr><td><code>dz</code></td><td><code>int16_t</code></td><td>Wheel delta this report (up positive).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="usage-event" data-search-target>
        <Card>
          <CardHeader title="MediusUsageEvent" subtitle="One held-usage snapshot for a class" />
          <p>
            The held usages of one class (button, key, or media; modifiers are key usages{' '}
            <code>0xE0 to 0xE7</code>) in <code>usages[0..n]</code>, buttons and keys the same shape. Test
            one with <A href="/bindings/c/api#inspectors"><code>medius_usage_event_is_held(&amp;event, usage)</code></A>.
            Raised by a <A href="/bindings/c/types#catch-class"><code>BTN</code></A>,{' '}
            <code>KEY</code>, or <code>MEDIA</code> subscription.
          </p>
          <p>
            Like motion, it carries no timestamp of its own: it uses the enclosing event's{' '}
            <code>ts_us</code> and <A href="/bindings/c/types#clock-domain"><code>clock</code></A>,
            which for a usage snapshot is always <code>MEDIUS_CLOCK_DOMAIN_HOST_CHIP</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class_</code></td><td><A href="/bindings/c/types#input-kind"><code>MediusClass</code></A></td><td>Which class this snapshot is of. Carried here rather than read off the first entry, because the snapshot that most needs it is the one with <code>n == 0</code>.</td></tr>
              <tr><td><code>direction</code></td><td><code>uint8_t</code>, a <A href="/bindings/c/types#direction"><code>MEDIUS_DIRECTION_*</code></A> value</td><td>The edge that produced it: the subscribed set grew (<code>POSITIVE</code>) or shrank (<code>NEGATIVE</code>).</td></tr>
              <tr><td><code>n</code></td><td><code>uint16_t</code></td><td>Live usages in <code>usages</code>.</td></tr>
              <tr><td><code>usages</code></td><td><code>MediusUsage[MEDIUS_MAX_USAGES]</code></td><td>The held <A href="/bindings/c/types#input"><code>MediusUsage</code></A> usages (button, key, or media).</td></tr>
            </tbody>
          </table>
          <p>
            Diffing successive snapshots into press and release edges is what the{' '}
            <A href="/bindings/c/streams#input">decoded-input stream</A> does for you.
          </p>
        </Card>
      </div>

      <div id="traffic-event" data-search-target>
        <Card>
          <CardHeader title="MediusTrafficEvent" subtitle="One captured packet off a traffic class" />
          <pre class="api-signature">{`struct MediusTrafficEvent {
    MediusCatchClass class_;
    uint16_t         id;
    uint8_t          direction;
    uint8_t          flags;
    uint16_t         true_len;   /* length before capture truncation */
    uint16_t         len;        /* bytes actually kept              */
    uint8_t          bytes[MEDIUS_MAX_TRAFFIC_BYTES];
};`}</pre>
          <p>
            The <code>Traffic</code> arm of a{' '}
            <A href="/bindings/c/types#catch-event"><code>MediusCatchEvent</code></A>, raised by any of
            the byte-oriented <A href="/bindings/c/types#catch-class">catch classes</A>.
          </p>
          <p>
            <code>bytes</code> is an inline array rather than a pointer, capped at{' '}
            <A href="/bindings/c/types#capacities"><code>MEDIUS_MAX_TRAFFIC_BYTES</code></A> (180), so
            the event stays a fixed-size POD you can copy, queue, and drop with nothing to free.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class_</code></td><td><A href="/bindings/c/types#catch-class"><code>MediusCatchClass</code></A></td><td>Which class produced the event; it also selects how <code>flags</code> reads.</td></tr>
              <tr><td><code>id</code></td><td><code>uint16_t</code></td><td>The endpoint address, endpoint number, or interface number, per the class.</td></tr>
              <tr><td><code>direction</code></td><td><code>uint8_t</code>, a <A href="/bindings/c/types#direction"><code>MEDIUS_DIRECTION_*</code></A> value</td><td><code>POSITIVE</code> = IN (device to PC), <code>NEGATIVE</code> = OUT (PC to device).</td></tr>
              <tr><td><code>flags</code></td><td><code>uint8_t</code></td><td>Class-specific; see the table below. <code>0</code> for classes that define none.</td></tr>
              <tr><td><code>true_len</code></td><td><code>uint16_t</code></td><td>The packet's length on the bus, before <code>capture</code> cut it.</td></tr>
              <tr><td><code>len</code></td><td><code>uint16_t</code></td><td>Bytes actually captured; the live prefix of <code>bytes</code>.</td></tr>
              <tr><td><code>bytes</code></td><td><code>uint8_t[MEDIUS_MAX_TRAFFIC_BYTES]</code></td><td>The capture, valid over <code>bytes[0..len]</code>.</td></tr>
            </tbody>
          </table>
          <p>
            Without <code>true_len</code>, a packet the box cut at your <code>capture</code> and a
            genuinely short packet are indistinguishable.{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_traffic_event_truncated(&amp;ev)</code></A>{' '}
            is that comparison.
          </p>
          <div class="api-response-label">FLAGS, BY CLASS</div>
          <table class="api-params">
            <thead><tr><th>Class</th><th><code>flags</code> reads as</th><th>Decode it with</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_CLASS_VENDOR_BULK</code></td><td>Bit 0: end of transfer. Bit 1: a zero-length packet.</td><td><code>medius_traffic_event_bulk_end_of_transfer</code>, <code>medius_traffic_event_bulk_zlp</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_CONTROL</code></td><td>The real device's answer: <code>0</code> it completed, <code>0xFD</code> it STALLed, <code>0xFE</code> it NAKed to timeout.</td><td><code>medius_traffic_event_control_status</code>, into a <code>MediusControlStatus</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_BUS</code></td><td>The bus event kind (table below).</td><td><code>medius_traffic_event_bus_event</code>, into a <code>MediusBusEvent</code></td></tr>
              <tr><td>every other class</td><td><code>0</code>.</td><td>-</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTROL: ONE EVENT PER TRANSACTION</div>
          <p>
            A <code>CONTROL</code> event covers a whole completed transaction, not one stage of one:{' '}
            <code>bytes</code> is the 8-byte SETUP packet followed by the data stage, and{' '}
            <code>direction</code> says which way that data went. Split them with{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_traffic_event_setup</code></A> and{' '}
            <code>medius_traffic_event_data</code>.
          </p>
          <p>
            A request the box answered from its own descriptor cache still produces an event.
          </p>
          <div class="api-response-label">BUS EVENT KINDS</div>
          <p>
            A <code>BUS</code> event puts the kind in <code>flags</code> and up to two operands in{' '}
            <code>bytes</code>. <code>medius_traffic_event_bus_event</code> decodes both into a{' '}
            <code>MediusBusEvent</code>.
          </p>
          <table class="api-params">
            <thead><tr><th><code>MediusBusEventKind</code></th><th><code>flags</code></th><th>Operands</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_RESET</code></td><td><code>0</code></td><td>none</td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_SUSPEND</code></td><td><code>1</code></td><td>none</td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_RESUME</code></td><td><code>2</code></td><td>none</td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_CONFIGURED</code></td><td><code>3</code></td><td><code>configuration</code></td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_DECONFIGURED</code></td><td><code>4</code></td><td>none</td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_SET_INTERFACE</code></td><td><code>5</code></td><td><code>interface</code>, <code>alt</code></td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_DEVICE_ATTACHED</code></td><td><code>6</code></td><td>none</td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_DEVICE_DETACHED</code></td><td><code>7</code></td><td>none</td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_CLONE_UP</code></td><td><code>8</code></td><td>none</td></tr>
              <tr><td><code>MEDIUS_BUS_EVENT_KIND_CLONE_DOWN</code></td><td><code>9</code></td><td>none</td></tr>
            </tbody>
          </table>
          <p>
            None of these announces a chip <em>reboot</em>, which is the only thing that restarts a
            stamping clock. Call <A href="/bindings/c/streams#timeline"><code>medius_timeline_reset</code></A>{' '}
            for a chip you know restarted.
          </p>
        </Card>
      </div>

      <div id="catch-event" data-search-target>
        <Card>
          <CardHeader title="MediusCatchEvent" subtitle="One catch-stream event (a tagged union)" />
          <pre class="api-signature">{`struct MediusCatchEvent {
    MediusCatchEventKind kind;
    uint32_t             ts_us;
    MediusClockDomain    clock;
    union MediusCatchEventData {
        MediusMotionEvent  motion;
        MediusUsageEvent   usages;
        MediusTrafficEvent traffic;
    } data;
}`}</pre>
          <p>
            Written by <A href="/bindings/c/api#streams"><code>medius_event_stream_recv</code></A> and friends. Read the union member named
            by <A href="/bindings/c/types#catch-event-kind"><code>kind</code></A>. See{' '}
            <A href="/bindings/c/types#clock-domain"><code>MediusClockDomain</code></A> for which class
            lands in which domain.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#catch-event-kind"><code>MediusCatchEventKind</code></A></td><td>Which union member is live.</td></tr>
              <tr><td><code>ts_us</code></td><td><code>uint32_t</code></td><td>When the report or packet was seen, in box microseconds. Wraps every ~71.6 minutes and restarts at a chip reboot. See <A href="/library/catch#timestamps">Catch timestamps</A>.</td></tr>
              <tr><td><code>clock</code></td><td><A href="/bindings/c/types#clock-domain"><code>MediusClockDomain</code></A></td><td>Which chip's clock <code>ts_us</code> came from. Compare stamps only within one domain, or map both onto your own clock with a <A href="/bindings/c/streams#timeline"><code>MediusTimeline</code></A>.</td></tr>
              <tr><td><code>data.motion</code></td><td><A href="/bindings/c/types#motion-event"><code>MediusMotionEvent</code></A></td><td>Read when <code>kind == MOTION</code>.</td></tr>
              <tr><td><code>data.usages</code></td><td><A href="/bindings/c/types#usage-event"><code>MediusUsageEvent</code></A></td><td>Read when <code>kind == USAGES</code>.</td></tr>
              <tr><td><code>data.traffic</code></td><td><A href="/bindings/c/types#traffic-event"><code>MediusTrafficEvent</code></A></td><td>Read when <code>kind == TRAFFIC</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">HOW BIG ONE EVENT IS</div>
          <table class="api-params">
            <thead><tr><th>Part</th><th>Bytes</th><th>Made of</th></tr></thead>
            <tbody>
              <tr><td><code>data.motion</code></td><td><code>6</code></td><td>Three <code>int16_t</code> deltas.</td></tr>
              <tr><td><code>data.traffic</code></td><td><code>190</code></td><td>10 bytes of header once padded, plus <code>bytes[180]</code>.</td></tr>
              <tr><td><code>data.usages</code></td><td><code>1028</code></td><td><code>class_</code>, <code>direction</code>, <code>n</code>, plus 256 x 4-byte <code>MediusUsage</code> = 1024.</td></tr>
              <tr><td>the union</td><td><code>1028</code></td><td>The largest arm, so <code>usages</code> sets it.</td></tr>
              <tr><td><code>MediusCatchEvent</code></td><td><code>1040</code></td><td><code>kind</code>, <code>ts_us</code>, <code>clock</code>, their padding, and the union.</td></tr>
            </tbody>
          </table>
          <p>
            An event is 1040 bytes whichever arm is live. The exact padding is the compiler's, so use{' '}
            <code>sizeof</code> if you need the number itself.
          </p>
        </Card>
      </div>

      <div id="log-line" data-search-target>
        <Card>
          <CardHeader title="MediusLogLine" subtitle="One device log line" />
          <p>Written by <A href="/bindings/c/api#streams"><code>medius_log_stream_recv</code></A>; <code>text</code> is NUL-terminated.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>level</code></td><td><A href="/bindings/c/types#log-level"><code>MediusLogLevel</code></A></td><td>Severity tag.</td></tr>
              <tr><td><code>text</code></td><td><code>char[MEDIUS_MAX_LOG_TEXT]</code></td><td>The decoded message (NUL-terminated).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>


      <div id="input-event" data-search-target>
        <Card>
          <CardHeader title="MediusInputEvent" subtitle="One decoded press, release, or motion report" />
          <pre class="api-signature">{`struct MediusInputEvent {
    MediusInputKind   kind;    /* PRESS = 0, RELEASE = 1, MOTION = 2   */
    uint32_t          ts_us;
    MediusClockDomain clock;   /* always HOST_CHIP for physical input  */
    MediusUsage       usage;   /* the edge's usage; zeroed for MOTION  */
    int16_t           dx, dy, dz;
};`}</pre>
          <p>
            Written by <A href="/bindings/c/streams#input"><code>medius_input_stream_recv</code></A> and
            its non-blocking siblings. The box sends held-usage snapshots; the stream diffs them, so a
            caller reads edges instead of sets.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#input-event-kind"><code>MediusInputKind</code></A></td><td>Which fields are live.</td></tr>
              <tr><td><code>ts_us</code></td><td><code>uint32_t</code></td><td>The report's arrival stamp, in the <code>clock</code> chip's microseconds.</td></tr>
              <tr><td><code>clock</code></td><td><A href="/bindings/c/types#clock-domain"><code>MediusClockDomain</code></A></td><td>Always <code>MEDIUS_CLOCK_DOMAIN_HOST_CHIP</code>: physical input is stamped on the host chip.</td></tr>
              <tr><td><code>usage</code></td><td><A href="/bindings/c/types#input"><code>MediusUsage</code></A></td><td>The button, key, or media usage this is an edge on; zeroed for <code>MOTION</code>.</td></tr>
              <tr><td><code>dx</code>, <code>dy</code>, <code>dz</code></td><td><code>int16_t</code></td><td>Relative X, Y, and wheel this report; zero unless <code>kind</code> is <code>MOTION</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="stamped" data-search-target>
        <Card>
          <CardHeader title="MediusStamped" subtitle="One event placed on this machine's clock" />
          <pre class="api-signature">{`struct MediusStamped {
    uint64_t host_ns;     /* on the caller's own monotonic scale */
    uint64_t box_us;      /* unwrapped past the 32-bit rollover  */
    uint64_t excess_ns;   /* jitter above the measured floor     */
};`}</pre>
          <p>
            Written by{' '}
            <A href="/bindings/c/streams#timeline"><code>medius_timeline_observe</code></A>.{' '}
            <code>host_ns</code> comes back on the same scale as the <code>now_ns</code> you passed in.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>host_ns</code></td><td><code>uint64_t</code></td><td>When the event happened, on the caller's monotonic clock.</td></tr>
              <tr><td><code>box_us</code></td><td><code>uint64_t</code></td><td>The event's own stamp, unwrapped: a raw <code>ts_us</code> wraps every ~71.6 minutes.</td></tr>
              <tr><td><code>excess_ns</code></td><td><code>uint64_t</code></td><td>How much later than the measured floor this event reached you. Jitter, not latency.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="clip-trigger" data-search-target>
        <Card>
          <CardHeader title="MediusClipTrigger" subtitle="One physical-input binding that drives the clip" />
          <p>
            A managed binding you add with <A href="/bindings/c/api#clip"><code>medius_clip_bind</code></A>: when <code>on</code> hits <code>edge</code>,
            the box runs <code>action</code> on the clip. Build the <code>on</code> usage with the{' '}
            <A href="/bindings/c/api#builders"><code>medius_usage_*</code></A> helpers. Concept on <A href="/library/clip">Clip</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>on</code></td><td><A href="/bindings/c/types#input"><code>MediusUsage</code></A></td><td>The physical button, key, or media usage that fires the binding.</td></tr>
              <tr><td><code>edge</code></td><td><A href="/bindings/c/types#edge"><code>MediusEdge</code></A></td><td>Which edge of <code>on</code> fires it.</td></tr>
              <tr><td><code>action</code></td><td><A href="/bindings/c/types#clip-action"><code>MediusClipAction</code></A></td><td>What it does to the clip.</td></tr>
              <tr><td><code>consume</code></td><td><code>uint8_t</code></td><td>1 to suppress the input so it never reaches the PC; 0 to let it pass through.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="clip-settings" data-search-target>
        <Card>
          <CardHeader title="MediusClipSettings" subtitle="The clip configuration read back from the box" />
          <p>From <A href="/bindings/c/api#clip"><code>medius_clip_query_config</code></A>: the auto-lock scope, the loop/retain/finalize scalars, and the live trigger set. Concept on <A href="/library/clip">Clip</A>.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>autolock_bits</code></td><td><code>uint8_t</code></td><td>The auto-lock scope as <code>CLIP_LOCK_*</code> wire bits (set with <A href="/bindings/c/api#clip"><code>medius_clip_set_autolock</code></A>).</td></tr>
              <tr><td><code>loop_</code></td><td><code>uint8_t</code></td><td>Playback loops at the clip end (retained mode only).</td></tr>
              <tr><td><code>retain</code></td><td><code>uint8_t</code></td><td>The loaded clip is retained so it can rewind and replay (0 = streaming).</td></tr>
              <tr><td><code>finalized</code></td><td><code>uint8_t</code></td><td>A retained clip's end is fixed, so it can replay and loop.</td></tr>
              <tr><td><code>ride</code></td><td><code>uint8_t</code></td><td>The clip's motion waits for a real move under <A href="/library/options#set-movement-riding">movement riding</A>.</td></tr>
              <tr><td><code>triggers</code></td><td><A href="/bindings/c/types#clip-trigger"><code>MediusClipTrigger</code></A><code>[MEDIUS_CLIP_TRIG_MAX]</code></td><td>The bound triggers, <code>triggers[0..n]</code>.</td></tr>
              <tr><td><code>n</code></td><td><code>uint8_t</code></td><td>Live entries in <code>triggers</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="clip-status" data-search-target>
        <Card>
          <CardHeader title="MediusClipStatus & MediusClipState" subtitle="Buffered-clip ring and playback state" />
          <p>From <A href="/bindings/c/api#clip"><code>medius_clip_query_status</code></A>; <code>state</code> is a <code>MediusClipState</code>. Concept on <A href="/library/clip">Clip</A>.</p>
          <div class="api-response-label">MEDIUSCLIPSTATE</div>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CLIP_STATE_IDLE</code></td><td><code>0</code></td><td>No clip playing (empty, or a loaded clip parked at its start).</td></tr>
              <tr><td><code>MEDIUS_CLIP_STATE_PLAYING</code></td><td><code>1</code></td><td>Draining the ring, one entry per native frame.</td></tr>
              <tr><td><code>MEDIUS_CLIP_STATE_PAUSED</code></td><td><code>2</code></td><td>Halted mid-clip; the cursor and any held usages are retained.</td></tr>
              <tr><td><code>MEDIUS_CLIP_STATE_FAULTED</code></td><td><code>3</code></td><td>An append was dropped or the ring overflowed; recover with <A href="/bindings/c/api#clip"><code>medius_clip_clear</code></A>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MEDIUSCLIPSTATUS</div>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>state</code></td><td><code>MediusClipState</code></td><td>The lifecycle state.</td></tr>
              <tr><td><code>free</code></td><td><code>uint32_t</code></td><td>Ring bytes free; pace top-ups off this.</td></tr>
              <tr><td><code>total</code></td><td><code>uint32_t</code></td><td>The retained clip size in bytes; streaming, the buffered-but-undrained bytes.</td></tr>
              <tr><td><code>played</code></td><td><code>uint32_t</code></td><td>Bytes played from the clip start (retained progress; ~0 while streaming).</td></tr>
              <tr><td><code>ticks</code></td><td><code>uint32_t</code></td><td>Content frames drained since the last start (gap runs are not counted).</td></tr>
              <tr><td><code>underruns</code></td><td><code>uint16_t</code></td><td>Empty-ring episodes.</td></tr>
              <tr><td><code>overruns</code></td><td><code>uint16_t</code></td><td>Appends dropped because the ring was full.</td></tr>
              <tr><td><code>seq_gaps</code></td><td><code>uint16_t</code></td><td>Dropped append frames detected.</td></tr>
              <tr><td><code>held_n</code></td><td><code>uint16_t</code></td><td>Held usages in <code>held</code>.</td></tr>
              <tr><td><code>held</code></td><td><code>MediusUsage[MEDIUS_MAX_USAGES]</code></td><td>The buttons, keys, and media the clip is holding down; test one with <A href="/bindings/c/api#inspectors"><code>medius_clip_status_is_held</code></A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="MediusStatus plus a thread-local message" />
          <pre class="api-signature">{`enum MediusStatus : int32_t   /* MEDIUS_STATUS_OK == 0; everything else is a failure */`}</pre>
          <p>
            Every fallible call returns a <code>MediusStatus</code> and writes its result through an
            out-param. On failure the detail lives in thread-local state. Read it before the next
            call on that thread overwrites it. Canonical mapping on{' '}
            <A href="/library/types/errors">Errors</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_STATUS_OK</code></td><td><code>0</code></td><td>Success.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_IO</code></td><td><code>1</code></td><td>An underlying serial or OS error.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_NOT_FOUND</code></td><td><code>2</code></td><td>No device matched the expected VID/PID.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_NO_REPLY</code></td><td><code>3</code></td><td>The box never answered the version query during the <A href="/native/connection#handshake">handshake</A>.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code></td><td><code>4</code></td><td>The box answered with an unexpected <code>proto_ver</code> (see <code>medius_last_error_proto_ver</code>).</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_QUERY_TIMEOUT</code></td><td><code>5</code></td><td>A query waited past its timeout with no reply.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_DISCONNECTED</code></td><td><code>6</code></td><td>The link dropped (also returned by a stream when it closes).</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_FRAME_TOO_LONG</code></td><td><code>7</code></td><td>An outbound frame exceeded the wire limit.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_FLASH_TOOL</code></td><td><code>8</code></td><td>The <A href="/library/features/flash">flash</A> subprocess (<a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer">esptool</a>) failed.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_INVALID_ARG</code></td><td><code>9</code></td><td>A bad argument (e.g. a null required pointer).</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_PANIC</code></td><td><code>10</code></td><td>A Rust panic was caught at the boundary.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_UNKNOWN</code></td><td><code>11</code></td><td>An unclassified failure.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_CATCH_TABLE_FULL</code></td><td><code>12</code></td><td>The subscription needs more entries than the box's table holds.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_EMPTY_SUBSCRIPTION</code></td><td><code>13</code></td><td>A catch subscription with no filters, which would never yield an event.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_CAPTURE_NOT_APPLICABLE</code></td><td><code>14</code></td><td>A non-zero <code>capture</code> on an input class, which carries no packet.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_NOT_AN_INPUT_FILTER</code></td><td><code>15</code></td><td>A traffic class passed to <code>medius_device_input_events</code>, which cannot decode one.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_WILDCARD_NOT_INPUT</code></td><td><code>16</code></td><td>The everything filter passed to <code>medius_device_input_events</code>; it covers traffic too.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_HALF_EDGE_INPUT_FILTER</code></td><td><code>17</code></td><td>An input filter narrowed to one edge, which cannot be decoded into press and release.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_RESERVED_ID</code></td><td><code>18</code></td><td>An exact id equal to the blanket sentinel, which would address the whole class.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_RELATIVE_DIRECTION</code></td><td><code>19</code></td><td><code>MEDIUS_DIRECTION_WITH</code> or <code>_AGAINST</code> where only a fixed sign or edge can be addressed. They are resolved against the <A href="/native/commands/lock#bearing">bearing</A> at emit time, which is after the call is made.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>medius_last_error_message(char *buf, uintptr_t cap)</code></td><td><code>uintptr_t</code></td><td>Copies the last error's text (NUL-terminated, truncated to <code>cap</code>); returns the full length, so you can size a buffer and retry.</td></tr>
              <tr><td><code>medius_last_error_proto_ver(void)</code></td><td><code>uint8_t</code></td><td>The version byte from a <code>BAD_PROTO_VER</code> error, or 0.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-c">{`MediusDevice *dev = NULL;
if (medius_device_find(&dev) != MEDIUS_STATUS_OK) {
    char buf[256];
    medius_last_error_message(buf, sizeof buf);
    fprintf(stderr, "open failed: %s\\n", buf);
    return 1;
}`}</code></pre>
        </Card>
      </div>

    </>
  );
};

export default Types;
