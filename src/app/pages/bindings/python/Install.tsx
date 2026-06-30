import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Install: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Install" subtitle="pip install medius" />
        <p>
          Install with{' '}
          <a href="https://pip.pypa.io" target="_blank" rel="noreferrer">pip</a>. No compile step:
        </p>
        <pre><code class="language-bash">pip install medius</code></pre>
        <p>
          Prebuilt{' '}
          <a href="https://packaging.python.org/en/latest/specifications/binary-distribution-format/" target="_blank" rel="noreferrer">wheels</a>{' '}
          cover Linux, macOS, and 64-bit Windows. The{' '}
          <A href="/bindings">Bindings overview</A> shows how the Python package, the{' '}
          <A href="/bindings/c">C ABI</A>, and the Rust{' '}
          <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">medius crate</a>{' '}
          fit together.
        </p>
      </Card>

      <div id="requirements" data-search-target>
        <Card>
          <CardHeader title="Requirements" subtitle="What you need" />
          <table class="api-params">
            <thead>
              <tr><th>Requirement</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Python</td><td><code>3.8</code> or newer</td></tr>
              <tr><td>Platforms with a prebuilt wheel</td><td>Linux (<a href="https://www.gnu.org/software/libc/" target="_blank" rel="noreferrer">glibc</a> / <a href="https://github.com/pypa/manylinux" target="_blank" rel="noreferrer">manylinux</a>), macOS, Windows x64</td></tr>
              <tr><td><a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a></td><td>not needed</td></tr>
              <tr><td>Other Python packages</td><td>none; it uses the standard library's <code><a href="https://docs.python.org/3/library/ctypes.html" target="_blank" rel="noreferrer">ctypes</a></code></td></tr>
            </tbody>
          </table>
          <p>
            On <a href="https://musl.libc.org" target="_blank" rel="noreferrer">musl</a> Linux or
            32-bit Windows there's no prebuilt wheel, so <code>pip</code> builds
            from source and needs a Rust toolchain. Those users follow{' '}
            <A href="/bindings/python/build">Build &amp; features</A>.
          </p>
        </Card>
      </div>

      <div id="verify" data-search-target>
        <Card>
          <CardHeader title="Verify" subtitle="Print the version" />
          <p>
            If this prints a version, you're ready for your{' '}
            <A href="/bindings/python/quickstart">first program</A>.
          </p>
          <pre><code class="language-bash">{`python -c "import medius; print(medius.version_string(), 'abi', medius.abi_version())"
# 2.2.0 abi 1`}</code></pre>
          <div class="callout callout--warning">
            <p>
              An <code><a href="https://docs.python.org/3/library/exceptions.html#OSError" target="_blank" rel="noreferrer">OSError</a></code> on import means the native library didn't load: you're on an
              unsupported platform, or <code>MEDIUS_LIB</code> points somewhere bad. See{' '}
              <A href="/bindings/python/build#loading">how the library is found</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="connect" data-search-target>
        <Card>
          <CardHeader title="Connect" subtitle="Find the box, then hand it back" />
          <p>
            Here it is in three lines, so you can check the{' '}
            <A href="/native/hardware">box</A> is reachable.{' '}
            <A href="/bindings/python/api#connect"><code>Device.find()</code></A> opens the
            first box it sees and runs the{' '}
            <A href="/native/connection#handshake">handshake</A>; the{' '}
            <code><a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer">with</a></code>{' '}
            block closes the link on exit.
          </p>
          <pre><code class="language-python">{`from medius import Device

with Device.find() as dev:
    v = dev.query_version()
    print(f"firmware {v.fw_major}.{v.fw_minor}.{v.fw_patch}, proto {v.proto_ver}")`}</code></pre>
          <p>
            No port? <code>find()</code> raises{' '}
            <A href="/bindings/python/types#subclasses"><code>NotFoundError</code></A>. Pass an
            explicit path with{' '}
            <A href="/bindings/python/api#connect"><code>Device.open("/dev/ttyACM0")</code></A>{' '}
            (Windows: <code>"COM3"</code>), or list what's present with{' '}
            <A href="/bindings/python/api#connect"><code>medius.find_ports()</code></A>. Errors are
            covered on{' '}
            <A href="/bindings/python/usage#errors">Calls &amp; errors</A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Install;
