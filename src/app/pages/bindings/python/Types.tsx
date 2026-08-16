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
            and anywhere an enum is accepted you can pass a bare <code>int</code> instead, which is
            handy for a raw HID id, an endpoint address, or an interface number with no named member. The
            dataclasses that carry several of those bytes at once (<A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A>,{' '}
            <A href="/bindings/python/types#cliptrigger"><code>ClipTrigger</code></A>) have class
            methods that build them; reach for those rather than filling fields in by hand.
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
          <CardHeader title="Lock & blanket enums" subtitle="LockDirection · LockTargetKind · Blanket" />
          <p>
            See <A href="/native/commands/lock">Lock</A> for what a direction and a blanket class
            mean, and <A href="/library/catch">Catch</A> for the third reading a direction has on a
            traffic subscription.
          </p>

          <div id="lockdirection" data-search-target>
            <div class="api-response-label">LockDirection</div>
            <p>
              One enum with three readings, picked by what it is attached to: the sign of an axis or
              the wheel, the edge of a usage, or the direction of a transfer when it sits on a{' '}
              <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A> naming one of
              the byte-oriented <A href="/bindings/python/types#catchclass">catch classes</A>. No
              target is more than one of those, so one field carries whichever reading applies without
              ambiguity.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>On an axis or wheel</th><th>On a usage</th><th>On a traffic-class filter</th></tr></thead>
              <tbody>
                <tr><td><code>BOTH</code></td><td><code>0</code></td><td>either sign</td><td>press and release</td><td>both directions</td></tr>
                <tr><td><code>POSITIVE</code></td><td><code>1</code></td><td>+x / +y / wheel-up only</td><td>the press edge</td><td>IN, device to PC</td></tr>
                <tr><td><code>NEGATIVE</code></td><td><code>2</code></td><td>-x / -y / wheel-down only</td><td>the release edge</td><td>OUT, PC to device</td></tr>
              </tbody>
            </table>
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
          <CardHeader title="Stream enums" subtitle="CatchClass · CatchFilter · CatchEventKind · ClockDomain · BusEvent · LogLevel" />
          <p>See <A href="/native/commands/catch">Catch</A> and <A href="/library/diagnostics">Logs &amp; counters</A>; consuming events is on <A href="/bindings/python/streams">Streams</A>.</p>

          <div id="catchclass" data-search-target>
            <div class="api-response-label">CatchClass</div>
            <p>
              The address class a <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A>{' '}
              names. It is the same address vocabulary <A href="/bindings/python/api#lock"><code>lock</code></A>{' '}
              uses, with members <code>0</code> to <code>3</code> being the lock classes unchanged,
              extended with the byte-oriented traffic the box carries. <code>id</code> is class-specific, and{' '}
              <code>CATCH_ID_ALL</code> (<code>0xFFFF</code>) is the sentinel for every id in the class.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>id means</th><th>With CATCH_ID_ALL</th></tr></thead>
              <tbody>
                <tr><td><code>BUTTON</code></td><td><code>0</code></td><td>a <A href="/bindings/python/types#button"><code>Button</code></A> slot</td><td>every button</td></tr>
                <tr><td><code>KEY</code></td><td><code>1</code></td><td>a HID keyboard usage</td><td>every key and modifier</td></tr>
                <tr><td><code>MEDIA</code></td><td><code>2</code></td><td>a 16-bit Consumer usage</td><td>every media usage</td></tr>
                <tr><td><code>AXIS</code></td><td><code>3</code></td><td>X, Y, or wheel</td><td>every axis</td></tr>
                <tr><td><code>HID_IN</code></td><td><code>4</code></td><td>an interface number</td><td>every HID interface</td></tr>
                <tr><td><code>HID_OUT</code></td><td><code>5</code></td><td>an endpoint address</td><td>every interrupt-OUT endpoint</td></tr>
                <tr><td><code>VEND_INTR</code></td><td><code>6</code></td><td>an endpoint address</td><td>every vendor interrupt endpoint</td></tr>
                <tr><td><code>VEND_BULK</code></td><td><code>7</code></td><td>an endpoint address</td><td>every vendor bulk endpoint</td></tr>
                <tr><td><code>CONTROL</code></td><td><code>8</code></td><td>an endpoint number (<code>0</code> = EP0)</td><td>every control endpoint</td></tr>
                <tr><td><code>EMIT</code></td><td><code>9</code></td><td>an interface number</td><td>every emitting interface</td></tr>
                <tr><td><code>BUS</code></td><td><code>10</code></td><td>unused; pass <code>CATCH_ID_ALL</code></td><td>the bus lifecycle</td></tr>
                <tr><td><code>ANY</code></td><td><code>0xFF</code></td><td>nothing; only <code>CATCH_ID_ALL</code> is accepted</td><td>every class</td></tr>
              </tbody>
            </table>
            <p>
              Classes <code>0</code> to <code>3</code> yield <A href="/bindings/python/types#motionevent"><code>MotionEvent</code></A>{' '}
              and <A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A>{' '}
              payloads; <code>HID_IN</code> through <code>BUS</code> yield a{' '}
              <A href="/bindings/python/types#trafficevent"><code>TrafficEvent</code></A> carrying raw
              bytes. The input classes are tapped at the emission merge point <em>before</em> lock
              suppression and injection, so an input you have locked still reports;{' '}
              <code>EMIT</code> is the opposite end, what the clone actually put on the wire after
              injection, locks, and the suppression gate. Subscribe to both to watch the transformation.
            </p>
            <div class="callout callout--info">
              <p>
                The address is also the filter, and that is what the class list buys you. The control
                link runs at 4 Mbaud, and vendor bulk alone measures 250 KiB/s through the box, so
                every class at once cannot be delivered. A subscription has to be able to say{' '}
                <em>which endpoint</em> it means. Delivery is ranked in three strict-priority queues:
                input and bus first, then the byte-oriented traffic classes, then vendor bulk. Under a
                busy mouse, bulk can starve to nothing. That is deliberate: a half-delivered bulk trace
                looks like data, so an absent one is the more honest failure.
              </p>
            </div>
          </div>

          <div id="catchfilter" data-search-target>
            <div class="api-response-label">CatchFilter (frozen dataclass)</div>
            <p>
              One subscription entry: a class, an id inside it, a direction, and how many bytes to keep
              per event. Pass one or an iterable of them to{' '}
              <A href="/bindings/python/api#streams"><code>dev.catch_events()</code></A>. Build with
              the class methods and refine with the <code>with_*</code> methods, which return a new
              filter rather than mutating in place.
            </p>
            <pre class="api-signature">{`CatchFilter.all()                    -> CatchFilter   # class ANY, every id, both directions
CatchFilter.of_class(cls)            -> CatchFilter   # one whole class
CatchFilter.addr(cls, id)            -> CatchFilter   # one id inside a class

  .with_direction(direction)         -> CatchFilter   # a LockDirection, default BOTH
  .with_snaplen(n)                   -> CatchFilter   # bytes kept per event, default 0 = all

CatchFilter.addr(CatchClass.VEND_INTR, 0x83).with_snaplen(16)`}</pre>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>cls</code></td><td><A href="/bindings/python/types#catchclass"><code>CatchClass</code></A></td><td>the address class. Named <code>cls</code> because <code>class</code> is a Python keyword.</td></tr>
                <tr><td><code>id</code></td><td><code>int</code></td><td>class-specific id, or <code>CATCH_ID_ALL</code> (<code>0xFFFF</code>) for every id in the class. Defaults to <code>CATCH_ID_ALL</code>.</td></tr>
                <tr><td><code>direction</code></td><td><A href="/bindings/python/types#lockdirection"><code>LockDirection</code></A></td><td>for an input class, the press/release edge, exactly as for a lock; for a traffic class, the transfer direction, where <code>POSITIVE</code> is IN (device to PC) and <code>NEGATIVE</code> is OUT (PC to device). No class is both, so one field carries either reading. Defaults to <code>BOTH</code>.</td></tr>
                <tr><td><code>snaplen</code></td><td><code>int</code></td><td>bytes captured per event; <code>0</code> = the whole packet. Defaults to <code>0</code>.</td></tr>
              </tbody>
            </table>
            <p>
              <code>snaplen</code> is per entry because the useful value differs by orders of magnitude
              between classes: a 64-byte vendor interrupt report is worth keeping whole, while a bulk
              pipe traced only for its framing wants 16 bytes and nothing more. Matching is
              most-specific-first: an exact <code>(cls, id)</code> beats a class blanket, which beats{' '}
              <code>CatchClass.ANY</code>, and ties go to the earlier filter. The winning entry
              supplies the <code>snaplen</code>. So "everything at 16 bytes, except endpoint{' '}
              <code>0x83</code> in full" is two filters, not a special case.
            </p>
            <div class="callout callout--warning">
              <p>
                The box's table holds 32 entries and subscribing is{' '}
                <A href="/native/injection#fire-and-forget">fire-and-forget</A>, so a refused filter
                raises nothing. It shows up as an absence: read{' '}
                <A href="/bindings/python/api#queries"><code>dev.query_catch()</code></A> and compare{' '}
                <A href="/bindings/python/types#catchstate"><code>CatchState.entries</code></A> against
                what you sent, with <code>table_full</code> telling you the table was the reason. A
                class the firmware doesn't know, a direction outside the three values, and{' '}
                <code>CatchClass.ANY</code> carrying a real id are refused the same way.{' '}
                <code>id</code> is class-specific, so a wildcard class with a specific id addresses
                nothing coherent.
              </p>
            </div>
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
              Which of the box's two chips stamped an event's <code>ts_us</code>. Both{' '}
              <A href="/native/hardware">ESP32-S3s</A> boot independently, so nothing relates their
              timers and the domain has to travel with each stamp.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>Stamped</th><th>Covers</th></tr></thead>
              <tbody>
                <tr><td><code>HOST</code></td><td><code>0</code></td><td>in USB interrupt context, when the real device's transfer completed</td><td>motion, usages, <code>HID_IN</code>, and IN transfers on <code>VEND_INTR / VEND_BULK</code></td></tr>
                <tr><td><code>DEVICE</code></td><td><code>1</code></td><td>at the tap on the clone side</td><td><code>HID_OUT</code>, every OUT transfer, and <code>CONTROL / EMIT / BUS</code></td></tr>
              </tbody>
            </table>
            <p>
              A stamp is only meaningful against another from the same domain. Both clocks are
              box-local, unrelated to any PC clock, wrap every ~71.6 minutes, and restart at zero when
              that chip reboots, so a value below the previous one is a wrap, a reboot, or a domain
              change. To put the two domains on one timeline, apply the measured offset in{' '}
              <A href="/bindings/python/types#clockestimate"><code>ClockEstimate</code></A> and respect
              its error bound.
            </p>
          </div>

          <div id="busevent" data-search-target>
            <div class="api-response-label">BusEvent</div>
            <p>
              The kind of a <code>CatchClass.BUS</code>{' '}
              <A href="/bindings/python/types#trafficevent"><code>TrafficEvent</code></A>: read it from{' '}
              <code>flags</code>, and its two arguments from <code>data</code>. These already drive{' '}
              <A href="/bindings/python/types#health"><code>Health</code></A> bits and{' '}
              <A href="/bindings/python/types#stats"><code>Stats</code></A> counters; what catching
              them adds is a timestamped ordering, so you can see <em>when</em> a reconfiguration
              happened relative to the report stream that stopped.
            </p>
            <table class="api-params">
              <thead><tr><th>Member</th><th>Value</th><th>data bytes</th></tr></thead>
              <tbody>
                <tr><td><code>RESET</code></td><td><code>0</code></td><td>-</td></tr>
                <tr><td><code>SUSPEND</code></td><td><code>1</code></td><td>-</td></tr>
                <tr><td><code>RESUME</code></td><td><code>2</code></td><td>-</td></tr>
                <tr><td><code>CONFIGURED</code></td><td><code>3</code></td><td>configuration index</td></tr>
                <tr><td><code>DECONFIGURED</code></td><td><code>4</code></td><td>-</td></tr>
                <tr><td><code>SET_INTERFACE</code></td><td><code>5</code></td><td>interface, alternate setting</td></tr>
                <tr><td><code>DEV_ATTACHED</code></td><td><code>6</code></td><td>-</td></tr>
                <tr><td><code>DEV_DETACHED</code></td><td><code>7</code></td><td>-</td></tr>
                <tr><td><code>CLONE_UP</code></td><td><code>8</code></td><td>-</td></tr>
                <tr><td><code>CLONE_DOWN</code></td><td><code>9</code></td><td>-</td></tr>
              </tbody>
            </table>
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
          <CardHeader title="Wire enums" subtitle="MotionKind · Class · FrameType" />
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

          <div id="inputkind" data-search-target>
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
            <pre class="api-signature">{`Usage.button(button) -> Usage
Usage.key(key)       -> Usage
Usage.media(media)   -> Usage`}</pre>
            <p>An injection target for <A href="/bindings/python/api#inject"><code>dev.inject(input, action)</code></A>. See <A href="/library/inject">Inject</A>.</p>
          </div>

          <div id="motion" data-search-target>
            <div class="api-response-label">Motion</div>
            <pre class="api-signature">{`Motion.cursor(dx, dy) -> Motion
Motion.wheel(delta)   -> Motion`}</pre>
            <p>A relative axis drive for <A href="/bindings/python/api#move"><code>dev.move_axis(motion)</code></A>. See <A href="/library/move">Move</A>.</p>
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
                <tr><td><code>is_locked(target, direction)</code></td><td><code>bool</code></td><td>test one <A href="/bindings/python/types#locktarget"><code>LockTarget</code></A> + <A href="/bindings/python/types#lockdirection"><code>LockDirection</code></A>; also true when a whole-class blanket covers it</td></tr>
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
              The live subscription table read back from the box, plus the counters and the clock
              estimate that go with it. Since <A href="/bindings/python/api#streams"><code>catch_events()</code></A>{' '}
              gets no reply, this is the only way to see which filters the box actually holds.
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
              One row of the box's table. It is the <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A>{' '}
              you sent, as the box stored it, with a drop count attached.
            </p>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>cls</code></td><td><A href="/bindings/python/types#catchclass"><code>CatchClass</code></A></td><td>the address class</td></tr>
                <tr><td><code>id</code></td><td><code>int</code></td><td>the id, or <code>CATCH_ID_ALL</code> for a class blanket (one entry, never expanded per id)</td></tr>
                <tr><td><code>direction</code></td><td><A href="/bindings/python/types#lockdirection"><code>LockDirection</code></A></td><td>the edge or transfer direction</td></tr>
                <tr><td><code>snaplen</code></td><td><code>int</code></td><td>bytes captured per event; <code>0</code> = the whole packet</td></tr>
                <tr><td><code>dropped</code></td><td><code>int</code></td><td>events <em>this</em> entry could not queue</td></tr>
              </tbody>
            </table>
            <p>
              The drop count is per entry because the box-wide one cannot answer the question you
              actually have. Under a saturating bulk trace it tells you events are being lost, not
              which subscription is losing them, and those are different problems: one is a broken
              trace, the other is a trace you can fix by narrowing a filter or dropping its{' '}
              <code>snaplen</code>.
            </p>
          </div>

          <div id="clockestimate" data-search-target>
            <div class="api-response-label">ClockEstimate (CatchState.clock)</div>
            <table class="api-params">
              <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>offset_us</code></td><td><code>int</code></td><td>the host chip's clock minus the device chip's, in µs (signed)</td></tr>
                <tr><td><code>rate_ppb</code></td><td><code>int</code></td><td>relative drift between the two chips, parts per billion (signed)</td></tr>
                <tr><td><code>delay_us</code></td><td><code>int</code></td><td>the best measured round trip in the window; the offset is good to about half of it</td></tr>
                <tr><td><code>age_ms</code></td><td><code>Optional[int]</code></td><td>age of the estimate, or <code>None</code> when there is no estimate yet</td></tr>
              </tbody>
            </table>
            <p>
              The box measures the offset with a four-timestamp exchange across the inter-chip link,
              stamped as each frame reaches the wire rather than when it is queued: queueing is the
              largest and most variable delay on that link, and stamping late removes it from the
              measurement instead of filtering around it afterwards. <code>rate_ppb</code> is there so
              a caller can extrapolate between exchanges instead of trusting a stale offset, which
              two independent crystals make stale at up to 20 µs per second. <code>age_ms is None</code>{' '}
              is the wire's <code>0xFFFF</code>, which exists to separate "no estimate yet" from "the
              offset happens to be zero"; both report <code>offset_us == 0</code>.
            </p>
            <div class="callout callout--info">
              <p>
                Applying the offset is optional. Each event's{' '}
                <A href="/bindings/python/types#clockdomain"><code>clk</code></A> stays authoritative,
                so a program that would rather not approximate can simply refuse to subtract stamps
                across domains.
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
            <A href="/bindings/python/api#streams"><code>dev.catch_events()</code></A> yields <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A> and{' '}
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
                <tr><td><code>clk</code></td><td><A href="/bindings/python/types#clockdomain"><code>ClockDomain</code></A></td><td>which chip stamped <code>ts_us</code>. Two stamps are directly comparable only when this matches; across domains, apply <A href="/bindings/python/types#clockestimate"><code>CatchState.clock</code></A>.</td></tr>
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
                <tr><td><code>clk</code></td><td><A href="/bindings/python/types#clockdomain"><code>ClockDomain</code></A></td><td>the domain that stamped the event, mirroring <code>CatchEvent.clk</code>. Always <code>HOST</code>: physical motion is stamped when the real device's transfer completed.</td></tr>
              </tbody>
            </table>
          </div>

          <div id="usagesnapshot" data-search-target>
            <div class="api-response-label">UsageSnapshot</div>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>usages</code></td><td><code>List[Usage]</code></td><td>every held <A href="/bindings/python/types#input"><code>Usage</code></A> (button, key, or media; modifiers are key usages <code>0xE0</code> to <code>0xE7</code>)</td></tr>
                <tr><td><code>clk</code></td><td><A href="/bindings/python/types#clockdomain"><code>ClockDomain</code></A></td><td>the domain that stamped the event, mirroring <code>CatchEvent.clk</code>. Always <code>HOST</code>.</td></tr>
                <tr><td><code>is_held(usage)</code></td><td><code>bool</code></td><td>test a <A href="/bindings/python/types#input"><code>Usage</code></A> in the snapshot</td></tr>
              </tbody>
            </table>
            <p>
              Only held usages that resolve against your filters appear, and no event is emitted when
              none do, so a subscription to one button stays sparse even while the mouse reports at
              1 kHz.
            </p>
          </div>

          <div id="trafficevent" data-search-target>
            <div class="api-response-label">TrafficEvent</div>
            <p>
              The payload for every byte-oriented <A href="/bindings/python/types#catchclass"><code>CatchClass</code></A>{' '}
              from <code>HID_IN</code> to <code>BUS</code>: one packet, one control transaction, or one
              bus event, with whatever <code>snaplen</code> let through.
            </p>
            <table class="api-params">
              <thead><tr><th>Field / method</th><th>Type</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>cls</code></td><td><A href="/bindings/python/types#catchclass"><code>CatchClass</code></A></td><td>which class produced it</td></tr>
                <tr><td><code>id</code></td><td><code>int</code></td><td>endpoint address, interface number, or endpoint number, per the class</td></tr>
                <tr><td><code>direction</code></td><td><A href="/bindings/python/types#lockdirection"><code>LockDirection</code></A></td><td><code>POSITIVE</code> = IN (device to PC), <code>NEGATIVE</code> = OUT (PC to device)</td></tr>
                <tr><td><code>flags</code></td><td><code>int</code></td><td>class-specific, see the table below</td></tr>
                <tr><td><code>true_len</code></td><td><code>int</code></td><td>the packet's length <em>before</em> <code>snaplen</code> truncation</td></tr>
                <tr><td><code>data</code></td><td><code>bytes</code></td><td>the captured bytes, at most 500 of them (the frame's 512-byte payload ceiling minus the 12-byte traffic header)</td></tr>
                <tr><td><code>truncated()</code></td><td><code>bool</code></td><td><code>len(data) &lt; true_len</code>: bytes were cut</td></tr>
              </tbody>
            </table>
            <p>
              <code>true_len</code> is what makes a truncated capture self-describing. Without it, a
              packet clipped by <code>snaplen</code> and a genuinely short packet look identical, and
              you would be reading a length that is really a capture setting.
            </p>
            <div class="api-response-label">FLAGS, BY CLASS</div>
            <table class="api-params">
              <thead><tr><th>Class</th><th>flags</th></tr></thead>
              <tbody>
                <tr><td><code>VEND_BULK</code></td><td>b0 end-of-transfer, b1 zero-length packet</td></tr>
                <tr><td><code>CONTROL</code></td><td>the real device's answer: <code>0</code> OK, <code>0xFD</code> it STALLed, <code>0xFE</code> it NAKed to timeout</td></tr>
                <tr><td><code>BUS</code></td><td>the <A href="/bindings/python/types#busevent"><code>BusEvent</code></A> kind; <code>data</code> holds its two argument bytes</td></tr>
                <tr><td>everything else</td><td><code>0</code></td></tr>
              </tbody>
            </table>
            <p>
              A <code>CONTROL</code> event is one <em>completed transaction</em>, not one stage:{' '}
              <code>data</code> is <code>[setup 8][data…]</code> and <code>direction</code> says which
              way the data stage went, so nothing has to reassemble the halves downstream. Requests the
              box answers from its own descriptor cache still produce an event, because a trace that
              hid those would show a device that had stopped being asked.
            </p>
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
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Types;
