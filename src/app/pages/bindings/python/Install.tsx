import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../../shell/PageHeader';
import { DocSection } from '../../../shell/DocSection';

const Install: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          Install with{' '}
          <a href="https://pip.pypa.io" target="_blank" rel="noreferrer">pip</a>; no compile step:
        </p>
        <pre><code class="language-bash">pip install medius</code></pre>
        <p>
          The{' '}
          <A href="/bindings">Bindings overview</A> shows how the package, the{' '}
          <A href="/bindings/c">C ABI</A> and the Rust{' '}
          <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">medius crate</a>{' '}
          relate.
        </p>
      </PageHeader>

      <DocSection id="requirements" title="Requirements" caption="Python version and platform">
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Requirement</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Python</td><td><code>3.8</code> or newer</td></tr>
              <tr><td>Platforms with a prebuilt <a href="https://packaging.python.org/en/latest/specifications/binary-distribution-format/" target="_blank" rel="noreferrer">wheel</a></td><td>Linux (<a href="https://www.gnu.org/software/libc/" target="_blank" rel="noreferrer">glibc</a> / <a href="https://github.com/pypa/manylinux" target="_blank" rel="noreferrer">manylinux</a>), macOS, Windows x64</td></tr>
              <tr><td><a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a></td><td>not needed</td></tr>
              <tr><td>Other Python packages</td><td>none</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <a href="https://musl.libc.org" target="_blank" rel="noreferrer">musl</a> Linux and 32-bit
          Windows have no wheel: <code>pip</code> builds from source and needs a Rust toolchain (see{' '}
          <A href="/bindings/python/build">Build &amp; features</A>).
        </p>
      </DocSection>

      <DocSection id="verify" title="Verify" caption="Print the version">
        <p>
          A printed version means you're set for the{' '}
          <A href="/bindings/python/quickstart">first program</A>.
        </p>
        <pre><code class="language-bash">{`python -c "import medius; print(medius.version_string(), 'abi', medius.abi_version())"
# 3.4.3 abi 9`}</code></pre>
        <div class="callout callout--warning">
          <p>
            An <code><a href="https://docs.python.org/3/library/exceptions.html#OSError" target="_blank" rel="noreferrer">OSError</a></code> on import means the library didn't load: an unsupported
            platform, or a bad <code>MEDIUS_LIB</code> path. See{' '}
            <A href="/bindings/python/build#loading">how the library is found</A>.
          </p>
          <p>
            An <code><a href="https://docs.python.org/3/library/exceptions.html#ImportError" target="_blank" rel="noreferrer">ImportError</a></code> naming two ABI numbers means library and package come
            from different releases: install the matching package, or point <code>MEDIUS_LIB</code>{' '}
            at a library from the same release.
          </p>
        </div>
      </DocSection>

      <DocSection id="connect" title="Connect" caption="Open a box, read its version">
        <p>
          <A href="/bindings/python/api#connect"><code>Device.find()</code></A> opens the first{' '}
          <A href="/native/hardware">box</A> it finds and runs the{' '}
          <A href="/native/connection#handshake">handshake</A>; the{' '}
          <code><a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer">with</a></code>{' '}
          block closes the link on exit.
        </p>
        <pre><code class="language-python">{`from medius import Device

with Device.find() as dev:
    v = dev.query_version()
    print(f"firmware {v.fw_major}.{v.fw_minor}.{v.fw_patch}, proto {v.proto_ver}")`}</code></pre>
        <p>
          With no port, <code>find()</code> raises{' '}
          <A href="/bindings/python/types#subclasses"><code>NotFoundError</code></A>. Pass a path
          with <A href="/bindings/python/api#connect"><code>Device.open("/dev/ttyACM0")</code></A>{' '}
          (Windows: <code>"COM3"</code>), or list ports with{' '}
          <A href="/bindings/python/api#connect"><code>medius.find_ports()</code></A>. Errors:{' '}
          <A href="/bindings/python/usage#errors">Calls &amp; errors</A>.
        </p>
      </DocSection>
    </>
  );
};

export default Install;
