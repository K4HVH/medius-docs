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
            <a href="https://docs.python.org/3/library/enum.html" target="_blank" rel="noreferrer"><code>enum.IntEnum</code></a>. A member{' '}
            <em>is</em> its <A href="/native/frame">wire byte</A>: <code>int(Button.LEFT) == 0</code>,
            and anywhere an enum is accepted a bare <code>int</code> works too, for a raw HID id, an
            endpoint address, or an interface number with no named member.
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

          <div id="button" data-search-target>
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

          <div id="action" data-search-target>
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
          <CardHeader title="Lock & blanket enums" subtitle="Direction · LockTargetKind · Blanket" />
          <p>
            See <A href="/native/commands/lock">Lock</A> for what a direction and a blanket class
            mean, and <A href="/library/catch">Catch</A> for the third reading a direction has on a
            traffic subscription.
          </p>

          <div id="direction" data-search-target>
            <div class="api-response-label">Direction</div>
            <p>
              One enum with three readings, picked by what it is attached to: an axis, a usage, or a{' '}
              <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A> naming one of
              the byte-oriented <A href="/bindings/python/types#catchclass">catch classes</A>.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Aliases</th><th>On an axis or wheel</th><th>On a usage</th><th>On a traffic-class filter</th></tr></thead>
              <tbody>
                <tr><td><code>BOTH</code></td><td><code>0</code></td><td>-</td><td>either sign</td><td>press and release</td><td>both directions</td></tr>
                <tr><td><code>POSITIVE</code></td><td><code>1</code></td><td><code>PRESS</code> · <code>IN</code></td><td>+x / +y / wheel-up only</td><td>the press edge</td><td>IN, device to PC</td></tr>
                <tr><td><code>NEGATIVE</code></td><td><code>2</code></td><td><code>RELEASE</code> · <code>OUT</code></td><td>-x / -y / wheel-down only</td><td>the release edge</td><td>OUT, PC to device</td></tr>
              </tbody>
            </table>
            <p>
              The aliases are the same values under names that read at the call site:{' '}
              <code>Direction.PRESS is Direction.POSITIVE</code>.
            </p>
          </div>

          <div id="locktargetkind" data-search-target>
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
            <p>Built for you by <A href="/bindings/python/types#locktarget"><code>LockTarget.x/y/wheel/usage</code></A> (and the <code>button</code>/<code>key</code>/<code>media</code> shortcuts); you rarely name it directly.</p>
          </div>

          <div id="blanket" data-search-target>
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

          <div id="key" data-search-target>
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

          <div id="mediakey" data-search-target>
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

          <div id="ledtarget" data-search-target>
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

          <div id="ledmode" data-search-target>
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

          <div id="reboottarget" data-search-target>
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
          <div id="emitmode" data-search-target>
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
          <div id="emitpace" data-search-target>
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
          <CardHeader title="Clip" subtitle="ClipState · Edge · ClipAction · ClipTrigger · ClipSettings · ClipStatus" />
          <p>The buffered-clip types. Concept on <A href="/library/clip">Clip</A>.</p>
          <div id="clipstate" data-search-target>
            <div class="api-response-label">ClipState</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>IDLE</code></td><td><code>0</code></td><td>No clip playing.</td></tr>
                <tr><td><code>PLAYING</code></td><td><code>1</code></td><td>Draining the ring, one entry per native frame.</td></tr>
                <tr><td><code>PAUSED</code></td><td><code>2</code></td><td>Halted mid-clip; the cursor and any held input are retained.</td></tr>
                <tr><td><code>FAULTED</code></td><td><code>3</code></td><td>An append was dropped or the ring overflowed; <code>clear</code> to recover.</td></tr>
              </tbody>
            </table>
          </div>
          <div id="edge" data-search-target>
            <div class="api-response-label">Edge</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Fires on</th></tr></thead>
              <tbody>
                <tr><td><code>BOTH</code></td><td><code>0</code></td><td>either edge of the trigger usage</td></tr>
                <tr><td><code>PRESS</code></td><td><code>1</code></td><td>the physical press edge</td></tr>
                <tr><td><code>RELEASE</code></td><td><code>2</code></td><td>the physical release edge</td></tr>
              </tbody>
            </table>
            <p>Which edge of a <A href="/bindings/python/types#cliptrigger"><code>ClipTrigger</code></A> runs its action.</p>
          </div>
          <div id="clipaction" data-search-target>
            <div class="api-response-label">ClipAction</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Runs</th></tr></thead>
              <tbody>
                <tr><td><code>START</code></td><td><code>0</code></td><td>rewind and play</td></tr>
                <tr><td><code>STOP</code></td><td><code>1</code></td><td>stop and release</td></tr>
                <tr><td><code>PAUSE</code></td><td><code>2</code></td><td>halt mid-clip</td></tr>
                <tr><td><code>RESUME</code></td><td><code>3</code></td><td>continue from the pause</td></tr>
                <tr><td><code>RESTART</code></td><td><code>4</code></td><td>force a rewind and play</td></tr>
                <tr><td><code>TOGGLE</code></td><td><code>5</code></td><td>play if idle/paused, stop if playing</td></tr>
              </tbody>
            </table>
            <p>The action a bound trigger runs on the box, matching the <A href="/bindings/python/api#clip"><code>clip.start/stop/pause/resume/restart/toggle</code></A> methods.</p>
          </div>
          <div id="cliptrigger" data-search-target>
            <div class="api-response-label">ClipTrigger</div>
            <p>A dataclass binding a physical usage's edge to a clip action, passed to <A href="/bindings/python/api#clip"><code>clip.bind()</code></A>. The box runs the action itself with no host round-trip.</p>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>on</code></td><td><A href="/bindings/python/types#input"><code>Usage</code></A></td><td>the trigger usage (button, key, or media)</td></tr>
                <tr><td><code>edge</code></td><td><A href="/bindings/python/types#edge"><code>Edge</code></A></td><td>which edge fires the action</td></tr>
                <tr><td><code>action</code></td><td><A href="/bindings/python/types#clipaction"><code>ClipAction</code></A></td><td>what the box runs</td></tr>
                <tr><td><code>consume</code></td><td><code>bool</code></td><td>swallow the physical edge so it doesn't pass through (default <code>False</code>)</td></tr>
              </tbody>
            </table>
            <p>Construct it directly, e.g. <code>ClipTrigger(Usage.button(Button.SIDE1), Edge.PRESS, ClipAction.TOGGLE, consume=True)</code>.</p>
          </div>
          <div id="clipsettings" data-search-target>
            <div class="api-response-label">ClipSettings (clip.query_config())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>autolock</code></td><td><code>List[<A href="/bindings/python/types#blanket">Blanket</A>]</code></td><td>the input groups auto-locked while the clip plays</td></tr>
                <tr><td><code>loop</code></td><td><code>bool</code></td><td>playback loops at the clip end (retained mode only)</td></tr>
                <tr><td><code>retain</code></td><td><code>bool</code></td><td>the loaded clip is retained so it can rewind and replay</td></tr>
                <tr><td><code>finalized</code></td><td><code>bool</code></td><td>a retained clip's end is fixed, ready to replay and loop</td></tr>
                <tr><td><code>ride</code></td><td><code>bool</code></td><td>the clip's motion waits for a real move under <A href="/library/options#set-movement-riding">movement riding</A></td></tr>
                <tr><td><code>triggers</code></td><td><code>List[<A href="/bindings/python/types#cliptrigger">ClipTrigger</A>]</code></td><td>the bound trigger set (up to 8)</td></tr>
              </tbody>
            </table>
          </div>
          <div id="clipstatus" data-search-target>
            <div class="api-response-label">ClipStatus (clip.query_status())</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>state</code></td><td><A href="/bindings/python/types#clipstate"><code>ClipState</code></A></td><td>the lifecycle state</td></tr>
                <tr><td><code>free</code> / <code>total</code></td><td><code>int</code></td><td>ring bytes free (pace top-ups off this) / retained clip size in bytes (streaming: buffered-but-undrained)</td></tr>
                <tr><td><code>played</code></td><td><code>int</code></td><td>bytes played from the clip start (retained progress; ~0 while streaming)</td></tr>
                <tr><td><code>ticks</code></td><td><code>int</code></td><td>content frames emitted since the last start (gap runs excluded)</td></tr>
                <tr><td><code>underruns</code> / <code>overruns</code> / <code>seq_gaps</code></td><td><code>int</code></td><td>empty-ring / ring-full / dropped-append counts</td></tr>
                <tr><td><code>held</code></td><td><code>List[Usage]</code></td><td>the held-usage snapshot: the buttons, keys, and media the clip is holding down (one shape, like a <A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A>)</td></tr>
                <tr><td><code>is_held(usage)</code></td><td><code>bool</code></td><td>test one <A href="/bindings/python/types#input"><code>Usage</code></A> in <code>held</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="stream-enums" data-search-target>
        <Card>
          <CardHeader title="Stream enums" subtitle="CatchClass · TrafficClass · Axis · CatchFilter · Capture · CatchEventKind · ClockDomain · BusEventKind · LogLevel" />
          <p>See <A href="/native/commands/catch">Catch</A> and <A href="/library/diagnostics">Logs &amp; counters</A>; consuming events is on <A href="/bindings/python/streams">Streams</A>.</p>

          <div id="catchclass" data-search-target>
            <div class="api-response-label">CatchClass</div>
            <p>
              The address class a <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A>{' '}
              names. It is the same address vocabulary <A href="/bindings/python/api#lock"><code>lock</code></A>{' '}
              uses, with members <code>0</code> to <code>3</code> being the lock classes unchanged,
              extended with the byte-oriented traffic the box carries. <code>id</code> is class-specific.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>id means</th><th>As a blanket</th></tr></thead>
              <tbody>
                <tr><td><code>BUTTON</code></td><td><code>0</code></td><td>a <A href="/bindings/python/types#button"><code>Button</code></A> slot</td><td>every button</td></tr>
                <tr><td><code>KEY</code></td><td><code>1</code></td><td>a HID keyboard usage</td><td>every key and modifier</td></tr>
                <tr><td><code>MEDIA</code></td><td><code>2</code></td><td>a 16-bit Consumer usage</td><td>every media usage</td></tr>
                <tr><td><code>AXIS</code></td><td><code>3</code></td><td>an <A href="/bindings/python/types#axis"><code>Axis</code></A></td><td>every axis</td></tr>
                <tr><td><code>HID_IN</code></td><td><code>4</code></td><td>an interface number</td><td>every HID interface</td></tr>
                <tr><td><code>HID_OUT</code></td><td><code>5</code></td><td>an endpoint address</td><td>every interrupt-OUT endpoint</td></tr>
                <tr><td><code>VENDOR_INTERRUPT</code></td><td><code>6</code></td><td>an endpoint address</td><td>every vendor interrupt endpoint</td></tr>
                <tr><td><code>VENDOR_BULK</code></td><td><code>7</code></td><td>an endpoint address</td><td>every vendor bulk endpoint</td></tr>
                <tr><td><code>CONTROL</code></td><td><code>8</code></td><td>an endpoint number (<code>0</code> = EP0)</td><td>every control endpoint</td></tr>
                <tr><td><code>EMIT</code></td><td><code>9</code></td><td>an endpoint address</td><td>every emitting endpoint</td></tr>
                <tr><td><code>BUS</code></td><td><code>10</code></td><td>unused</td><td>the bus lifecycle</td></tr>
              </tbody>
            </table>
            <p>
              There is no every-class member. The wildcard is <code>CatchFilter.everything()</code>,
              whose <code>catch_class</code> reads <code>None</code>. <code>cls.is_input()</code> is
              true for <code>0</code> to <code>3</code>, <code>cls.is_traffic()</code> for the rest.
            </p>
            <p>
              The input classes are tapped before lock suppression and injection, so an input you have
              locked still reports here. <code>EMIT</code> is the opposite end, what the clone put on
              the wire afterwards.
            </p>
          </div>

          <div id="trafficclass" data-search-target>
            <div class="api-response-label">TrafficClass</div>
            <p>
              The byte-oriented half of the address space, values <code>4</code> to <code>10</code>{' '}
              under the same names as <A href="/bindings/python/types#catchclass"><code>CatchClass</code></A>.
            </p>
            <table class="api-params">
              <thead><tr><th>Members</th><th>Values</th></tr></thead>
              <tbody>
                <tr><td><code>HID_IN</code> <code>HID_OUT</code></td><td><code>4</code>, <code>5</code></td></tr>
                <tr><td><code>VENDOR_INTERRUPT</code> <code>VENDOR_BULK</code></td><td><code>6</code>, <code>7</code></td></tr>
                <tr><td><code>CONTROL</code> <code>EMIT</code> <code>BUS</code></td><td><code>8</code>, <code>9</code>, <code>10</code></td></tr>
              </tbody>
            </table>
            <p>
              It is what <code>CatchFilter.traffic</code> and <code>traffic_class</code> take, so an
              input class cannot reach a traffic constructor at all.
            </p>
          </div>

          <div id="axis" data-search-target>
            <div class="api-response-label">Axis</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>X</code></td><td><code>0</code></td></tr>
                <tr><td><code>Y</code></td><td><code>1</code></td></tr>
                <tr><td><code>WHEEL</code></td><td><code>2</code></td></tr>
              </tbody>
            </table>
            <p>One relative axis, for <code>CatchFilter.watch_axis(axis)</code>. The values are the wire axis ids a catch or lock entry carries.</p>
          </div>

          <div id="catchfilter" data-search-target>
            <div class="api-response-label">CatchFilter</div>
            <p>
              One subscription entry: a class, an id inside it, a direction, and how many bytes to keep
              per event. Pass one or an iterable to{' '}
              <A href="/bindings/python/api#streams"><code>dev.catch_events()</code></A> or{' '}
              <A href="/bindings/python/streams#input"><code>dev.input_events()</code></A>. The
              instance methods return a new filter rather than mutating in place.
            </p>
            <pre class="api-signature">{`CatchFilter.watch(usage)               -> CatchFilter         # a Usage, or a Button/Key/MediaKey
CatchFilter.watch_axis(axis)           -> CatchFilter         # one Axis
CatchFilter.watch_class(input_class)   -> CatchFilter         # every usage in one Class
CatchFilter.watch_axes()               -> CatchFilter         # X, Y and the wheel
CatchFilter.all_input()                -> List[CatchFilter]   # all four input classes
CatchFilter.traffic(traffic_class, id) -> CatchFilter         # one endpoint, interface, or EP number
CatchFilter.traffic_class(tc)          -> CatchFilter         # every id in one TrafficClass
CatchFilter.everything()               -> CatchFilter         # every class, every id, one entry

  .with_direction(direction)           -> CatchFilter   # a Direction, default BOTH
  .with_capture(n)                     -> CatchFilter   # bytes kept per event, default 0 = all
  .on_press() / .on_release()          -> CatchFilter   # one edge of an input filter
  .inbound() / .outbound()             -> CatchFilter   # one flow of a traffic filter
  .same_address(other)                 -> bool          # same table entry, whatever the capture

CatchFilter.traffic(TrafficClass.VENDOR_INTERRUPT, 0x83).with_capture(16)`}</pre>
            <table class="api-params">
              <thead><tr><th>Property</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>catch_class</code></td><td><code>Optional[<A href="/bindings/python/types#catchclass">CatchClass</A>]</code></td><td>the address class, or <code>None</code> for the every-class wildcard</td></tr>
                <tr><td><code>id</code></td><td><code>Optional[int]</code></td><td>the class-specific id, or <code>None</code> for the every-id wildcard. An id of <code>0</code> is a real address, not a wildcard.</td></tr>
                <tr><td><code>direction</code></td><td><A href="/bindings/python/types#direction"><code>Direction</code></A></td><td>for an input class, the press/release edge, exactly as for a lock; for a traffic class, the transfer flow, where <code>POSITIVE</code> is IN (device to PC) and <code>NEGATIVE</code> is OUT (PC to device).</td></tr>
                <tr><td><code>capture</code></td><td><code>int</code></td><td>bytes captured per event; <code>0</code> = the whole packet</td></tr>
              </tbody>
            </table>
            <p>
              Matching is most-specific-first: an exact <code>(class, id)</code> beats a class
              blanket, which beats <code>everything()</code>, and a named direction beats{' '}
              <code>BOTH</code>. The winning entry supplies the <code>capture</code>.
            </p>
            <p>
              <code>same_address</code> is true across two filters that differ only in{' '}
              <code>capture</code>, and false once one is narrowed to a direction.
            </p>
            <div class="callout callout--warning">
              <p>
                The box's table holds 32 entries.{' '}
                <A href="/bindings/python/api#streams"><code>catch_events()</code></A> raises{' '}
                <code>CatchTableFullError</code> when the union of every subscription in this
                process exceeds it. What the box itself refuses (a class this firmware does not know)
                raises nothing: compare{' '}
                <A href="/bindings/python/types#catchstate"><code>CatchState.entries</code></A> from{' '}
                <A href="/bindings/python/api#queries"><code>dev.query_catch()</code></A> against
                what you sent.
              </p>
            </div>
          </div>

          <div id="capture" data-search-target>
            <div class="api-response-label">Capture</div>
            <pre class="api-signature">{`Capture.WHOLE      # 0, keep the whole packet
Capture.first(n)   # keep the first n bytes; first(0) is WHOLE`}</pre>
            <p>
              What <code>with_capture</code> takes. Traffic classes only: an input class carries no
              packet, so naming one with a capture raises{' '}
              <code>CaptureNotApplicableError</code>.
            </p>
            <p>
              A ceiling request, not a guarantee. The box holds one entry per address and cuts once, so
              another subscriber naming that address more widely raises yours too.
            </p>
          </div>

          <div id="catcheventkind" data-search-target>
            <div class="api-response-label">CatchEventKind</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th><A href="/bindings/python/types#catchevent"><code>CatchEvent.payload</code></A> type</th><th>Fed by</th></tr></thead>
              <tbody>
                <tr><td><code>MOTION</code></td><td><code>0</code></td><td><A href="/bindings/python/types#motionevent"><code>MotionEvent</code></A></td><td><code>CatchClass.AXIS</code></td></tr>
                <tr><td><code>USAGES</code></td><td><code>1</code></td><td><A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A></td><td><code>BUTTON / KEY / MEDIA</code></td></tr>
                <tr><td><code>TRAFFIC</code></td><td><code>2</code></td><td><A href="/bindings/python/types#trafficevent"><code>TrafficEvent</code></A></td><td>every class from <code>HID_IN</code> to <code>BUS</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="clockdomain" data-search-target>
            <div class="api-response-label">ClockDomain</div>
            <p>
              Which of the box's two chips stamped an event's <code>ts_us</code>. The two{' '}
              <A href="/native/hardware">ESP32-S3s</A> boot independently, so nothing relates their
              timers.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Stamped</th><th>Covers</th></tr></thead>
              <tbody>
                <tr><td><code>HOST_CHIP</code></td><td><code>0</code></td><td>in USB interrupt context, when the real device's transfer completed</td><td>motion, usages, <code>HID_IN</code>, and IN transfers on <code>VENDOR_INTERRUPT / VENDOR_BULK</code></td></tr>
                <tr><td><code>DEVICE_CHIP</code></td><td><code>1</code></td><td>at the tap on the clone side</td><td><code>HID_OUT</code>, every OUT transfer, and <code>CONTROL / EMIT / BUS</code></td></tr>
              </tbody>
            </table>
            <p>
              A stamp is only meaningful against another from the same domain. Both clocks are
              box-local, wrap every ~71.6 minutes, and restart at zero when that chip reboots, so a
              value below the previous one is a wrap, a reboot, or a domain change.
            </p>
            <p>
              To put stamps on this machine's clock, feed them to a{' '}
              <A href="/bindings/python/streams#timeline"><code>Timeline</code></A>; to cross the two
              domains, apply the offset in{' '}
              <A href="/bindings/python/types#clockestimate"><code>ClockEstimate</code></A> and respect
              its error bound.
            </p>
          </div>

          <div id="busevent" data-search-target>
            <div class="api-response-label">BusEventKind</div>
            <p>
              What a <code>CatchClass.BUS</code> event describes. These also drive{' '}
              <A href="/bindings/python/types#health"><code>Health</code></A> bits and{' '}
              <A href="/bindings/python/types#stats"><code>Stats</code></A> counters; catching them
              adds a timestamped ordering.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Payload fields</th></tr></thead>
              <tbody>
                <tr><td><code>RESET</code></td><td><code>0</code></td><td>-</td></tr>
                <tr><td><code>SUSPEND</code></td><td><code>1</code></td><td>-</td></tr>
                <tr><td><code>RESUME</code></td><td><code>2</code></td><td>-</td></tr>
                <tr><td><code>CONFIGURED</code></td><td><code>3</code></td><td><code>configuration</code></td></tr>
                <tr><td><code>DECONFIGURED</code></td><td><code>4</code></td><td>-</td></tr>
                <tr><td><code>SET_INTERFACE</code></td><td><code>5</code></td><td><code>interface</code>, <code>alt</code></td></tr>
                <tr><td><code>DEVICE_ATTACHED</code></td><td><code>6</code></td><td>-</td></tr>
                <tr><td><code>DEVICE_DETACHED</code></td><td><code>7</code></td><td>-</td></tr>
                <tr><td><code>CLONE_UP</code></td><td><code>8</code></td><td>-</td></tr>
                <tr><td><code>CLONE_DOWN</code></td><td><code>9</code></td><td>-</td></tr>
              </tbody>
            </table>
            <p>
              <code>BusEvent</code> is the decoded dataclass{' '}
              <A href="/bindings/python/types#trafficevent"><code>TrafficEvent.bus_event()</code></A>{' '}
              returns: a <code>kind</code> plus <code>configuration</code>, <code>interface</code> and{' '}
              <code>alt</code>, each <code>0</code> for the kinds carrying none.
            </p>
          </div>

          <div id="loglevel" data-search-target>
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
          <CardHeader title="Wire enums" subtitle="MotionKind · MoveTiming · PendingMotion · Class · FrameType" />
          <p>
            Mostly internal. <code>MotionKind</code> and <code>Class</code> tag the structs the{' '}
            <A href="/bindings/python/types#input">Usage</A> and <A href="/bindings/python/types#motion">Motion</A> builders produce; <code>FrameType</code> names a wire
            frame for <A href="/library/features/mock"><code>MockBox.saw()</code></A> and{' '}
            <A href="/bindings/python/types#recordedframe"><code>RecordedFrame.type</code></A>. Frame semantics are on{' '}
            <A href="/native/frame">Frames</A> and <A href="/library/types/frames">Library frames</A>.
          </p>

          <div id="motionkind" data-search-target>
            <div class="api-response-label">MotionKind</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>CURSOR</code></td><td><code>0</code></td></tr>
                <tr><td><code>WHEEL</code></td><td><code>1</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="movetiming" data-search-target>
            <div class="api-response-label">MoveTiming</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>RIDE</code></td><td><code>0</code></td><td>wait for a real cursor move to carry the delta (the default)</td></tr>
                <tr><td><code>NOW</code></td><td><code>1</code></td><td>emit on the box's own clock, whatever <A href="/library/options#set-movement-riding">movement riding</A> is set to</td></tr>
              </tbody>
            </table>
          </div>

          <div id="pendingmotion" data-search-target>
            <div class="api-response-label">PendingMotion</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>KEEP</code></td><td><code>0</code></td><td>leave motion held for a ride alone (the default)</td></tr>
                <tr><td><code>FLUSH</code></td><td><code>1</code></td><td>emit it now, ignoring the ride window</td></tr>
                <tr><td><code>DISCARD</code></td><td><code>2</code></td><td>drop it</td></tr>
              </tbody>
            </table>
          </div>

          <div id="class" data-search-target>
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

          <div id="frametype" data-search-target>
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
                <tr><td><code>LED</code></td><td><code>9</code></td><td><code>CLIP_SET</code></td><td><code>20</code></td></tr>
                <tr><td></td><td></td><td><code>CLIP_TRIGGER</code></td><td><code>21</code></td></tr>
                <tr><td></td><td></td><td><code>TRAFFIC_EVENT</code></td><td><code>22</code></td></tr>
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

          <div id="input" data-search-target>
            <div class="api-response-label">Usage</div>
            <pre class="api-signature">{`Usage.button(button) -> Usage      # build
Usage.key(key)       -> Usage
Usage.media(media)   -> Usage

usage.kind           -> Class      # read one back
usage.id             -> int`}</pre>
            <p>
              An injection target for <A href="/bindings/python/api#inject"><code>dev.inject(input, action)</code></A>, and what a{' '}
              <A href="/bindings/python/types#inputevent"><code>InputEvent</code></A> and a{' '}
              <A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A> hand back.
              It compares by value, hashes, and reprs as <code>Usage(kind=BUTTON, id=0)</code>.
            </p>
            <div class="api-response-label">EXAMPLE</div>
            <pre><code class="language-python">{`# Naming a button off the stream: id is the Button value, kind says which class it is.
if ev.usage is not None and ev.usage.kind is Class.BUTTON:
    print(Button(ev.usage.id).name)

# Or compare whole usages.
if ev.usage == Usage.button(Button.SIDE1):
    print("side button")`}</code></pre>
          </div>

          <div id="motion" data-search-target>
            <div class="api-response-label">Motion</div>
            <pre class="api-signature">{`Motion.cursor(dx, dy) -> Motion
Motion.wheel(delta)   -> Motion`}</pre>
            <p>A relative axis drive for <A href="/bindings/python/api#move"><code>dev.move_axis(motion, timing, pending)</code></A>. See <A href="/library/move">Move</A>.</p>
          </div>


          <div id="locktarget" data-search-target>
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
            The cloned device's kind, on <A href="/bindings/python/types#deviceinfo"><code>DeviceInfo.kind</code></A>, and what{' '}
            <A href="/bindings/python/api#discovery"><code>Device.find_mouse_box()</code></A> /{' '}
            <code>find_keyboard_box()</code> select on. See <A href="/library/types/enums#device-kind">DeviceKind</A>.
          </p>
          <div id="devicekind" data-search-target>
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

          <div id="version" data-search-target>
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

          <div id="health" data-search-target>
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

          <div id="deviceinfo" data-search-target>
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
                <tr><td><code>kind</code></td><td><A href="/bindings/python/types#devicekind"><code>DeviceKind</code></A></td><td>the device's primary kind (Boot-interface protocol)</td></tr>
                <tr><td><code>product</code></td><td><code>str</code></td><td>the product string (empty when none)</td></tr>
              </tbody>
            </table>
          </div>

          <div id="caps" data-search-target>
            <div class="api-response-label">Caps (caps())</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>mouse</code></td><td><A href="/bindings/python/types#mousecaps"><code>MouseCaps</code></A></td><td>mouse capabilities</td></tr>
                <tr><td><code>keyboard</code></td><td><A href="/bindings/python/types#kbdcaps"><code>KbdCaps</code></A></td><td>keyboard capabilities</td></tr>
                <tr><td><code>mouse_change_driven</code></td><td><code>bool</code></td><td>mouse reports only on change</td></tr>
                <tr><td><code>kbd_change_driven</code></td><td><code>bool</code></td><td>keyboard reports only on change</td></tr>
                <tr><td><code>has_mouse()</code></td><td><code>bool</code></td><td>a mouse interface is present</td></tr>
                <tr><td><code>has_keyboard()</code></td><td><code>bool</code></td><td>a keyboard interface is present</td></tr>
                <tr><td><code>is_composite()</code></td><td><code>bool</code></td><td>the clone has more than one HID interface (<code>n_hid &gt; 1</code>)</td></tr>
              </tbody>
            </table>
          </div>

          <div id="mousecaps" data-search-target>
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

          <div id="kbdcaps" data-search-target>
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
          <CardHeader title="State & telemetry types" subtitle="Rate · Stats · Locks · CatchState · CatchEntry · ClockEstimate · ImperfectStatus · Counters · PortInfo" />
          <p>More query results, plus <A href="/bindings/python/types#portinfo"><code>PortInfo</code></A> from <A href="/bindings/python/api#connect"><code>find_ports()</code></A>. Canonical field docs: <A href="/library/types/structs">Library structs</A>.</p>

          <div id="rate" data-search-target>
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

          <div id="stats" data-search-target>
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

          <div id="locks" data-search-target>
            <div class="api-response-label">Locks (query_locks())</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>entries</code></td><td><code>List[LockEntry]</code></td><td>one <A href="/bindings/python/types#lockentry"><code>LockEntry</code></A> per active lock</td></tr>
                <tr><td><code>is_locked(target, direction)</code></td><td><code>bool</code></td><td>test one <A href="/bindings/python/types#locktarget"><code>LockTarget</code></A> + <A href="/bindings/python/types#direction"><code>Direction</code></A>; also true when a whole-class blanket covers it</td></tr>
              </tbody>
            </table>
          </div>

          <div id="lockentry" data-search-target>
            <div class="api-response-label">LockEntry</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>target</code></td><td><A href="/bindings/python/types#locktarget"><code>LockTarget</code></A></td><td>what is locked (an axis or a usage)</td></tr>
                <tr><td><code>is_blanket</code></td><td><code>bool</code></td><td>a whole-class lock, where <code>target</code> names only the class</td></tr>
                <tr><td><code>positive</code></td><td><code>bool</code></td><td>the +x / +y / wheel-up / press edge is locked</td></tr>
                <tr><td><code>negative</code></td><td><code>bool</code></td><td>the -x / -y / wheel-down / release edge is locked</td></tr>
              </tbody>
            </table>
          </div>

          <div id="catchstate" data-search-target>
            <div class="api-response-label">CatchState (query_catch())</div>
            <p>
              The live subscription table read back from the box. Since{' '}
              <A href="/bindings/python/api#streams"><code>catch_events()</code></A>{' '}
              gets no reply, this is the only way to see which filters the box holds.
            </p>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>table_full</code></td><td><code>bool</code></td><td>an entry was refused because the 32-entry table was full</td></tr>
                <tr><td><code>dropped</code></td><td><code>int</code></td><td>box-wide events that could not be queued</td></tr>
                <tr><td><code>clock</code></td><td><A href="/bindings/python/types#clockestimate"><code>ClockEstimate</code></A></td><td>the measured relationship between the two chips' clocks</td></tr>
                <tr><td><code>entries</code></td><td><code>List[<A href="/bindings/python/types#catchentry">CatchEntry</A>]</code></td><td>one entry per live subscription, up to 32</td></tr>
              </tbody>
            </table>
          </div>

          <div id="catchentry" data-search-target>
            <div class="api-response-label">CatchEntry</div>
            <p>
              One row of the box's table: the <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A>{' '}
              you sent, with a drop count attached.
            </p>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>filter</code></td><td><A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A></td><td>the entry as the box stored it; a class blanket stays one entry, never expanded per id</td></tr>
                <tr><td><code>dropped</code></td><td><code>int</code></td><td>events <em>this</em> entry could not queue</td></tr>
              </tbody>
            </table>
          </div>

          <div id="clockestimate" data-search-target>
            <div class="api-response-label">ClockEstimate (CatchState.clock)</div>
            <table class="api-params">
              <thead><tr><th>Field / member</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>offset_us</code></td><td><code>int</code></td><td>the host chip's clock minus the device chip's, in µs (signed)</td></tr>
                <tr><td><code>rate_ppb</code></td><td><code>Optional[int]</code></td><td>relative drift between the two chips, parts per billion (signed), or <code>None</code> when the box fitted no rate</td></tr>
                <tr><td><code>delay_us</code></td><td><code>int</code></td><td>the best measured round trip in the window; the offset is good to about half of it</td></tr>
                <tr><td><code>age_ms</code></td><td><code>Optional[int]</code></td><td>age of the estimate, or <code>None</code> when there is no estimate yet</td></tr>
                <tr><td><code>error_bound_us</code></td><td><code>int</code></td><td>half <code>delay_us</code>: the bound on how wrong <code>offset_us</code> can be</td></tr>
                <tr><td><code>to_host_domain(device_us)</code></td><td><code>Optional[int]</code></td><td>a device-chip stamp on the host chip's timeline, or <code>None</code> when there is no estimate to apply</td></tr>
              </tbody>
            </table>
            <p>
              Two independent crystals make an offset stale at up to 20 µs per second, so extrapolate
              with <code>rate_ppb</code> rather than trusting it.
            </p>
            <div class="callout callout--info">
              <p>
                Applying the offset is optional: each event's{' '}
                <A href="/bindings/python/types#clockdomain"><code>clock</code></A> stays
                authoritative.
              </p>
            </div>
          </div>

          <div id="imperfectstatus" data-search-target>
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

          <div id="emitpacestatus" data-search-target>
            <div class="api-response-label">EmitPaceStatus (query_emit_pace())</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>mode</code></td><td><A href="/bindings/python/types#emitpace"><code>EmitPace</code></A></td><td>the selected mode</td></tr>
                <tr><td><code>resolved_hz</code></td><td><code>int</code></td><td>the ceiling in effect; 0 = learned/adaptive or no device yet</td></tr>
              </tbody>
            </table>
            <p>See <A href="/library/options">Options</A>.</p>
          </div>

          <div id="counters" data-search-target>
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

          <div id="portinfo" data-search-target>
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

          <div id="boxinfo" data-search-target>
            <div class="api-response-label">BoxInfo (list_boxes())</div>
            <table class="api-params">
              <thead><tr><th>Field / property</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>port</code></td><td><A href="/bindings/python/types#portinfo"><code>PortInfo</code></A></td><td>the box's control port</td></tr>
                <tr><td><code>version</code></td><td><A href="/bindings/python/types#version"><code>Version</code></A></td><td>its firmware version, with the box MAC and name</td></tr>
                <tr><td><code>device</code></td><td><A href="/bindings/python/types#deviceinfo"><code>DeviceInfo</code></A></td><td>the device it clones</td></tr>
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
            <A href="/bindings/python/api#streams"><code>dev.catch_events()</code></A> yields <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A>,{' '}
            <A href="/bindings/python/api#streams"><code>dev.input_events()</code></A> yields <A href="/bindings/python/types#inputevent"><code>InputEvent</code></A>, and{' '}
            <A href="/bindings/python/api#streams"><code>dev.logs()</code></A> yields <A href="/bindings/python/types#logline"><code>LogLine</code></A>. What catch
            reports lives on <A href="/library/catch">Catch</A>.
          </p>

          <div id="catchevent" data-search-target>
            <div class="api-response-label">CatchEvent</div>
            <table class="api-params">
              <thead><tr><th>Field / member</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>kind</code></td><td><A href="/bindings/python/types#catcheventkind"><code>CatchEventKind</code></A></td><td>which payload is set</td></tr>
                <tr><td><code>payload</code></td><td><code>MotionEvent | UsageSnapshot | TrafficEvent</code></td><td>the decoded event</td></tr>
                <tr><td><code>ts_us</code></td><td><code>int</code></td><td>When the event happened, in box microseconds: the report's arrival for input, the tap firing for traffic. Box-local and wrapping every ~71.6 minutes, so compare stamps only against each other. See <A href="/library/catch#timestamps">Catch timestamps</A>.</td></tr>
                <tr><td><code>clock</code></td><td><A href="/bindings/python/types#clockdomain"><code>ClockDomain</code></A></td><td>which chip stamped <code>ts_us</code>. Two stamps are directly comparable only when this matches; across domains, apply <A href="/bindings/python/types#clockestimate"><code>CatchState.clock</code></A>.</td></tr>
                <tr><td><code>motion</code></td><td><A href="/bindings/python/types#motionevent"><code>MotionEvent</code></A><code> | None</code></td><td>payload when <code>kind == MOTION</code></td></tr>
                <tr><td><code>usages</code></td><td><A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A><code> | None</code></td><td>payload when <code>kind == USAGES</code></td></tr>
                <tr><td><code>traffic</code></td><td><A href="/bindings/python/types#trafficevent"><code>TrafficEvent</code></A><code> | None</code></td><td>payload when <code>kind == TRAFFIC</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="motionevent" data-search-target>
            <div class="api-response-label">MotionEvent</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>dx</code></td><td><code>int</code></td><td>X delta</td></tr>
                <tr><td><code>dy</code></td><td><code>int</code></td><td>Y delta</td></tr>
                <tr><td><code>dz</code></td><td><code>int</code></td><td>wheel delta</td></tr>
              </tbody>
            </table>
            <p>The stamp and its domain stay on the <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A> around it.</p>
          </div>

          <div id="usagesnapshot" data-search-target>
            <div class="api-response-label">UsageSnapshot</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>usages</code></td><td><code>List[Usage]</code></td><td>every held <A href="/bindings/python/types#input"><code>Usage</code></A> (button, key, or media; modifiers are key usages <code>0xE0</code> to <code>0xE7</code>)</td></tr>
                <tr><td><code>cls</code></td><td><A href="/bindings/python/types#class"><code>Class</code></A></td><td>the one class this snapshot covers, from the frame header</td></tr>
                <tr><td><code>direction</code></td><td><A href="/bindings/python/types#direction"><code>Direction</code></A></td><td>the edge that produced it</td></tr>
                <tr><td><code>is_held(usage)</code></td><td><code>bool</code></td><td>test a <A href="/bindings/python/types#input"><code>Usage</code></A> in the snapshot</td></tr>
              </tbody>
            </table>
            <p>
              Only held usages that resolve against your filters appear, and no event is emitted when
              none do, so a subscription to one button stays sparse even while the mouse reports at
              1 kHz.
            </p>
            <p>
              An empty snapshot still names its class: <code>cls</code> and <code>direction</code>{' '}
              come from the frame header, not the entries.
            </p>
          </div>

          <div id="trafficevent" data-search-target>
            <div class="api-response-label">TrafficEvent</div>
            <p>
              The payload for every byte-oriented <A href="/bindings/python/types#catchclass"><code>CatchClass</code></A>{' '}
              from <code>HID_IN</code> to <code>BUS</code>: one packet, one control transaction, or one
              bus event, with whatever the entry's <code>capture</code> let through.
            </p>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>catch_class</code></td><td><A href="/bindings/python/types#catchclass"><code>CatchClass</code></A></td><td>which class produced it</td></tr>
                <tr><td><code>id</code></td><td><code>int</code></td><td>endpoint address, interface number, or endpoint number, per the class</td></tr>
                <tr><td><code>direction</code></td><td><A href="/bindings/python/types#direction"><code>Direction</code></A></td><td><code>IN</code> (device to PC) or <code>OUT</code> (PC to device)</td></tr>
                <tr><td><code>flags</code></td><td><code>int</code></td><td>class-specific, see the table below</td></tr>
                <tr><td><code>true_len</code></td><td><code>int</code></td><td>the packet's length <em>before</em> capture truncation</td></tr>
                <tr><td><code>bytes</code></td><td><code>bytes</code></td><td>the captured bytes, at most 180 of them</td></tr>
                <tr><td><code>truncated()</code></td><td><code>bool</code></td><td><code>len(bytes) &lt; true_len</code>: bytes were cut</td></tr>
                <tr><td><code>setup()</code></td><td><code>Optional[bytes]</code></td><td>the 8-byte setup packet of a <code>CONTROL</code> event; <code>None</code> for another class or a shorter capture</td></tr>
                <tr><td><code>data()</code></td><td><code>bytes</code></td><td>the data stage of a <code>CONTROL</code> event, the whole packet for any other class</td></tr>
                <tr><td><code>control_status()</code></td><td><code>Optional[<A href="/bindings/python/types#controlstatus">ControlStatus</A>]</code></td><td>what the real device answered; <code>None</code> for any class but <code>CONTROL</code></td></tr>
                <tr><td><code>bus_event()</code></td><td><code>Optional[<A href="/bindings/python/types#busevent">BusEvent</A>]</code></td><td>the decoded lifecycle event; <code>None</code> for any class but <code>BUS</code> or an unknown kind</td></tr>
                <tr><td><code>bulk_end_of_transfer()</code> / <code>bulk_zlp()</code></td><td><code>bool</code></td><td>the two <code>VENDOR_BULK</code> framing bits, read off <code>flags</code></td></tr>
              </tbody>
            </table>
            <div class="api-response-label">FLAGS, BY CLASS</div>
            <table class="api-params">
              <thead><tr><th>Class</th><th>flags</th><th>Read it with</th></tr></thead>
              <tbody>
                <tr><td><code>VENDOR_BULK</code></td><td>b0 end-of-transfer, b1 zero-length packet</td><td><code>bulk_end_of_transfer()</code>, <code>bulk_zlp()</code></td></tr>
                <tr><td><code>CONTROL</code></td><td>the real device's answer: <code>0</code> OK, <code>0xFD</code> it STALLed, <code>0xFE</code> it NAKed to timeout</td><td><code>control_status()</code></td></tr>
                <tr><td><code>BUS</code></td><td>the <A href="/bindings/python/types#busevent"><code>BusEventKind</code></A>; the bytes hold its arguments</td><td><code>bus_event()</code></td></tr>
                <tr><td>everything else</td><td><code>0</code></td><td>-</td></tr>
              </tbody>
            </table>
            <p>
              A <code>CONTROL</code> event is one <em>completed transaction</em>, not one stage:{' '}
              <code>bytes</code> is <code>[setup 8][data…]</code> and <code>direction</code> says which
              way the data stage went. Requests the box answers from its own descriptor cache still
              produce an event.
            </p>
          </div>

          <div id="controlstatus" data-search-target>
            <div class="api-response-label">ControlStatus</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>OK</code></td><td><code>0</code></td><td>the real device answered</td></tr>
                <tr><td><code>STALLED</code></td><td><code>1</code></td><td>it STALLed the request</td></tr>
                <tr><td><code>NAKED</code></td><td><code>2</code></td><td>it NAKed to timeout</td></tr>
                <tr><td><code>OTHER</code></td><td><code>3</code></td><td>a status byte this build does not know; the raw byte stays on <code>TrafficEvent.flags</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="inputevent" data-search-target>
            <div class="api-response-label">InputEvent</div>
            <p>
              One decoded input: a press edge, a release edge, or a motion report. Yielded by{' '}
              <A href="/bindings/python/streams#input"><code>dev.input_events()</code></A>, which diffs
              the box's held-usage snapshots so you do not have to.
            </p>
            <table class="api-params">
              <thead><tr><th>Field / property</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>kind</code></td><td><A href="/bindings/python/types#inputkind"><code>InputKind</code></A></td><td>which arm is populated</td></tr>
                <tr><td><code>usage</code></td><td><code>Optional[<A href="/bindings/python/types#input">Usage</A>]</code></td><td>the usage this is an edge on; <code>None</code> for <code>MOTION</code></td></tr>
                <tr><td><code>dx</code> / <code>dy</code> / <code>dz</code></td><td><code>int</code></td><td>right / down / wheel-up deltas this report; <code>0</code> unless <code>kind</code> is <code>MOTION</code></td></tr>
                <tr><td><code>ts_us</code></td><td><code>int</code></td><td>the box stamp, as on a <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A></td></tr>
                <tr><td><code>clock</code></td><td><A href="/bindings/python/types#clockdomain"><code>ClockDomain</code></A></td><td>which chip stamped it</td></tr>
                <tr><td><code>is_press</code> / <code>is_release</code></td><td><code>bool</code></td><td>shorthand for the <code>kind</code> test</td></tr>
              </tbody>
            </table>
          </div>

          <div id="inputkind" data-search-target>
            <div class="api-response-label">InputKind</div>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Populates</th></tr></thead>
              <tbody>
                <tr><td><code>PRESS</code></td><td><code>0</code></td><td><code>usage</code>, a momentary usage going down</td></tr>
                <tr><td><code>RELEASE</code></td><td><code>1</code></td><td><code>usage</code>, the same coming up</td></tr>
                <tr><td><code>MOTION</code></td><td><code>2</code></td><td><code>dx</code>, <code>dy</code>, <code>dz</code></td></tr>
              </tbody>
            </table>
          </div>

          <div id="stamped" data-search-target>
            <div class="api-response-label">Stamped</div>
            <p>
              One event placed on this machine's clock by a{' '}
              <A href="/bindings/python/streams#timeline"><code>Timeline</code></A>.
            </p>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>host_ns</code></td><td><code>int</code></td><td>when the event happened, on the same monotonic scale passed as <code>now_ns</code></td></tr>
                <tr><td><code>box_us</code></td><td><code>int</code></td><td>the event's own stamp, unwrapped past the 32-bit rollover</td></tr>
                <tr><td><code>excess_ns</code></td><td><code>int</code></td><td>how much later than the measured floor this event arrived. Jitter, not latency.</td></tr>
              </tbody>
            </table>
          </div>

          <div id="logline" data-search-target>
            <div class="api-response-label">LogLine</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>level</code></td><td><A href="/bindings/python/types#loglevel"><code>LogLevel</code></A></td><td>severity</td></tr>
                <tr><td><code>text</code></td><td><code>str</code></td><td>the log message</td></tr>
              </tbody>
            </table>
          </div>

          <div id="recordedframe" data-search-target>
            <div class="api-response-label">RecordedFrame (MockBox.recorded_frame(idx))</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>type</code></td><td><A href="/bindings/python/types#frametype"><code>FrameType</code></A><code> | int</code></td><td>frame type (raw <code>int</code> if unknown)</td></tr>
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

          <div id="mediuserror" data-search-target>
            <div class="api-response-label">MediusError (Exception)</div>
            <table class="api-params">
              <thead><tr><th>Attribute</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>status</code></td><td><A href="/bindings/python/types#status"><code>Status</code></A></td><td>the failure code</td></tr>
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

          <div id="subclasses" data-search-target>
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
                <tr><td><code>CatchTableFullError</code></td><td><code>ERR_CATCH_TABLE_FULL</code></td></tr>
                <tr><td><code>EmptySubscriptionError</code></td><td><code>ERR_EMPTY_SUBSCRIPTION</code></td></tr>
                <tr><td><code>CaptureNotApplicableError</code></td><td><code>ERR_CAPTURE_NOT_APPLICABLE</code></td></tr>
                <tr><td><code>NotAnInputFilterError</code></td><td><code>ERR_NOT_AN_INPUT_FILTER</code></td></tr>
                <tr><td><code>WildcardNotInputError</code></td><td><code>ERR_WILDCARD_NOT_INPUT</code></td></tr>
                <tr><td><code>HalfEdgeInputFilterError</code></td><td><code>ERR_HALF_EDGE_INPUT_FILTER</code></td></tr>
                <tr><td><code>ReservedIdError</code></td><td><code>ERR_RESERVED_ID</code></td></tr>
              </tbody>
            </table>
            <p>
              The last six are subscription refusals, raised before a frame reaches the box.
            </p>
            <table class="api-params">
              <thead><tr><th>Refusal</th><th>Raised on</th></tr></thead>
              <tbody>
                <tr><td><code>CatchTableFullError</code></td><td>the union of every subscription in this process needs more than the box's 32 entries</td></tr>
                <tr><td><code>EmptySubscriptionError</code></td><td>a subscription with no filters, which would never yield an event</td></tr>
                <tr><td><code>CaptureNotApplicableError</code></td><td>a <A href="/bindings/python/types#capture"><code>Capture</code></A> on an input class, which carries no packet</td></tr>
                <tr><td><code>NotAnInputFilterError</code></td><td>a traffic class passed to <code>input_events</code>, which cannot decode one</td></tr>
                <tr><td><code>WildcardNotInputError</code></td><td><code>CatchFilter.everything()</code> passed to <code>input_events</code>; it covers traffic too</td></tr>
                <tr><td><code>HalfEdgeInputFilterError</code></td><td>an input filter narrowed to one edge, which cannot be decoded into press and release</td></tr>
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

          <div id="status" data-search-target>
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
                <tr><td><code>ERR_CATCH_TABLE_FULL</code></td><td><code>12</code></td><td><code>ERR_NOT_AN_INPUT_FILTER</code></td><td><code>15</code></td></tr>
                <tr><td><code>ERR_EMPTY_SUBSCRIPTION</code></td><td><code>13</code></td><td><code>ERR_WILDCARD_NOT_INPUT</code></td><td><code>16</code></td></tr>
                <tr><td><code>ERR_CAPTURE_NOT_APPLICABLE</code></td><td><code>14</code></td><td><code>ERR_HALF_EDGE_INPUT_FILTER</code></td><td><code>17</code></td></tr>
                <tr><td><code>ERR_NOT_AN_INPUT_FILTER</code></td><td><code>15</code></td><td><code>ERR_RESERVED_ID</code></td><td><code>18</code></td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Types;
