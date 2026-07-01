import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Build: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Build &amp; features" subtitle="Linking and the optional surfaces" />
        <p>
          Two files: the header <A href="/bindings/c"><code>medius.h</code></A> and the native
          library <A href="/bindings/c"><code>libmedius_capi</code></A>. Point the compiler at both
          and link. C++ is identical: same header, add <code>-std=c++17</code>. For your first
          program see the <A href="/bindings/c/quickstart">Quickstart</A>.
        </p>
      </Card>

      <div id="features" data-search-target>
        <Card>
          <CardHeader title="Feature flags" subtitle="Mock and flash, off by default" />
          <p>
            Two surfaces are gated. Each is a{' '}
            <a href="https://doc.rust-lang.org/cargo/reference/features.html" target="_blank" rel="noreferrer">cargo feature</a>{' '}
            on <code>medius-capi</code>{' '}
            <em>and</em> a matching{' '}
            <a href="https://en.cppreference.com/w/c/preprocessor/conditional" target="_blank" rel="noreferrer"><code>#ifdef</code></a>{' '}
            in the header. Build the library with the
            feature, then define the macro when you compile your code so the declarations appear.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Cargo feature</th><th>Header macro</th><th>Unlocks</th><th>What it does</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>mock</code></td>
                <td><code>MEDIUS_FEATURE_MOCK</code></td>
                <td><A href="/bindings/c/api#mock"><code>MediusMockBox</code></A>, the <code>medius_mock_*</code> calls, <code>medius_device_with_mock</code> / <code>_open_mock</code></td>
                <td>A scriptable fake box for tests. See <A href="/library/features/mock">Mock box</A>.</td>
              </tr>
              <tr>
                <td><code>flash</code></td>
                <td><code>MEDIUS_FEATURE_FLASH</code></td>
                <td><A href="/bindings/c/api#module"><code>medius_flash(port, bin_path, host)</code></A></td>
                <td>Flash firmware with <a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer">esptool</a>. See <A href="/library/features/flash">Flash firmware</A>.</td>
              </tr>
            </tbody>
          </table>
          <div class="api-response-label">BUILD WITH THE SURFACES, THEN COMPILE AGAINST THEM</div>
          <pre><code class="language-bash">{`# build the library with both surfaces
cargo build -p medius-capi --release --features mock,flash

# define the matching macros when you compile your program
cc app.c -DMEDIUS_FEATURE_MOCK -DMEDIUS_FEATURE_FLASH \\
   -I medius-capi/include -L target/release -lmedius_capi -lpthread -o app`}</code></pre>
          <div class="callout callout--warning">
            <p>
              The prebuilt tarball has <strong>neither</strong> surface. Define a macro whose symbols
              aren't in the library and you get a link error; build the library with a feature but
              forget the macro and the declarations stay hidden. The two must match.
            </p>
          </div>
        </Card>
      </div>

      <div id="loading" data-search-target>
        <Card>
          <CardHeader title="Linking &amp; loading" subtitle="Header, library, and the flags that find them" />
          <p>
            Get the two files from a <A href="/bindings/c/build#packaging">release tarball</A>, or
            build the <a href="https://github.com/K4HVH/medius" target="_blank" rel="noreferrer">crate</a>{' '}
            yourself with the{' '}
            <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a>{' '}
            (<code>cargo build -p medius-capi --release</code> writes them under{' '}
            <code>target/release/</code>). Then three flags wire them in.
          </p>
          <pre class="diagram">{`  compile  ──▶  your code + medius.h
  link     ──▶  + libmedius_capi
  run      ──▶  load libmedius_capi`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Flag</th><th>Points at</th><th>Example</th></tr>
            </thead>
            <tbody>
              <tr><td><code>-I&lt;dir&gt;</code></td><td>the directory holding <code>medius.h</code></td><td><code>-I medius-capi/include</code></td></tr>
              <tr><td><code>-L&lt;dir&gt;</code></td><td>the directory holding the library</td><td><code>-L target/release</code></td></tr>
              <tr><td><code>-lmedius_capi</code></td><td>the library itself (the linker adds the <code>lib</code> prefix and extension)</td><td>resolves <code>libmedius_capi.so</code></td></tr>
              <tr><td><a href="https://man7.org/linux/man-pages/man7/pthreads.7.html" target="_blank" rel="noreferrer"><code>-lpthread</code></a></td><td>Linux only; the core spawns reader/keepalive threads</td><td>append after <code>-lmedius_capi</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">PER-OS LIBRARY FILENAME</div>
          <table class="api-params">
            <thead>
              <tr><th>OS</th><th>Shared library</th><th>Static library</th><th>Note</th></tr>
            </thead>
            <tbody>
              <tr><td>Linux</td><td><code>libmedius_capi.so</code></td><td><code>libmedius_capi.a</code></td><td>add <code>-lpthread</code></td></tr>
              <tr><td>macOS</td><td><code>libmedius_capi.dylib</code></td><td><code>libmedius_capi.a</code></td><td>none</td></tr>
              <tr><td>Windows</td><td><code>medius_capi.dll</code></td><td><code>medius_capi.lib</code></td><td>link <code>medius_capi.dll.lib</code> (import) or <code>.lib</code> (static); no <code>lib</code> prefix</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">COMPILE A ONE-LINE SANITY CHECK</div>
          <pre><code class="language-c">{`// hello.c: proves the library links and loads
#include <medius.h>
#include <stdio.h>

int main(void) {
    printf("medius %s, abi %u\\n", medius_version_string(), medius_abi_version());
    return 0;
}`}</code></pre>
          <pre><code class="language-bash">{`cc hello.c -I medius-capi/include -L target/release -lmedius_capi -lpthread -o hello
LD_LIBRARY_PATH=target/release ./hello
# medius 2.3.0, abi 1`}</code></pre>
          <div class="callout callout--info">
            <p>
              <code>-L</code> only helps the linker. The shared
              library must also be findable by the dynamic loader when the program <em>runs</em>:
              Linux <code>LD_LIBRARY_PATH</code> or an rpath, macOS <code>DYLD_LIBRARY_PATH</code> /{' '}
              <code>@rpath</code>, Windows the <code>.dll</code> next to the exe or on <code>PATH</code>.
              Or link the static library (<code>.a</code> / <code>.lib</code>) to fold it into your
              binary and skip the run-time hunt.
            </p>
          </div>
        </Card>
      </div>

      <div id="packaging" data-search-target>
        <Card>
          <CardHeader title="Packaging" subtitle="Prebuilt tarballs, no vcpkg or Conan port" />
          <p>
            Each release attaches one tarball per platform,{' '}
            <code>medius-capi-&lt;target-triple&gt;.tar.gz</code>, to the{' '}
            <a href="https://github.com/K4HVH/medius/releases" target="_blank" rel="noreferrer">GitHub
            Release</a>. Download, unpack, and use the flags above.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Inside the tarball</th><th>Contents</th></tr>
            </thead>
            <tbody>
              <tr><td><code>include/medius.h</code></td><td>the header (mock/flash declarations gated by the macros)</td></tr>
              <tr><td><code>lib/</code></td><td>the prebuilt <code>libmedius_capi</code>, shared and static, with mock and flash off</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              No <a href="https://vcpkg.io" target="_blank" rel="noreferrer">vcpkg</a> or{' '}
              <a href="https://conan.io" target="_blank" rel="noreferrer">Conan</a> port: those build
              C and C++ from source with no Rust toolchain, so a Rust-backed library doesn't fit. Use
              the prebuilt tarball, or build <code>medius-capi</code> from source. Python uses the{' '}
              <A href="/bindings/python">prebuilt wheel</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Build;
