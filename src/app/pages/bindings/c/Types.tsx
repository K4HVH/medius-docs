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
            <strong>How C models the enums.</strong> Each enum has a fixed-width backing:{' '}
            <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> is <code>int32_t</code>;
            every other enum is <code>uint8_t</code>. On{' '}
            <a href="https://en.cppreference.com/w/c/language/enum" target="_blank" rel="noreferrer">C23</a>{' '}
            and <a href="https://en.cppreference.com/w/cpp/language/enum" target="_blank" rel="noreferrer">C++</a>{' '}
            the tag carries that underlying type directly (<code>enum MediusButton : uint8_t</code>); on{' '}
            <a href="https://en.cppreference.com/w/c/language/history" target="_blank" rel="noreferrer">C99</a>{' '}
            the tag is{' '}
            <a href="https://en.cppreference.com/w/c/language/typedef" target="_blank" rel="noreferrer"><code>typedef</code></a>'d
            to the integer and you pass the prefixed enumerators
            (<code>MEDIUS_BUTTON_LEFT</code>). Structs are plain PODs: pass by value, read fields
            directly. Nothing is heap-allocated, so there's nothing to free per value; only the
            opaque handles have a <code>*_free</code>.
          </p>
        </div>
      </Card>

      <div id="capacities" data-search-target>
        <Card>
          <CardHeader title="Sizing constants" subtitle="Fixed-cap arrays sized to the wire limits" />
          <p>
            The event and log PODs embed fixed-cap arrays sized to the protocol's own limits, with a{' '}
            <code>uint8_t</code> count saying how many slots are live. <code>char</code> arrays are
            NUL-terminated.
          </p>
          <table class="api-params">
            <thead><tr><th>Macro</th><th>Value</th><th>Caps</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_MAX_KEYS</code></td><td><code>256</code></td><td><A href="/bindings/c/types#keyboard-event"><code>MediusKeyboardEvent.keys</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_MEDIA_KEYS</code></td><td><code>256</code></td><td><A href="/bindings/c/types#media-event"><code>MediusMediaEvent.keys</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_PATH</code></td><td><code>512</code></td><td><A href="/bindings/c/types#portinfo"><code>MediusPortInfo.path</code></A></td></tr>
              <tr><td><code>MEDIUS_MAX_LOG_TEXT</code></td><td><code>512</code></td><td><A href="/bindings/c/types#log-line"><code>MediusLogLine.text</code></A></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="enums" data-search-target>
        <Card>
          <CardHeader title="Enums" subtitle="uint8_t-backed selectors (MediusStatus is int32_t)" />
          <p>
            Each value is a wire byte; the canonical meaning lives on{' '}
            <A href="/library/types/enums">Enums</A>. The <code>*Kind</code> enums tag which arm of a
            built value (<A href="/bindings/c/types#input"><code>MediusInput</code></A>,{' '}
            <A href="/bindings/c/types#motion"><code>MediusMotion</code></A>,{' '}
            <A href="/bindings/c/types#catch-event"><code>MediusCatchEvent</code></A>) is populated.
          </p>
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
              <tr><td><code>MEDIUS_ACTION_SOFT_RELEASE</code></td><td><code>0</code></td><td>Clear the <A href="/native/hardware">box</A>'s press; a physical hold stays down.</td></tr>
              <tr><td><code>MEDIUS_ACTION_PRESS</code></td><td><code>1</code></td><td>Force the input down.</td></tr>
              <tr><td><code>MEDIUS_ACTION_FORCE_RELEASE</code></td><td><code>2</code></td><td>Force the input up, masking a physical hold.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="input-kind" data-search-target>
        <Card>
          <CardHeader title="MediusInputKind" subtitle="Which arm of a MediusInput is set" />
          <pre class="api-signature">{`enum MediusInputKind : uint8_t`}</pre>
          <p>
            Tags the <A href="/bindings/c/types#input"><code>MediusInput</code></A> you build with{' '}
            <A href="/bindings/c/api#builders"><code>medius_input_button/_key/_media</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_INPUT_KIND_BUTTON</code></td><td><code>0</code></td><td><code>value</code> is a mouse button id.</td></tr>
              <tr><td><code>MEDIUS_INPUT_KIND_KEY</code></td><td><code>1</code></td><td><code>value</code> is a HID keyboard usage.</td></tr>
              <tr><td><code>MEDIUS_INPUT_KIND_MEDIA</code></td><td><code>2</code></td><td><code>value</code> is a 16-bit Consumer usage.</td></tr>
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
              <tr><td><code>MEDIUS_LOCK_TARGET_KIND_BUTTON</code></td><td><code>3</code></td><td>A button (the struct's <code>button</code> field selects which).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="lock-direction" data-search-target>
        <Card>
          <CardHeader title="MediusLockDirection" subtitle="Which edge a lock applies to" />
          <pre class="api-signature">{`enum MediusLockDirection : uint8_t`}</pre>
          <p>For an axis or wheel it's a sign; for a button it's an edge. See <A href="/native/commands/lock">LOCK</A>.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_LOCK_DIRECTION_BOTH</code></td><td><code>0</code></td><td>Both signs, or press and release.</td></tr>
              <tr><td><code>MEDIUS_LOCK_DIRECTION_POSITIVE</code></td><td><code>1</code></td><td>Axis positive (<code>+</code>), or button press.</td></tr>
              <tr><td><code>MEDIUS_LOCK_DIRECTION_NEGATIVE</code></td><td><code>2</code></td><td>Axis negative (<code>−</code>), or button release.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="blanket" data-search-target>
        <Card>
          <CardHeader title="MediusBlanket" subtitle="A whole-class lock selector" />
          <pre class="api-signature">{`enum MediusBlanket : uint8_t`}</pre>
          <p>Which class <A href="/bindings/c/api#lock"><code>medius_device_lock_all/_unlock_all</code></A> block in one call. See <A href="/library/lock">Lock</A>.</p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_BLANKET_KEYS</code></td><td><code>0</code></td><td>Every physical keyboard key.</td></tr>
              <tr><td><code>MEDIUS_BLANKET_MEDIA</code></td><td><code>1</code></td><td>Every physical media usage.</td></tr>
              <tr><td><code>MEDIUS_BLANKET_BUTTONS</code></td><td><code>2</code></td><td>Every physical mouse button.</td></tr>
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
            union to read. See <A href="/library/catch">Catch</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Enumerator</th><th>Value</th><th>Read</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_MOUSE</code></td><td><code>0</code></td><td><code>data.mouse</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_KEYBOARD</code></td><td><code>1</code></td><td><code>data.keyboard</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_MEDIA</code></td><td><code>2</code></td><td><code>data.media</code></td></tr>
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

      <div id="catch-mask" data-search-target>
        <Card>
          <CardHeader title="MediusCatchMask" subtitle="Which physical reports raise an event" />
          <pre class="api-signature">{`typedef uint8_t MediusCatchMask;   /* OR the MEDIUS_CATCH_MASK_* bits */`}</pre>
          <p>
            The subscription you hand to <A href="/bindings/c/api#streams"><code>medius_device_catch_events</code></A>. OR the bits together.
            See <A href="/library/catch">Catch</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Macro</th><th>Bit</th><th>Triggers on</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_MASK_MOTION</code></td><td><code>0x01</code></td><td>The mouse moved (dx/dy).</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_WHEEL</code></td><td><code>0x02</code></td><td>The wheel turned.</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_BUTTONS</code></td><td><code>0x04</code></td><td>A button changed.</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_KEYS</code></td><td><code>0x08</code></td><td>A keyboard or media key changed.</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_ALL</code></td><td><code>0x0F</code></td><td>Every class.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="MediusKey" subtitle="A HID keyboard/keypad usage" />
          <pre class="api-signature">{`typedef uint8_t MediusKey;   /* modifiers are 0xE0..=0xE7 */`}</pre>
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
              <tr><td>Letters</td><td><code>MEDIUS_KEY_A</code> .. <code>MEDIUS_KEY_Z</code></td><td><code>4</code>–<code>29</code></td></tr>
              <tr><td>Digits</td><td><code>MEDIUS_KEY_1</code> .. <code>MEDIUS_KEY_0</code></td><td><code>30</code>–<code>39</code></td></tr>
              <tr><td>Function</td><td><code>MEDIUS_KEY_F1</code> .. <code>MEDIUS_KEY_F12</code></td><td><code>58</code>–<code>69</code></td></tr>
              <tr><td>Editing / nav</td><td><code>MEDIUS_KEY_ENTER</code>, <code>_ESCAPE</code>, <code>_TAB</code>, <code>_SPACE</code>, <code>_INSERT</code>, <code>_HOME</code>, <code>_DELETE</code>, arrows</td><td>various</td></tr>
              <tr><td>Modifiers</td><td><code>MEDIUS_KEY_LEFT_CTRL</code> .. <code>MEDIUS_KEY_RIGHT_GUI</code></td><td><code>224</code>–<code>231</code> (<code>0xE0</code>–<code>0xE7</code>)</td></tr>
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
              <tr><td><code>MEDIUS_FRAME_TYPE_MOVE</code></td><td><code>1</code></td><td><code>MEDIUS_FRAME_TYPE_LED</code></td><td><code>9</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_INJECT</code></td><td><code>3</code></td><td><code>MEDIUS_FRAME_TYPE_LOCK</code></td><td><code>10</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_RESET</code></td><td><code>4</code></td><td><code>MEDIUS_FRAME_TYPE_CATCH</code></td><td><code>11</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_QUERY</code></td><td><code>5</code></td><td><code>MEDIUS_FRAME_TYPE_MOUSE_EVENT</code></td><td><code>12</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_RESP</code></td><td><code>6</code></td><td><code>MEDIUS_FRAME_TYPE_KB_EVENT</code></td><td><code>15</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_REBOOT_DL</code></td><td><code>7</code></td><td><code>MEDIUS_FRAME_TYPE_CONS_EVENT</code></td><td><code>16</code></td></tr>
              <tr><td><code>MEDIUS_FRAME_TYPE_LOG</code></td><td><code>8</code></td><td><code>MEDIUS_FRAME_TYPE_OPTION</code></td><td><code>17</code></td></tr>
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
          <CardHeader title="MediusInput" subtitle="A momentary usage for inject" />
          <p>
            What <A href="/bindings/c/api#inject"><code>medius_device_inject</code></A> drives. Build with{' '}
            <A href="/bindings/c/api#builders"><code>medius_input_button(...)</code></A>, <code>_key(...)</code>, or <code>_media(...)</code>;{' '}
            <code>value</code> holds the id/usage per <A href="/bindings/c/types#input-kind"><code>kind</code></A>.
            See <A href="/library/inject">Inject</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#input-kind"><code>MediusInputKind</code></A></td><td>Which class <code>value</code> names.</td></tr>
              <tr><td><code>value</code></td><td><code>uint16_t</code></td><td>Button id, key usage, or media usage.</td></tr>
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
            Passed to <A href="/bindings/c/api#lock"><code>medius_device_lock</code></A> / <code>_unlock</code>. <code>button</code> is
            meaningful only when <code>kind</code> is <code>BUTTON</code>. See <A href="/library/lock">Lock</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#lock-target-kind"><code>MediusLockTargetKind</code></A></td><td>X, Y, Wheel, or Button.</td></tr>
              <tr><td><code>button</code></td><td><A href="/bindings/c/types#button"><code>MediusButton</code></A></td><td>Which button, when <code>kind == BUTTON</code>.</td></tr>
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
          <CardHeader title="MediusVersion" subtitle="Decoded firmware version" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_version</code></A>.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>proto_ver</code></td><td><code>uint8_t</code></td><td>Wire-protocol version the firmware speaks.</td></tr>
              <tr><td><code>fw_major</code></td><td><code>uint8_t</code></td><td>Firmware major version.</td></tr>
              <tr><td><code>fw_minor</code></td><td><code>uint8_t</code></td><td>Firmware minor version.</td></tr>
              <tr><td><code>fw_patch</code></td><td><code>uint8_t</code></td><td>Firmware patch version.</td></tr>
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
              <tr><td><code>lock_on</code></td><td><code>uint8_t</code></td><td>At least one input lock is active.</td></tr>
              <tr><td><code>catch_on</code></td><td><code>uint8_t</code></td><td>A catch subscription is streaming.</td></tr>
              <tr><td><code>kbd_attached</code></td><td><code>uint8_t</code></td><td>A keyboard is attached, cloned, and injectable.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="mouse-info" data-search-target>
        <Card>
          <CardHeader title="MediusMouseInfo" subtitle="The cloned mouse's USB identity" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_mouse_info</code></A>; all-zero when no mouse is cloned.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>vid</code></td><td><code>uint16_t</code></td><td>USB vendor id (idVendor).</td></tr>
              <tr><td><code>pid</code></td><td><code>uint16_t</code></td><td>USB product id (idProduct).</td></tr>
              <tr><td><code>bcd_device</code></td><td><code>uint16_t</code></td><td>Device release (bcdDevice).</td></tr>
              <tr><td><code>bcd_usb</code></td><td><code>uint16_t</code></td><td>USB version (bcdUSB), e.g. <code>0x0200</code>.</td></tr>
              <tr><td><code>has_serial</code></td><td><code>uint8_t</code></td><td>The clone serves a serial string.</td></tr>
              <tr><td><code>has_bos</code></td><td><code>uint8_t</code></td><td>The clone serves a BOS descriptor.</td></tr>
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
          <CardHeader title="MediusLocks" subtitle="The active lock bitmask" />
          <p>
            From <A href="/bindings/c/api#queries"><code>medius_device_query_locks</code></A>. Test a target/direction with{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_locks_is_locked(locks, target, dir)</code></A>. Bit layout on the native{' '}
            <A href="/native/commands/requests#requests">LOCKS</A> reply.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mask</code></td><td><code>uint16_t</code></td><td>The raw mask, 2 bits per target.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="catch-state" data-search-target>
        <Card>
          <CardHeader title="MediusCatchState" subtitle="The active catch subscription" />
          <p>From <A href="/bindings/c/api#queries"><code>medius_device_query_catch</code></A>. A nonzero <code>dropped</code> means the box shed events under back-pressure.</p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mask</code></td><td><code>uint8_t</code></td><td>Subscribed classes (the <A href="/bindings/c/types#catch-mask"><code>MEDIUS_CATCH_MASK_*</code></A> bits); 0 = none.</td></tr>
              <tr><td><code>dropped</code></td><td><code>uint32_t</code></td><td>Box-side events dropped under back-pressure.</td></tr>
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
            Filled by <A href="/bindings/c/api#connect"><code>medius_find_ports</code></A>; <code>path</code> is NUL-terminated. Canonical
            docs on <A href="/library/types/structs#port-info"><code>PortInfo</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>path</code></td><td><code>char[MEDIUS_MAX_PATH]</code></td><td>Serial port path (NUL-terminated).</td></tr>
              <tr><td><code>vid</code></td><td><code>uint16_t</code></td><td>USB vendor id (<code>0x1A86</code>).</td></tr>
              <tr><td><code>pid</code></td><td><code>uint16_t</code></td><td>USB product id (<code>0x55D3</code>).</td></tr>
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

      <div id="mouse-event" data-search-target>
        <Card>
          <CardHeader title="MediusMouseEvent" subtitle="One physical mouse snapshot" />
          <p>
            Captured before lock suppression or injection. Test a button with{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_mouse_event_is_pressed(&amp;event, button)</code></A>; diff <code>buttons</code>{' '}
            across events for press/release edges.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>buttons</code></td><td><code>uint8_t</code></td><td>Bit <code>b</code> = button id <code>b</code> (<code>0</code>=Left .. <code>4</code>=Side2).</td></tr>
              <tr><td><code>dx</code></td><td><code>int16_t</code></td><td>X movement this report.</td></tr>
              <tr><td><code>dy</code></td><td><code>int16_t</code></td><td>Y movement this report.</td></tr>
              <tr><td><code>wheel</code></td><td><code>int16_t</code></td><td>Wheel movement this report.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="keyboard-event" data-search-target>
        <Card>
          <CardHeader title="MediusKeyboardEvent" subtitle="One physical keyboard snapshot" />
          <p>
            A modifier bitmap plus the pressed non-modifier keycodes in <code>keys[0..n_keys]</code>.
            Test a key with <A href="/bindings/c/api#inspectors"><code>medius_keyboard_event_is_pressed(&amp;event, key)</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>modifiers</code></td><td><code>uint8_t</code></td><td>Modifier bitmap: bit <code>m</code> = the modifier at usage <code>0xE0 + m</code>.</td></tr>
              <tr><td><code>n_keys</code></td><td><code>uint8_t</code></td><td>Live keycodes in <code>keys</code>.</td></tr>
              <tr><td><code>keys</code></td><td><code>uint8_t[MEDIUS_MAX_KEYS]</code></td><td>The pressed non-modifier keycodes.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="media-event" data-search-target>
        <Card>
          <CardHeader title="MediusMediaEvent" subtitle="One physical media snapshot" />
          <p>
            The active Consumer usages in <code>keys[0..n_keys]</code>. Test one with{' '}
            <A href="/bindings/c/api#inspectors"><code>medius_media_event_is_pressed(&amp;event, media)</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>n_keys</code></td><td><code>uint8_t</code></td><td>Live usages in <code>keys</code>.</td></tr>
              <tr><td><code>keys</code></td><td><code>uint16_t[MEDIUS_MAX_MEDIA_KEYS]</code></td><td>The active Consumer usages.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="catch-event" data-search-target>
        <Card>
          <CardHeader title="MediusCatchEvent" subtitle="One catch-stream event (a tagged union)" />
          <pre class="api-signature">{`struct MediusCatchEvent {
    MediusCatchEventKind kind;
    union MediusCatchEventData { MediusMouseEvent mouse; MediusKeyboardEvent keyboard; MediusMediaEvent media; } data;
}`}</pre>
          <p>
            Written by <A href="/bindings/c/api#streams"><code>medius_event_stream_recv</code></A> and friends. Read the union member named
            by <A href="/bindings/c/types#catch-event-kind"><code>kind</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>C type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>kind</code></td><td><A href="/bindings/c/types#catch-event-kind"><code>MediusCatchEventKind</code></A></td><td>Which union member is live.</td></tr>
              <tr><td><code>data.mouse</code></td><td><A href="/bindings/c/types#mouse-event"><code>MediusMouseEvent</code></A></td><td>Read when <code>kind == MOUSE</code>.</td></tr>
              <tr><td><code>data.keyboard</code></td><td><A href="/bindings/c/types#keyboard-event"><code>MediusKeyboardEvent</code></A></td><td>Read when <code>kind == KEYBOARD</code>.</td></tr>
              <tr><td><code>data.media</code></td><td><A href="/bindings/c/types#media-event"><code>MediusMediaEvent</code></A></td><td>Read when <code>kind == MEDIA</code>.</td></tr>
            </tbody>
          </table>
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
