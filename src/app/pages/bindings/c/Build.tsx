import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Build: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Build & features" subtitle="Linking and optional features" />
        <p>
          Two files: the header <A href="/bindings/c"><code>medius.h</code></A> and the library{' '}
          <A href="/bindings/c"><code>libmedius_capi</code></A>. C++ uses the same header with{' '}
          <code>-std=c++17</code>. First program: <A href="/bindings/c/quickstart">Quickstart</A>.
        </p>
      </Card>

      <div id="features" data-search-target>
        <Card>
          <CardHeader title="Feature flags" subtitle="Mock, off by default" />
          <p>
            Mock is a{' '}
            <a href="https://doc.rust-lang.org/cargo/reference/features.html" target="_blank" rel="noreferrer">cargo feature</a>{' '}
            on <code>medius-capi</code>{' '}
            <em>and</em> a matching{' '}
            <a href="https://en.cppreference.com/w/c/preprocessor/conditional" target="_blank" rel="noreferrer"><code>#ifdef</code></a>{' '}
            in the header.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Cargo feature</th><th>Header macro</th><th>Declares</th><th>What it does</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>mock</code></td>
                <td><code>MEDIUS_FEATURE_MOCK</code></td>
                <td><A href="/bindings/c/api#mock"><code>MediusMockBox</code></A>, the <code>medius_mock_*</code> calls, <code>medius_device_with_mock</code> / <code>_open_mock</code></td>
                <td>A scriptable fake box for tests. See <A href="/library/features/mock">Mock box</A>.</td>
              </tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-bash">{`# build the library with mock
cargo build -p medius-capi --release --features mock

# define the matching macro when compiling
cc app.c -DMEDIUS_FEATURE_MOCK \\
   -I medius-capi/include -L target/release -lmedius_capi -lpthread -o app`}</code></pre>
          <div class="callout callout--warning">
            <p>
              The prebuilt tarball is built <strong>without</strong> it. The macro without the
              feature is a link error; the feature without the macro leaves the declarations hidden.
            </p>
          </div>
        </Card>
      </div>

      <div id="loading" data-search-target>
        <Card>
          <CardHeader title="Linking & loading" subtitle="Header, library, and their flags" />
          <p>
            Get the two files from a <A href="/bindings/c/build#packaging">release tarball</A>, or
            build the <a href="https://github.com/K4HVH/medius" target="_blank" rel="noreferrer">crate</a>{' '}
            with the{' '}
            <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a>{' '}
            (<code>cargo build -p medius-capi --release</code> writes them under{' '}
            <code>target/release/</code>).
          </p>
          <pre class="diagram">{`  compile  ──▶  needs your code + medius.h
  link     ──▶  adds libmedius_capi
  run      ──▶  loads libmedius_capi`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Flag</th><th>Points at</th><th>Example</th></tr>
            </thead>
            <tbody>
              <tr><td><code>-I&lt;dir&gt;</code></td><td>the directory holding <code>medius.h</code></td><td><code>-I medius-capi/include</code></td></tr>
              <tr><td><code>-L&lt;dir&gt;</code></td><td>the directory holding the library</td><td><code>-L target/release</code></td></tr>
              <tr><td><code>-lmedius_capi</code></td><td>the library (the linker adds the <code>lib</code> prefix and extension)</td><td>resolves <code>libmedius_capi.so</code></td></tr>
              <tr><td><a href="https://man7.org/linux/man-pages/man7/pthreads.7.html" target="_blank" rel="noreferrer"><code>-lpthread</code></a></td><td>Linux only; the core spawns reader/keepalive threads</td><td>append after <code>-lmedius_capi</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">LIBRARY FILENAMES</div>
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
          <div class="api-response-label">SANITY CHECK</div>
          <pre><code class="language-c">{`// hello.c: proves the library links and loads
#include <medius.h>
#include <stdio.h>

int main(void) {
    printf("medius %s, abi %u\\n", medius_version_string(), medius_abi_version());
    return 0;
}`}</code></pre>
          <pre><code class="language-bash">{`cc hello.c -I medius-capi/include -L target/release -lmedius_capi -lpthread -o hello
LD_LIBRARY_PATH=target/release ./hello
# medius 3.4.2, abi 9`}</code></pre>
          <div class="callout callout--info">
            <p>
              <code>-L</code> is link-time only. At <em>run</em> time the loader finds the shared
              library via Linux <code>LD_LIBRARY_PATH</code> or an rpath, macOS <code>DYLD_LIBRARY_PATH</code> /{' '}
              <code>@rpath</code>, Windows the <code>.dll</code> next to the exe or on <code>PATH</code>.
            </p>
            <p>
              Or link the static library (<code>.a</code> / <code>.lib</code>) into the binary.
            </p>
          </div>
        </Card>
      </div>

      <div id="packaging" data-search-target>
        <Card>
          <CardHeader title="Packaging" subtitle="Prebuilt tarballs, no vcpkg or Conan port" />
          <p>
            Each <a href="https://github.com/K4HVH/medius/releases" target="_blank" rel="noreferrer">GitHub
            Release</a> attaches one tarball per platform,{' '}
            <code>medius-capi-&lt;target-triple&gt;.tar.gz</code>. Unpack it and use the flags above.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Inside the tarball</th><th>Contents</th></tr>
            </thead>
            <tbody>
              <tr><td><code>include/medius.h</code></td><td>the header (mock declarations gated by the macro)</td></tr>
              <tr><td><code>lib/</code></td><td>the prebuilt <code>libmedius_capi</code>, shared and static, with mock off</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              No <a href="https://vcpkg.io" target="_blank" rel="noreferrer">vcpkg</a> or{' '}
              <a href="https://conan.io" target="_blank" rel="noreferrer">Conan</a> port (both build
              from source without a Rust toolchain). Use the prebuilt tarball or build{' '}
              <code>medius-capi</code> from source. Python uses the{' '}
              <A href="/bindings/python/build#packaging">prebuilt wheel</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Build;
