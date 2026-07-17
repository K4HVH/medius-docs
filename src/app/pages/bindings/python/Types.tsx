import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Types: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Types & errors" subtitle="Every enum, dataclass, and exception the package exposes" />
        <p>
          Reference for the values the <A href="/bindings/python/api">API</A> takes and returns.
          Field meanings live with each command, so this page links to the{' '}
          <A href="/library/types">Library types</A> and <A href="/native">Native API</A>. Raw HID
          id meanings (keycodes, button slots, Consumer usages) are on{' '}
          <A href="/native/commands/usage">Usage IDs</A>.
        </p>
        <div class="callout callout--info">
          <p>
            Every enum subclasses{' '}
            <a href="https://docs.python.org/3/library/enum.html" target="_blank" rel="noreferrer"><code>enum.IntEnum</code></a>,
            except <A href="#catchmask"><code>CatchMask</code></A>, which is an{' '}
            <a href="https://docs.python.org/3/library/enum.html#enum.IntFlag" target="_blank" rel="noreferrer"><code>enum.IntFlag</code></a>. A member{' '}
            <em>is</em> its <A href="/native/frame">wire byte</A>: <code>int(Button.LEFT) == 0</code>,
            and anywhere an enum is accepted you can pass a bare <code>int</code> instead (handy for
            a raw HID id with no named member). <code>CatchMask</code> members combine with{' '}
            <code>|</code>.
          </p>
        </div>
      </Card>

      <div id="enums" data-search-target>
        <Card>
          <CardHeader title="Injection enums" subtitle="Button · Action" />
          <p>
            See the <A href="/native/injection">injection model</A> for what each <code>Action</code>{' '}
            means; button slots on <A href="/native/commands/usage#buttons">Usage IDs</A>.
          </p>

          <div id="button">
            <div class="api-response-label">Button</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>LEFT</code></td><td><code>0</code></td></tr>
                <tr><td><code>RIGHT</code></td><td><code>1</code></td></tr>
                <tr><td><code>MIDDLE</code></td><td><code>2</code></td></tr>
                <tr><td><code>SIDE1</code></td><td><code>3</code></td></tr>
                <tr><td><code>SIDE2</code></td><td><code>4</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="action">
            <div class="api-response-label">Action</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>SOFT_RELEASE</code></td><td><code>0</code></td><td>release unless the user is physically holding it</td></tr>
                <tr><td><code>PRESS</code></td><td><code>1</code></td><td>hold down</td></tr>
                <tr><td><code>FORCE_RELEASE</code></td><td><code>2</code></td><td>release even against a physical hold</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="lock-enums" data-search-target>
        <Card>
          <CardHeader title="Lock & blanket enums" subtitle="LockDirection · LockTargetKind · Blanket" />
          <p>See <A href="/native/commands/lock">Lock</A> for what a direction and a blanket class mean.</p>

          <div id="lockdirection">
            <div class="api-response-label">LockDirection</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Blocks</th></tr></thead>
              <tbody>
                <tr><td><code>BOTH</code></td><td><code>0</code></td><td>either direction</td></tr>
                <tr><td><code>POSITIVE</code></td><td><code>1</code></td><td>+x / +y / wheel-up only</td></tr>
                <tr><td><code>NEGATIVE</code></td><td><code>2</code></td><td>-x / -y / wheel-down only</td></tr>
              </tbody>
            </table>
          </div>

          <div id="locktargetkind">
            <div class="api-response-label">LockTargetKind</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>X</code></td><td><code>0</code></td></tr>
                <tr><td><code>Y</code></td><td><code>1</code></td></tr>
                <tr><td><code>WHEEL</code></td><td><code>2</code></td></tr>
                <tr><td><code>USAGE</code></td><td><code>3</code></td></tr>
              </tbody>
            </table>
            <p>Built for you by <A href="#locktarget"><code>LockTarget.x/y/wheel/usage</code></A> (and the <code>button</code>/<code>key</code>/<code>media</code> shortcuts); you rarely name it directly.</p>
          </div>

          <div id="blanket">
            <div class="api-response-label">Blanket</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Class</th></tr></thead>
              <tbody>
                <tr><td><code>AIM</code></td><td><code>0</code></td><td>the X and Y cursor axes</td></tr>
                <tr><td><code>WHEEL</code></td><td><code>1</code></td><td>the wheel</td></tr>
                <tr><td><code>BUTTONS</code></td><td><code>2</code></td><td>every mouse button</td></tr>
                <tr><td><code>KEYS</code></td><td><code>3</code></td><td>every keyboard key and modifier</td></tr>
                <tr><td><code>MEDIA</code></td><td><code>4</code></td><td>every media usage</td></tr>
              </tbody>
            </table>
            <p>These are ABI-local ordinals (matching the crate's Blanket order), not the clip auto-lock scope bits.</p>
          </div>
        </Card>
      </div>

      <div id="keycodes" data-search-target>
        <Card>
          <CardHeader title="Keycode enums" subtitle="Key · MediaKey" />
          <p>
            Named subsets of the{' '}
            <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID usage tables</a>.
            The full list of ids and what they do is on{' '}
            <A href="/native/commands/usage#keycodes">Usage IDs</A> (keys) and{' '}
            <A href="/native/commands/usage#consumer">Usage IDs</A> (media). Any call that takes a{' '}
            <code>Key</code> or <code>MediaKey</code> also accepts a raw <code>int</code> usage.
          </p>

          <div id="key">
            <div class="api-response-label">Key</div>
            <table class="api-params">
              <thead><tr><th>Members</th><th>Values</th></tr></thead>
              <tbody>
                <tr><td><code>A</code> … <code>Z</code></td><td><code>4</code> to <code>29</code></td></tr>
                <tr><td><code>N1</code> … <code>N9</code>, <code>N0</code></td><td><code>30</code> to <code>39</code></td></tr>
                <tr><td><code>ENTER</code> <code>ESCAPE</code> <code>BACKSPACE</code> <code>TAB</code> <code>SPACE</code></td><td><code>40</code> to <code>44</code></td></tr>
                <tr><td><code>CAPS_LOCK</code></td><td><code>57</code></td></tr>
                <tr><td><code>F1</code> … <code>F12</code></td><td><code>58</code> to <code>69</code></td></tr>
                <tr><td><code>INSERT</code> <code>HOME</code> <code>PAGE_UP</code> <code>DELETE</code> <code>END</code> <code>PAGE_DOWN</code></td><td><code>73</code> to <code>78</code></td></tr>
                <tr><td><code>RIGHT</code> <code>LEFT</code> <code>DOWN</code> <code>UP</code> (arrows)</td><td><code>79</code> to <code>82</code></td></tr>
                <tr><td><code>LEFT_CTRL</code> <code>LEFT_SHIFT</code> <code>LEFT_ALT</code> <code>LEFT_GUI</code></td><td><code>224</code> to <code>227</code></td></tr>
                <tr><td><code>RIGHT_CTRL</code> <code>RIGHT_SHIFT</code> <code>RIGHT_ALT</code> <code>RIGHT_GUI</code></td><td><code>228</code> to <code>231</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="mediakey">
            <div class="api-response-label">MediaKey</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>PLAY</code></td><td><code>176</code></td></tr>
                <tr><td><code>PAUSE</code></td><td><code>177</code></td></tr>
                <tr><td><code>NEXT_TRACK</code></td><td><code>181</code></td></tr>
                <tr><td><code>PREV_TRACK</code></td><td><code>182</code></td></tr>
                <tr><td><code>STOP</code></td><td><code>183</code></td></tr>
                <tr><td><code>PLAY_PAUSE</code></td><td><code>205</code></td></tr>
                <tr><td><code>MUTE</code></td><td><code>226</code></td></tr>
                <tr><td><code>VOLUME_UP</code></td><td><code>233</code></td></tr>
                <tr><td><code>VOLUME_DOWN</code></td><td><code>234</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="led-admin-enums" data-search-target>
        <Card>
          <CardHeader title="LED & admin enums" subtitle="LedTarget · LedMode · RebootTarget" />
          <p>See <A href="/native/commands/led">LED</A> and <A href="/native/commands/admin">Admin</A>.</p>

          <div id="ledtarget">
            <div class="api-response-label">LedTarget</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>DEVICE</code></td><td><code>0</code></td></tr>
                <tr><td><code>HOST</code></td><td><code>1</code></td></tr>
                <tr><td><code>BOTH</code></td><td><code>2</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="ledmode">
            <div class="api-response-label">LedMode</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>AUTO</code></td><td><code>0</code></td></tr>
                <tr><td><code>OFF</code></td><td><code>1</code></td></tr>
                <tr><td><code>SOLID</code></td><td><code>2</code></td></tr>
                <tr><td><code>BLINK</code></td><td><code>3</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="reboottarget">
            <div class="api-response-label">RebootTarget</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>DEVICE_DOWNLOAD</code></td><td><code>0</code></td></tr>
                <tr><td><code>HOST_DOWNLOAD</code></td><td><code>1</code></td></tr>
                <tr><td><code>DEVICE_RUN</code></td><td><code>2</code></td></tr>
                <tr><td><code>HOST_RUN</code></td><td><code>3</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="emit-pace" data-search-target>
        <Card>
          <CardHeader title="Emit pace" subtitle="EmitMode · EmitPace" />
          <p>
            Passed to <A href="/bindings/python/api#led-admin-options"><code>dev.set_emit_pace()</code></A>.
            See <A href="/library/options">Options</A>.
          </p>
          <div id="emitmode">
            <div class="api-response-label">EmitMode</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>LEARNED</code></td><td><code>0</code></td></tr>
                <tr><td><code>INTERVAL</code></td><td><code>1</code></td></tr>
                <tr><td><code>FIXED</code></td><td><code>2</code></td></tr>
              </tbody>
            </table>
          </div>
          <div id="emitpace">
            <div class="api-response-label">EmitPace</div>
            <p>
              A frozen dataclass carrying <code>mode</code> and <code>hz</code>. Build it with{' '}
              <code>EmitPace.learned()</code>, <code>EmitPace.interval()</code>, or{' '}
              <code>EmitPace.fixed(hz)</code> (the rate snaps to <code>1000/n</code> and caps at 1 kHz).
            </p>
          </div>
        </Card>
      </div>

      <div id="clip-status" data-search-target>
        <Card>
          <CardHeader title="Clip" subtitle="ClipConfig · ClipState · ClipStatus" />
          <p>The buffered-clip types. Concept on <A href="/library/clip">Clip</A>.</p>
          <div id="clip-config">
            <div class="api-response-label">ClipConfig</div>
            <p>Playback options for <code>clip.start</code> / <code>clip.arm_catch</code>; extensible as more are added. <code>ClipConfig(autolock=[Blanket, ...])</code> auto-locks those <A href="#blanket"><code>Blanket</code></A> groups while playing (<code>None</code> / <code>[]</code> = none, <code>list(Blanket)</code> for every class).</p>
          </div>
          <div id="clipstate">
            <div class="api-response-label">ClipState</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>IDLE</code></td><td><code>0</code></td><td>No clip active.</td></tr>
                <tr><td><code>ARMED</code></td><td><code>1</code></td><td>A catch-trigger is armed; playback starts on the physical press edge.</td></tr>
                <tr><td><code>PLAYING</code></td><td><code>2</code></td><td>Draining the ring, one entry per native frame.</td></tr>
                <tr><td><code>FAULTED</code></td><td><code>3</code></td><td>An append was dropped or the ring overflowed; stop and re-preload.</td></tr>
              </tbody>
            </table>
          </div>
          <div id="clipstatus">
            <div class="api-response-label">ClipStatus (clip.status())</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>state</code></td><td><A href="#clipstate"><code>ClipState</code></A></td><td>the lifecycle state</td></tr>
                <tr><td><code>free</code> / <code>used</code></td><td><code>int</code></td><td>ring bytes free / buffered (pace top-ups off <code>free</code>)</td></tr>
                <tr><td><code>ticks</code></td><td><code>int</code></td><td>content frames drained since the last start (gap runs excluded)</td></tr>
                <tr><td><code>underruns</code> / <code>overruns</code> / <code>seq_gaps</code></td><td><code>int</code></td><td>empty-ring / ring-full / dropped-append counts</td></tr>
                <tr><td><code>held</code></td><td><code>List[Usage]</code></td><td>the held-usage snapshot: the buttons, keys, and media the clip is holding down (one shape, like a <A href="#usagesnapshot"><code>UsageSnapshot</code></A>)</td></tr>
                <tr><td><code>is_held(usage)</code></td><td><code>bool</code></td><td>test one <A href="#input"><code>Usage</code></A> in <code>held</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="stream-enums" data-search-target>
        <Card>
          <CardHeader title="Stream enums" subtitle="CatchMask · CatchEventKind · LogLevel" />
          <p>See <A href="/native/commands/catch">Catch</A> and <A href="/library/diagnostics">Logs &amp; counters</A>; consuming events is on <A href="/bindings/python/streams">Streams</A>.</p>

          <div id="catchmask">
            <div class="api-response-label">CatchMask (IntFlag)</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Subscribes to</th></tr></thead>
              <tbody>
                <tr><td><code>MOTION</code></td><td><code>1</code></td><td>cursor motion</td></tr>
                <tr><td><code>WHEEL</code></td><td><code>2</code></td><td>wheel</td></tr>
                <tr><td><code>BUTTONS</code></td><td><code>4</code></td><td>mouse buttons</td></tr>
                <tr><td><code>KEYS</code></td><td><code>8</code></td><td>keyboard keys</td></tr>
                <tr><td><code>MEDIA</code></td><td><code>16</code></td><td>media keys</td></tr>
                <tr><td><code>ALL</code></td><td><code>31</code></td><td>everything (default)</td></tr>
              </tbody>
            </table>
            <p>Combine with <code>|</code>, e.g. <code>CatchMask.BUTTONS | CatchMask.KEYS</code>.</p>
          </div>

          <div id="catcheventkind">
            <div class="api-response-label">CatchEventKind</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th><A href="#catchevent"><code>CatchEvent.payload</code></A> type</th></tr></thead>
              <tbody>
                <tr><td><code>MOTION</code></td><td><code>0</code></td><td><A href="#motionevent"><code>MotionEvent</code></A></td></tr>
                <tr><td><code>USAGES</code></td><td><code>1</code></td><td><A href="#usagesnapshot"><code>UsageSnapshot</code></A></td></tr>
              </tbody>
            </table>
          </div>

          <div id="loglevel">
            <div class="api-response-label">LogLevel</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>ERROR</code></td><td><code>0</code></td></tr>
                <tr><td><code>WARN</code></td><td><code>1</code></td></tr>
                <tr><td><code>INFO</code></td><td><code>2</code></td></tr>
                <tr><td><code>DEBUG</code></td><td><code>3</code></td></tr>
                <tr><td><code>VERBOSE</code></td><td><code>4</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="wire-enums" data-search-target>
        <Card>
          <CardHeader title="Wire enums" subtitle="MotionKind · Class · FrameType" />
          <p>
            Mostly internal. <code>MotionKind</code> and <code>Class</code> tag the structs the{' '}
            <A href="#input">Usage</A> and <A href="#motion">Motion</A> builders produce; <code>FrameType</code> names a wire
            frame for <A href="/library/features/mock"><code>MockBox.saw()</code></A> and{' '}
            <A href="#recordedframe"><code>RecordedFrame.type</code></A>. Frame semantics are on{' '}
            <A href="/native/frame">Frames</A> and <A href="/library/types/frames">Library frames</A>.
          </p>

          <div id="motionkind">
            <div class="api-response-label">MotionKind</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>CURSOR</code></td><td><code>0</code></td></tr>
                <tr><td><code>WHEEL</code></td><td><code>1</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="inputkind">
            <div class="api-response-label">Class</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>BUTTON</code></td><td><code>0</code></td></tr>
                <tr><td><code>KEY</code></td><td><code>1</code></td></tr>
                <tr><td><code>MEDIA</code></td><td><code>2</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="frametype">
            <div class="api-response-label">FrameType</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>MOVE</code></td><td><code>1</code></td><td><code>LOCK</code></td><td><code>10</code></td></tr>
                <tr><td><code>INJECT</code></td><td><code>3</code></td><td><code>CATCH</code></td><td><code>11</code></td></tr>
                <tr><td><code>RESET</code></td><td><code>4</code></td><td><code>MOTION_EVENT</code></td><td><code>12</code></td></tr>
                <tr><td><code>QUERY</code></td><td><code>5</code></td><td><code>USAGE_EVENT</code></td><td><code>15</code></td></tr>
                <tr><td><code>RESP</code></td><td><code>6</code></td><td><code>OPTION</code></td><td><code>17</code></td></tr>
                <tr><td><code>REBOOT_DL</code></td><td><code>7</code></td><td><code>CLIP_APPEND</code></td><td><code>18</code></td></tr>
                <tr><td><code>LOG</code></td><td><code>8</code></td><td><code>CLIP_CTRL</code></td><td><code>19</code></td></tr>
                <tr><td><code>LED</code></td><td><code>9</code></td><td></td><td></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="builders" data-search-target>
        <Card>
          <CardHeader title="Parameter builders" subtitle="Usage · Motion · LockTarget" />
          <p>
            Small classes that wrap a native struct. Build them with their class methods and pass
            the result to the matching call. Never construct one field by field.
          </p>

          <div id="input">
            <div class="api-response-label">Usage</div>
            <pre class="api-signature">{`Usage.button(button) -> Usage
Usage.key(key)       -> Usage
Usage.media(media)   -> Usage`}</pre>
            <p>An injection target for <A href="/bindings/python/api#inject"><code>dev.inject(input, action)</code></A>. See <A href="/library/inject">Inject</A>.</p>
          </div>

          <div id="motion">
            <div class="api-response-label">Motion</div>
            <pre class="api-signature">{`Motion.cursor(dx, dy) -> Motion
Motion.wheel(delta)   -> Motion`}</pre>
            <p>A relative axis drive for <A href="/bindings/python/api#move"><code>dev.move_axis(motion)</code></A>. See <A href="/library/move">Move</A>.</p>
          </div>

          <div id="locktarget">
            <div class="api-response-label">LockTarget</div>
            <pre class="api-signature">{`LockTarget.x()            -> LockTarget
LockTarget.y()            -> LockTarget
LockTarget.wheel()        -> LockTarget
LockTarget.usage(usage)   -> LockTarget
LockTarget.button(button) -> LockTarget
LockTarget.key(key)       -> LockTarget
LockTarget.media(media)   -> LockTarget`}</pre>
            <p>An axis or usage to lock for <A href="/bindings/python/api#lock"><code>dev.lock(target, direction)</code></A>; the <code>button</code>/<code>key</code>/<code>media</code> shortcuts wrap <code>usage()</code>. See <A href="/library/lock">Lock</A>.</p>
          </div>
        </Card>
      </div>

      <div id="device-enums" data-search-target>
        <Card>
          <CardHeader title="Device enums" subtitle="DeviceKind" />
          <p>
            The cloned device's kind, on <A href="#deviceinfo"><code>DeviceInfo.kind</code></A>, and what{' '}
            <A href="/bindings/python/api#discovery"><code>Device.find_mouse_box()</code></A> /{' '}
            <code>find_keyboard_box()</code> select on. See <A href="/library/types/enums#device-kind">DeviceKind</A>.
          </p>
          <div id="devicekind">
            <div class="api-response-label">DeviceKind</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>UNKNOWN</code></td><td><code>0</code></td></tr>
                <tr><td><code>KEYBOARD</code></td><td><code>1</code></td></tr>
                <tr><td><code>MOUSE</code></td><td><code>2</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="value-types" data-search-target>
        <Card>
          <CardHeader title="Identity & capability types" subtitle="Version · Health · DeviceInfo · Caps" />
          <p><a href="https://docs.python.org/3/library/dataclasses.html" target="_blank" rel="noreferrer">Dataclasses</a> returned by the <A href="/bindings/python/api">queries</A>. Canonical field docs: <A href="/library/types/structs">Library structs</A>.</p>

          <div id="version">
            <div class="api-response-label">Version (query_version())</div>
            <table class="api-params">
              <thead><tr><th>Field / property</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>proto_ver</code></td><td><code>int</code></td><td>control-protocol version</td></tr>
                <tr><td><code>fw_major</code></td><td><code>int</code></td><td>firmware major</td></tr>
                <tr><td><code>fw_minor</code></td><td><code>int</code></td><td>firmware minor</td></tr>
                <tr><td><code>fw_patch</code></td><td><code>int</code></td><td>firmware patch</td></tr>
                <tr><td><code>mac</code></td><td><code>bytes</code></td><td>the device chip's base MAC (6 bytes), a stable per-box id</td></tr>
                <tr><td><code>mac_hex</code></td><td><code>str</code></td><td>the MAC as 12 lowercase hex digits</td></tr>
                <tr><td><code>name</code></td><td><code>str</code></td><td>the box's human-readable name (a synthesized default when unset), set with <A href="/bindings/python/api#led-admin-options"><code>set_name</code></A></td></tr>
              </tbody>
            </table>
          </div>

          <div id="health">
            <div class="api-response-label">Health (query_health())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th></tr></thead>
              <tbody>
                <tr><td><code>link_up</code></td><td><code>bool</code></td></tr>
                <tr><td><code>mouse_attached</code></td><td><code>bool</code></td></tr>
                <tr><td><code>clone_configured</code></td><td><code>bool</code></td></tr>
                <tr><td><code>injection_active</code></td><td><code>bool</code></td></tr>
                <tr><td><code>rate_confident</code></td><td><code>bool</code></td></tr>
                <tr><td><code>lock_on</code></td><td><code>bool</code></td></tr>
                <tr><td><code>catch_on</code></td><td><code>bool</code></td></tr>
                <tr><td><code>kbd_attached</code></td><td><code>bool</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="deviceinfo">
            <div class="api-response-label">DeviceInfo (device_info())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>vid</code></td><td><code>int</code></td><td>USB vendor id</td></tr>
                <tr><td><code>pid</code></td><td><code>int</code></td><td>USB product id</td></tr>
                <tr><td><code>bcd_device</code></td><td><code>int</code></td><td>device release (BCD)</td></tr>
                <tr><td><code>bcd_usb</code></td><td><code>int</code></td><td>USB spec (BCD)</td></tr>
                <tr><td><code>has_serial</code></td><td><code>bool</code></td><td>exposes a serial string</td></tr>
                <tr><td><code>has_bos</code></td><td><code>bool</code></td><td>exposes a BOS descriptor</td></tr>
                <tr><td><code>kind</code></td><td><A href="#devicekind"><code>DeviceKind</code></A></td><td>the device's primary kind (Boot-interface protocol)</td></tr>
                <tr><td><code>product</code></td><td><code>str</code></td><td>the product string (empty when none)</td></tr>
              </tbody>
            </table>
          </div>

          <div id="caps">
            <div class="api-response-label">Caps (caps())</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>mouse</code></td><td><A href="#mousecaps"><code>MouseCaps</code></A></td><td>mouse capabilities</td></tr>
                <tr><td><code>keyboard</code></td><td><A href="#kbdcaps"><code>KbdCaps</code></A></td><td>keyboard capabilities</td></tr>
                <tr><td><code>mouse_change_driven</code></td><td><code>bool</code></td><td>mouse reports only on change</td></tr>
                <tr><td><code>kbd_change_driven</code></td><td><code>bool</code></td><td>keyboard reports only on change</td></tr>
                <tr><td><code>has_mouse()</code></td><td><code>bool</code></td><td>a mouse interface is present</td></tr>
                <tr><td><code>has_keyboard()</code></td><td><code>bool</code></td><td>a keyboard interface is present</td></tr>
                <tr><td><code>is_composite()</code></td><td><code>bool</code></td><td>the clone has more than one HID interface (<code>n_hid &gt; 1</code>)</td></tr>
              </tbody>
            </table>
          </div>

          <div id="mousecaps">
            <div class="api-response-label">MouseCaps</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>n_buttons</code></td><td><code>int</code></td><td>button count</td></tr>
                <tr><td><code>has_x</code></td><td><code>bool</code></td><td>X axis present</td></tr>
                <tr><td><code>has_y</code></td><td><code>bool</code></td><td>Y axis present</td></tr>
                <tr><td><code>has_wheel</code></td><td><code>bool</code></td><td>wheel present</td></tr>
                <tr><td><code>has_report_id</code></td><td><code>bool</code></td><td>reports carry a report id</td></tr>
                <tr><td><code>n_hid</code></td><td><code>int</code></td><td>HID interface count</td></tr>
              </tbody>
            </table>
          </div>

          <div id="kbdcaps">
            <div class="api-response-label">KbdCaps</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>n_keys</code></td><td><code>int</code></td><td>rollover key count</td></tr>
                <tr><td><code>nkro</code></td><td><code>bool</code></td><td>n-key rollover</td></tr>
                <tr><td><code>has_consumer</code></td><td><code>bool</code></td><td>Consumer (media) page</td></tr>
                <tr><td><code>has_system</code></td><td><code>bool</code></td><td>System-control page</td></tr>
                <tr><td><code>has_report_id</code></td><td><code>bool</code></td><td>reports carry a report id</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="state-types" data-search-target>
        <Card>
          <CardHeader title="State & telemetry types" subtitle="Rate · Stats · Locks · CatchState · ImperfectStatus · Counters · PortInfo" />
          <p>More query results, plus <A href="#portinfo"><code>PortInfo</code></A> from <A href="/bindings/python/api#connect"><code>find_ports()</code></A>. Canonical field docs: <A href="/library/types/structs">Library structs</A>.</p>

          <div id="rate">
            <div class="api-response-label">Rate (query_rate())</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>native_period_us</code></td><td><code>int</code></td><td>mouse report period, µs</td></tr>
                <tr><td><code>poll_period_us</code></td><td><code>int</code></td><td>poll period, µs</td></tr>
                <tr><td><code>confident</code></td><td><code>bool</code></td><td>estimate is settled</td></tr>
                <tr><td><code>change_driven</code></td><td><code>bool</code></td><td>reports only on change</td></tr>
                <tr><td><code>native_hz()</code></td><td><code>float | None</code></td><td>rate in Hz, or <code>None</code> if unknown</td></tr>
              </tbody>
            </table>
          </div>

          <div id="stats">
            <div class="api-response-label">Stats (query_stats())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>inject_emits</code></td><td><code>int</code></td><td>injected reports emitted</td></tr>
                <tr><td><code>tx_drops</code></td><td><code>int</code></td><td>dropped TX frames</td></tr>
                <tr><td><code>tx_merges</code></td><td><code>int</code></td><td>coalesced TX frames</td></tr>
                <tr><td><code>tx_maxdepth</code></td><td><code>int</code></td><td>peak TX queue depth</td></tr>
                <tr><td><code>tx_wedges</code></td><td><code>int</code></td><td>TX stalls</td></tr>
                <tr><td><code>wakeups</code></td><td><code>int</code></td><td>scheduler wakeups</td></tr>
                <tr><td><code>reset_count</code></td><td><code>int</code></td><td>resets seen</td></tr>
                <tr><td><code>config_count</code></td><td><code>int</code></td><td>clone configures</td></tr>
              </tbody>
            </table>
          </div>

          <div id="locks">
            <div class="api-response-label">Locks (query_locks())</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>entries</code></td><td><code>List[LockEntry]</code></td><td>one <A href="#lockentry"><code>LockEntry</code></A> per active lock</td></tr>
                <tr><td><code>is_locked(target, direction)</code></td><td><code>bool</code></td><td>test one <A href="#locktarget"><code>LockTarget</code></A> + <A href="#lockdirection"><code>LockDirection</code></A>; also true when a whole-class blanket covers it</td></tr>
              </tbody>
            </table>
          </div>

          <div id="lockentry">
            <div class="api-response-label">LockEntry</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>target</code></td><td><A href="#locktarget"><code>LockTarget</code></A></td><td>what is locked (an axis or a usage)</td></tr>
                <tr><td><code>is_blanket</code></td><td><code>bool</code></td><td>a whole-class lock, where <code>target</code> names only the class</td></tr>
                <tr><td><code>positive</code></td><td><code>bool</code></td><td>the +x / +y / wheel-up / press edge is locked</td></tr>
                <tr><td><code>negative</code></td><td><code>bool</code></td><td>the -x / -y / wheel-down / release edge is locked</td></tr>
              </tbody>
            </table>
          </div>

          <div id="catchstate">
            <div class="api-response-label">CatchState (query_catch())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>mask</code></td><td><code>int</code></td><td>active <A href="#catchmask"><code>CatchMask</code></A> bits</td></tr>
                <tr><td><code>dropped</code></td><td><code>int</code></td><td>events dropped by <A href="/native/hardware">the box</A></td></tr>
              </tbody>
            </table>
          </div>

          <div id="imperfectstatus">
            <div class="api-response-label">ImperfectStatus (query_imperfect())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>allowed</code></td><td><code>bool</code></td><td>imperfect clones opted in</td></tr>
                <tr><td><code>over_capacity</code></td><td><code>bool</code></td><td>mouse exceeds clone capacity</td></tr>
                <tr><td><code>clone_imperfect</code></td><td><code>bool</code></td><td>the live clone is imperfect</td></tr>
              </tbody>
            </table>
            <p>See <A href="/library/options">Options</A>.</p>
          </div>

          <div id="emitpacestatus">
            <div class="api-response-label">EmitPaceStatus (query_emit_pace())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>mode</code></td><td><A href="#emitpace"><code>EmitPace</code></A></td><td>the selected mode</td></tr>
                <tr><td><code>resolved_hz</code></td><td><code>int</code></td><td>the ceiling in effect; 0 = learned/adaptive or no device yet</td></tr>
              </tbody>
            </table>
            <p>See <A href="/library/options">Options</A>.</p>
          </div>

          <div id="counters">
            <div class="api-response-label">Counters (counters())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>frames_tx</code></td><td><code>int</code></td><td>host-side frames sent</td></tr>
                <tr><td><code>frames_rx</code></td><td><code>int</code></td><td>host-side frames received</td></tr>
                <tr><td><code>crc_drops</code></td><td><code>int</code></td><td>frames dropped on CRC</td></tr>
                <tr><td><code>reconnects</code></td><td><code>int</code></td><td>link reconnects</td></tr>
              </tbody>
            </table>
          </div>

          <div id="portinfo">
            <div class="api-response-label">PortInfo (find_ports())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>path</code></td><td><code>str</code></td><td>serial path, e.g. <code>/dev/ttyACM0</code> or <code>COM3</code></td></tr>
                <tr><td><code>vid</code></td><td><code>int</code></td><td>USB vendor id</td></tr>
                <tr><td><code>pid</code></td><td><code>int</code></td><td>USB product id</td></tr>
                <tr><td><code>serial</code></td><td><code>Optional[str]</code></td><td>the CH343 adapter's serial, when it serves one</td></tr>
              </tbody>
            </table>
            <p>Pass <code>path</code> to <A href="/bindings/python/api#connect"><code>Device.open(path)</code></A>. Canonical: <A href="/library/types/structs#port-info">PortInfo</A>.</p>
          </div>

          <div id="boxinfo">
            <div class="api-response-label">BoxInfo (list_boxes())</div>
            <table class="api-params">
              <thead><tr><th>Field / property</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>port</code></td><td><A href="#portinfo"><code>PortInfo</code></A></td><td>the box's control port</td></tr>
                <tr><td><code>version</code></td><td><A href="#version"><code>Version</code></A></td><td>its firmware version, with the box MAC and name</td></tr>
                <tr><td><code>device</code></td><td><A href="#deviceinfo"><code>DeviceInfo</code></A></td><td>the device it clones</td></tr>
                <tr><td><code>id</code></td><td><code>str</code></td><td>the box identity (the MAC hex)</td></tr>
                <tr><td><code>serial</code></td><td><code>Optional[str]</code></td><td>the CH343 serial</td></tr>
              </tbody>
            </table>
            <p>Pass <code>id</code> or <code>serial</code> to <A href="/bindings/python/api#discovery"><code>Device.open_by_id(id)</code></A>. Canonical: <A href="/library/discovery#box-info">BoxInfo</A>.</p>
          </div>
        </Card>
      </div>

      <div id="events" data-search-target>
        <Card>
          <CardHeader title="Event & log types" subtitle="Yielded by the streams" />
          <p>
            Payloads from <A href="/bindings/python/streams">streams</A>.{' '}
            <A href="/bindings/python/api#streams"><code>dev.catch_events()</code></A> yields <A href="#catchevent"><code>CatchEvent</code></A> and{' '}
            <A href="/bindings/python/api#streams"><code>dev.logs()</code></A> yields <A href="#logline"><code>LogLine</code></A>. What catch
            reports lives on <A href="/library/catch">Catch</A>.
          </p>

          <div id="catchevent">
            <div class="api-response-label">CatchEvent</div>
            <table class="api-params">
              <thead><tr><th>Field / member</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>kind</code></td><td><A href="#catcheventkind"><code>CatchEventKind</code></A></td><td>which payload is set</td></tr>
                <tr><td><code>payload</code></td><td><code>MotionEvent | UsageSnapshot</code></td><td>the decoded event</td></tr>
                <tr><td><code>motion</code></td><td><A href="#motionevent"><code>MotionEvent</code></A><code> | None</code></td><td>payload when <code>kind == MOTION</code></td></tr>
                <tr><td><code>usages</code></td><td><A href="#usagesnapshot"><code>UsageSnapshot</code></A><code> | None</code></td><td>payload when <code>kind == USAGES</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="motionevent">
            <div class="api-response-label">MotionEvent</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>dx</code></td><td><code>int</code></td><td>X delta</td></tr>
                <tr><td><code>dy</code></td><td><code>int</code></td><td>Y delta</td></tr>
                <tr><td><code>dz</code></td><td><code>int</code></td><td>wheel delta</td></tr>
              </tbody>
            </table>
          </div>

          <div id="usagesnapshot">
            <div class="api-response-label">UsageSnapshot</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>usages</code></td><td><code>List[Usage]</code></td><td>every held <A href="#input"><code>Usage</code></A> (button, key, or media; modifiers are key usages <code>0xE0</code> to <code>0xE7</code>)</td></tr>
                <tr><td><code>is_held(usage)</code></td><td><code>bool</code></td><td>test a <A href="#input"><code>Usage</code></A> in the snapshot</td></tr>
              </tbody>
            </table>
          </div>

          <div id="logline">
            <div class="api-response-label">LogLine</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>level</code></td><td><A href="#loglevel"><code>LogLevel</code></A></td><td>severity</td></tr>
                <tr><td><code>text</code></td><td><code>str</code></td><td>the log message</td></tr>
              </tbody>
            </table>
          </div>

          <div id="recordedframe">
            <div class="api-response-label">RecordedFrame (MockBox.recorded_frame(idx))</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>type</code></td><td><A href="#frametype"><code>FrameType</code></A><code> | int</code></td><td>frame type (raw <code>int</code> if unknown)</td></tr>
                <tr><td><code>seq</code></td><td><code>int</code></td><td>frame sequence byte</td></tr>
                <tr><td><code>payload</code></td><td><code>bytes</code></td><td>raw frame payload</td></tr>
              </tbody>
            </table>
            <p>Only meaningful with the <A href="/library/features/mock">mock</A> feature.</p>
          </div>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="MediusError, its subclasses, and the Status codes" />
          <p>
            Every <span class="api-badge api-badge--responded">Blocks</span> call (and any that fails
            on the wire) raises a <code>MediusError</code> or one of its subclasses. Catch the base
            class to catch them all. Canonical mapping: <A href="/library/types/errors">Library errors</A>.
          </p>

          <div id="mediuserror">
            <div class="api-response-label">MediusError (Exception)</div>
            <table class="api-params">
              <thead><tr><th>Attribute</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>status</code></td><td><A href="#status"><code>Status</code></A></td><td>the failure code</td></tr>
                <tr><td><code>message</code></td><td><code>str</code></td><td>the box's last error text</td></tr>
                <tr><td><code>proto_ver</code></td><td><code>int</code></td><td>offending version byte (bad-proto-version only)</td></tr>
              </tbody>
            </table>
            <pre><code class="language-python">{`from medius import Device, MediusError, NotFoundError

try:
    dev = Device.find()
except NotFoundError:
    ...                      # no box plugged in
except MediusError as e:     # any other failure
    print(e.status, e.message)`}</code></pre>
          </div>

          <div id="subclasses">
            <div class="api-response-label">Subclass per Status</div>
            <table class="api-params">
              <thead><tr><th>Exception</th><th>Raised on</th></tr></thead>
              <tbody>
                <tr><td><code>IoError</code></td><td><code>ERR_IO</code></td></tr>
                <tr><td><code>NotFoundError</code></td><td><code>ERR_NOT_FOUND</code></td></tr>
                <tr><td><code>NoReplyError</code></td><td><code>ERR_NO_REPLY</code></td></tr>
                <tr><td><code>BadProtoVerError</code></td><td><code>ERR_BAD_PROTO_VER</code></td></tr>
                <tr><td><code>QueryTimeoutError</code></td><td><code>ERR_QUERY_TIMEOUT</code></td></tr>
                <tr><td><code>DisconnectedError</code></td><td><code>ERR_DISCONNECTED</code></td></tr>
                <tr><td><code>FrameTooLongError</code></td><td><code>ERR_FRAME_TOO_LONG</code></td></tr>
                <tr><td><code>FlashToolError</code></td><td><code>ERR_FLASH_TOOL</code></td></tr>
                <tr><td><code>InvalidArgError</code></td><td><code>ERR_INVALID_ARG</code></td></tr>
                <tr><td><code>PanicError</code></td><td><code>ERR_PANIC</code></td></tr>
              </tbody>
            </table>
            <div class="callout callout--info">
              <p>
                <code>DisconnectedError</code> ends a <A href="/bindings/python/streams">stream</A>{' '}
                iteration cleanly rather than propagating. <code>OK</code> and{' '}
                <code>ERR_UNKNOWN</code> have no dedicated subclass; <code>ERR_UNKNOWN</code> raises
                the base <code>MediusError</code>.
              </p>
            </div>
          </div>

          <div id="status">
            <div class="api-response-label">Status</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>OK</code></td><td><code>0</code></td><td><code>ERR_DISCONNECTED</code></td><td><code>6</code></td></tr>
                <tr><td><code>ERR_IO</code></td><td><code>1</code></td><td><code>ERR_FRAME_TOO_LONG</code></td><td><code>7</code></td></tr>
                <tr><td><code>ERR_NOT_FOUND</code></td><td><code>2</code></td><td><code>ERR_FLASH_TOOL</code></td><td><code>8</code></td></tr>
                <tr><td><code>ERR_NO_REPLY</code></td><td><code>3</code></td><td><code>ERR_INVALID_ARG</code></td><td><code>9</code></td></tr>
                <tr><td><code>ERR_BAD_PROTO_VER</code></td><td><code>4</code></td><td><code>ERR_PANIC</code></td><td><code>10</code></td></tr>
                <tr><td><code>ERR_QUERY_TIMEOUT</code></td><td><code>5</code></td><td><code>ERR_UNKNOWN</code></td><td><code>11</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Types;
