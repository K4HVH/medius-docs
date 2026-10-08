import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { IndexRow } from '../../shell/IndexRow';

const Introduction: Component = () => {
  return (
    <>
      <PageHeader lead="Official Rust client">
        <p>
          The <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer"><code>medius</code></a> crate
          injects input on top of a real mouse, keyboard, or combo over a USB-serial link.
        </p>
        <table class="api-params">
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Crate version</td>
              <td><code>3.4.3</code></td>
            </tr>
            <tr>
              <td><a href="https://doc.rust-lang.org/edition-guide/rust-2024/index.html" target="_blank" rel="noreferrer">Edition</a></td>
              <td><code>2024</code></td>
            </tr>
            <tr>
              <td><a href="https://doc.rust-lang.org/cargo/reference/rust-version.html" target="_blank" rel="noreferrer">MSRV</a> (minimum supported Rust version)</td>
              <td><code>1.85</code></td>
            </tr>
            <tr>
              <td>License</td>
              <td><a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer"><code>MIT</code></a></td>
            </tr>
            <tr>
              <td>Transport</td>
              <td>6 Mbaud, framed-only</td>
            </tr>
            <tr>
              <td>Thread safety</td>
              <td><code>Send + Sync</code> (clone freely)</td>
            </tr>
            <tr>
              <td>Safety</td>
              <td><code>#![forbid(unsafe_code)]</code>; on Windows, <code>unsafe</code> only in the serial read's comm-event wait</td>
            </tr>
          </tbody>
        </table>
      </PageHeader>

      <DocSection id="installation" title="Installation">
        <pre><code class="language-bash">cargo add medius</code></pre>
        <p>With optional features:</p>
        <pre><code class="language-bash">cargo add medius --features async,mock</code></pre>
        <table class="api-params">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><A href="/library/features/async"><code>async</code></A></td>
              <td>Runtime-agnostic <code>AsyncDevice</code>, async queries.</td>
            </tr>
            <tr>
              <td><A href="/library/features/mock"><code>mock</code></A></td>
              <td>In-process fake box for tests.</td>
            </tr>

            <tr>
              <td><A href="/library/features/tracing"><code>tracing</code></A></td>
              <td>Tracing across the connection lifecycle.</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection id="getting-started" title="Getting started">
        <IndexRow href="/library/connection" title="Connection" tag="Open, find, handshake" />
        <IndexRow href="/library/discovery" title="Discovery" tag="List boxes, open by identity" />
      </DocSection>

      <DocSection id="api" title="API">
        <IndexRow href="/library/inject" title="Inject" tag="press, release, force_release" />
        <IndexRow href="/library/move" title="Move" tag="move_axis, move_rel, wheel, riding override" />
        <IndexRow href="/library/lock" title="Lock" tag="scale, lock, unlock, scale_all" />
        <IndexRow href="/library/catch" title="Catch" tag="Stream input and raw traffic" />
        <IndexRow href="/library/transform" title="Transform" tag="transform, untransform, query_transforms" />
        <IndexRow href="/library/clip" title="Clip" tag="Preload input, box-clocked playback" />
        <IndexRow href="/library/requests" title="Requests" tag="version, health, device info" />
        <IndexRow href="/library/led" title="LED" tag="Status LED" />
        <IndexRow href="/library/admin" title="Admin" tag="reset, reboot" />
        <IndexRow href="/library/update" title="Update" tag="update_firmware, stage_firmware, activate_firmware" />
        <IndexRow href="/library/options" title="Options" tag="imperfect clones, riding, bearing, emit pace, name" />
        <IndexRow href="/library/lifecycle" title="Lifecycle" tag="reapply, reconnect, session recovery" />
        <IndexRow href="/library/diagnostics" title="Logs & counters" tag="Read logs, snapshot counters" />
      </DocSection>

      <DocSection id="advanced" title="Advanced control">
        <IndexRow href="/library/advanced/raw" title="Raw injection" tag="raw" />
        <IndexRow href="/library/advanced/transfer" title="Control transfers" tag="transfer, transfer_timeout" />
        <IndexRow href="/library/advanced/rewrite" title="Rewrite rules" tag="set_rewrite, remove_rewrite, clear_rewrite" />
        <IndexRow href="/library/advanced/patch" title="Descriptor patches" tag="set_patch, apply_patch, clear_patch" />
      </DocSection>

      <DocSection id="features" title="Features">
        <IndexRow href="/library/features/async" title="async" tag="AsyncDevice" />
        <IndexRow href="/library/features/mock" title="mock" tag="In-process fake box" />
        <IndexRow href="/library/features/tracing" title="tracing" tag="Structured diagnostics" />
      </DocSection>

      <DocSection id="guides" title="Guides" caption="Behaviour and how-to">
        <IndexRow href="/library/guides/calls" title="Calls & input" tag="Call kinds, async, motion, clicks" />
        <IndexRow href="/library/guides/connection" title="Connection" tag="Ports, threads, keepalive" />
        <IndexRow href="/library/guides/testing" title="Testing" tag="MockBox in tests" />
      </DocSection>

      <DocSection id="reference" title="Reference">
        <IndexRow href="/library/types" title="Types & errors" tag="Enums, Result, Error" />
      </DocSection>
    </>
  );
};

export default Introduction;
