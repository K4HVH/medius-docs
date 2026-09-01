import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Render: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Render" subtitle="Draw motion with the mouse's own texture" />
        <p>
          A real mouse does not report evenly. It reports when the hand moves, in bursts, with gaps,
          and with a distribution of magnitudes particular to that sensor in that hand. The box's own
          fill has none of that: it emits one frame per tick while motion is pending, which is a shape
          no hand produces. Rendering replaces the fill with a model fitted live from the attached
          mouse's own reports, so what leaves carries that mouse's texture for the same total
          displacement.
        </p>
        <pre class="diagram">{`one correction, drained over ~12 ms     | = a report,  . = an idle ms

  Off        | | | | | | | | | | | |     even fill at the paced rate
  drawn      | | . | . . | | . | . |     the live mouse's own on/off texture`}</pre>
        <p>
          <A href="/library/render#full"><code>full</code></A> decides whose motion the model draws.
          Off, it draws what the host injects and relays the mouse's own byte for byte, so two streams
          reach the wire with two textures. On, the mouse's cursor delta leaves the relayed report and
          joins injection in the model, so one stream reaches the wire and there is no relayed motion
          left beside it to compare against.
        </p>
        <pre class="diagram">{`the wire, mouse moving and box injecting     M = the mouse's own report
                                             I = a report the box drew
  full off   M M I M M I I M M I M M I       two sources, two textures
  full on    I I I I I I I I I I I I         one source, one texture`}</pre>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Want to...</th><th>Call</th></tr></thead>
            <tbody>
              <tr><td>pick the texture, and whose motion goes through it</td><td><A href="/library/render#set-render"><code>set_render</code></A></td></tr>
              <tr><td>read it back, and whether the box has learned a profile</td><td><A href="/library/render#query-render"><code>query_render</code></A></td></tr>
              <tr><td>cap how fast the drawn stream may emit</td><td><A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <code>set_render</code> is <A href="/native/injection#fire-and-forget">fire-and-forget</A>:
          one frame, no reply, persisted in NVS. The box boots drawing injected motion with{' '}
          <code>Despiked</code>, and with <code>full</code> off.
        </p>
      </Card>

      <div id="profile" data-search-target>
        <Card>
          <CardHeader title="The profile" subtitle="Nothing is drawn until the mouse has moved" />
          <p>
            The model needs a profile of the attached device before it can draw in that device's
            style. The box builds one from the mouse's own reports on a 1 ms grid and keeps it in RAM
            only, so it is never carried across a power cut.
          </p>
          <pre class="diagram">{`  attach ──▶ observing ──▶ armed ──────────────▶ device changes ──▶ observing
             │              │                                        (profile dropped)
             │              └─ motion drawn, injection drawn
             └─ motion relayed, injection on the paced fill`}</pre>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>State</th><th>What reaches the wire</th></tr></thead>
              <tbody>
                <tr><td>observing (<code>ready</code> false)</td><td>The mouse's own reports, relayed. Injection takes the paced fill, whatever the mode says.</td></tr>
                <tr><td>armed (<code>ready</code> true)</td><td>Whatever the mode and <code>full</code> select.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--info">
            <p>
              A profile only arms off a window the mouse actually moved in: one built from stillness
              models no motion and would draw none. Once armed it stays armed until the device
              changes, which is what lets the box keep drawing while the hand is still.
            </p>
            <p>
              So every box passes through <code>ready</code> false after a power cut, and leaves it the
              first time the mouse moves. Read it with{' '}
              <A href="/library/render#query-render"><code>query_render</code></A> rather than assuming
              a set mode is a drawing box.
            </p>
          </div>
        </Card>
      </div>

      <div id="modes" data-search-target>
        <Card>
          <CardHeader title="The four textures" subtitle="What the model is fed, and what it costs" />
          <p>
            <A href="/library/types/enums#render-mode"><code>RenderMode</code></A> picks what the model
            receives. The three drawing modes differ only in the path smoother in front of it, which is
            also what decides the delay.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Value</th><th>What the model is fed</th><th>Delay it adds</th></tr></thead>
              <tbody>
                <tr><td><code>Off</code></td><td>Nothing. The box emits its own even fill.</td><td>none</td></tr>
                <tr><td><code>Stock</code></td><td>The model's own triangular smoother, bit for bit. Its first report sits above the rest.</td><td>about 5 ms</td></tr>
                <tr><td><code>Despiked</code> <em>(default)</em></td><td>The same nine taps weighted toward the newest sample, so there is no onset to spike.</td><td>about 3 ms</td></tr>
                <tr><td><code>Unsmoothed</code></td><td>The raw delta, with no smoother at all.</td><td>about 1 ms</td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--info">
            <p>
              The delay only reaches the mouse under <code>full</code>. With it off, the smoother sits
              in front of injected motion alone, which was never going to be instant.
            </p>
          </div>
        </Card>
      </div>

      <div id="full" data-search-target>
        <Card>
          <CardHeader title="Drawing your own motion" subtitle="full: one texture on the wire instead of two" />
          <p>
            With <code>full</code> off, an observer watching the wire sees the mouse's own reports and
            a drawn injected stream beside them. Those are two different textures, and the difference
            between them is itself a signature. <code>full</code> removes the comparison by taking the
            mouse's cursor delta out of the relayed report and drawing it from the same model.
          </p>
          <pre class="diagram">{`  full off      mouse ──────────────────────────▶ wire   (relayed, byte for byte)
                host  ──▶ smoother ──▶ model ───▶ wire   (drawn)

  full on       mouse ─┐
                       ├──▶ smoother ──▶ model ──▶ wire   (one stream)
                host  ─┘`}</pre>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Field</th><th>Still relayed at the mouse's own timing</th></tr></thead>
              <tbody>
                <tr><td>cursor X and Y</td><td>no, the model draws them</td></tr>
                <tr><td>buttons</td><td>yes</td></tr>
                <tr><td>wheel</td><td>yes</td></tr>
                <tr><td>vendor and mirror bytes</td><td>yes, and the mirror follows what the model emitted</td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--warning">
            <p>
              <code>full</code> puts the smoother and one frame between the mouse and the wire, so it
              costs the delay in the table above on every hand movement. That is a feel change on a
              gaming mouse, which is why it is off by default.
            </p>
            <p>
              The model emits at most 127 counts per axis per report and carries the rest as debt, so a
              flick faster than that finishes a few milliseconds after the hand made it. On the learnt
              pace that ceiling is about 4 m/s at 800 DPI and about 1 at 3200; a slower fixed pace
              lowers it in proportion.
            </p>
          </div>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Composes with</th><th>How</th></tr></thead>
              <tbody>
                <tr><td><A href="/library/lock"><code>lock</code></A> and <code>scale</code></td><td>The model receives the weighed value, so a scaled axis is drawn at its scaled size.</td></tr>
                <tr><td><A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A></td><td>The pace caps the drawn rate. On the learnt pace the model self-paces every millisecond.</td></tr>
                <tr><td><A href="/library/options#set-movement-riding"><code>set_movement_riding</code></A></td><td>Inert on the drawn stream: that stream carries your own motion, and a hoard left unridden is dropped.</td></tr>
                <tr><td><A href="/library/clip"><code>clip</code></A></td><td>Clip motion bypasses the model, so a clip playing under <code>full</code> puts a second texture on the wire.</td></tr>
                <tr><td>a second mouse collection</td><td>Only the bound primary is drawn. A secondary collection is relayed.</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="set-render" data-search-target>
        <Card>
          <CardHeader title="set_render" subtitle="Pick the texture, and whose motion goes through it" />
          <pre class="api-signature">fn set_render(&self, mode: RenderMode, full: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Parameter</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>mode</code></td><td><A href="/library/types/enums#render-mode"><code>RenderMode</code></A></td><td>The texture motion is drawn with; the box boots at <code>Despiked</code>.</td></tr>
                <tr><td><code>full</code></td><td><code>bool</code></td><td>Whether the mouse's own motion is drawn by the model rather than relayed.</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Both fields ride one frame and the box persists them together, so <code>full</code> is
            required: a default here would rewrite a setting you did not name. Nothing is drawn while{' '}
            <code>mode</code> is <code>Off</code>, whatever <code>full</code> says, and nothing is
            drawn before a <A href="/library/render#profile">profile arms</A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, RenderMode};

let device = Device::find()?;
device.set_render(RenderMode::Despiked, false)?;   // the box's own default: draw injection only
device.set_render(RenderMode::Despiked, true)?;    // draw your own motion the same way
device.set_render(RenderMode::Off, false)?;        // renderer out of the path, the paced fill`}</code></pre>
        </Card>
      </div>

      <div id="query-render" data-search-target>
        <Card>
          <CardHeader title="query_render" subtitle="Read the texture, its scope, and whether a profile has armed" />
          <pre class="api-signature">fn query_render(&self) -&gt; Result&lt;RenderStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#render-status"><code>RenderStatus</code></A>.{' '}
            <code>ready</code> is what separates a box set to a mode from a box drawing with it.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let status = device.query_render()?;
println!("{:?}, own motion drawn: {}", status.mode, status.full);
if !status.ready {
    println!("move the mouse: nothing is drawn until a profile arms");
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="set_render fires, query_render awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>set_render</code> fire-and-forget (no await) and makes <code>query_render</code> a
            future, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{AsyncDevice, RenderMode};

let device = AsyncDevice::find().await?;
device.set_render(RenderMode::Despiked, true)?;    // no await
let status = device.query_render().await?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Render;
