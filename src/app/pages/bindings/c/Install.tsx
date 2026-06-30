import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Install: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Install" subtitle="One header and one prebuilt library" />
        <p>
          The binding is one header (<code>medius.h</code>) and one prebuilt library
          (<code>libmedius_capi</code>). It's the same for C and C++. The header compiles as both, so
          a C++ program <code>#include</code>s it and calls the same functions. Nothing to build, no{' '}
          <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust</a> needed.
        </p>
      </Card>

      <div id="download" data-search-target>
        <Card>
          <CardHeader title="Download" subtitle="The release archive for your platform" />
          <p>
            On the{' '}
            <a href="https://github.com/K4HVH/medius/releases" target="_blank" rel="noreferrer">Releases page</a>,
            download the file that matches your computer, then unzip it.
          </p>
          <table class="api-params">
            <thead><tr><th>Your computer</th><th>File to download</th></tr></thead>
            <tbody>
              <tr><td>Windows (64-bit)</td><td><code>medius-capi-x86_64-pc-windows-msvc.tar.gz</code></td></tr>
              <tr><td>macOS (Apple Silicon, M1+)</td><td><code>medius-capi-aarch64-apple-darwin.tar.gz</code></td></tr>
              <tr><td>macOS (Intel)</td><td><code>medius-capi-x86_64-apple-darwin.tar.gz</code></td></tr>
              <tr><td>Linux (Intel/AMD 64-bit)</td><td><code>medius-capi-x86_64-unknown-linux-gnu.tar.gz</code></td></tr>
              <tr><td>Linux (ARM64)</td><td><code>medius-capi-aarch64-unknown-linux-gnu.tar.gz</code></td></tr>
            </tbody>
          </table>
          <p>Inside are two folders:</p>
          <pre class="diagram">{`medius-capi-<your-platform>/
├── include/
│   └── medius.h
└── lib/
    └── libmedius_capi      (.so Linux · .dylib macOS · .dll + .lib Windows · .a static)`}</pre>
          <p>
            <code>include/</code> holds the header you <code>#include</code>; <code>lib/</code> holds
            the library you link.
          </p>
        </Card>
      </div>

      <div id="build" data-search-target>
        <Card>
          <CardHeader title="Build & run" subtitle="Compiler and linker flags" />

          <div class="api-response-label">WINDOWS · VISUAL STUDIO</div>
          <p>
            In your project's <strong>Properties</strong> (use the same values for{' '}
            <a href="https://learn.microsoft.com/en-us/cpp/" target="_blank" rel="noreferrer">C and C++</a>):
          </p>
          <ol>
            <li><strong>C/C++ → General → Additional Include Directories</strong>: add the unzipped <code>include\</code> folder.</li>
            <li><strong>Linker → General → Additional Library Directories</strong>: add the <code>lib\</code> folder.</li>
            <li><strong>Linker → Input → Additional Dependencies</strong>: add <code>medius_capi.dll.lib</code>.</li>
            <li>Copy <code>medius_capi.dll</code> next to your built <code>.exe</code> (or onto your <code>PATH</code>).</li>
          </ol>
          <p>Build and run as normal. To skip the DLL, add <code>medius_capi.lib</code> in step 3 instead (static, nothing to copy).</p>

          <div class="api-response-label">WINDOWS · COMMAND LINE (x64 Native Tools Command Prompt)</div>
          <pre><code class="language-bash">{`cl app.c /I include /link /LIBPATH:lib medius_capi.dll.lib
:: C++:  cl /std:c++17 app.cpp /I include /link /LIBPATH:lib medius_capi.dll.lib
:: then copy medius_capi.dll next to app.exe, and run:
app.exe`}</code></pre>

          <div class="api-response-label">LINUX &amp; MACOS</div>
          <pre><code class="language-bash">{`# C
cc  app.c   -I include -L lib -lmedius_capi -o app
# C++ (same header, same library)
g++ -std=c++17 app.cpp -I include -L lib -lmedius_capi -o app

# run (tell the loader where the library is)
LD_LIBRARY_PATH=lib ./app        # macOS: DYLD_LIBRARY_PATH=lib ./app`}</code></pre>
          <p>
            On Linux add <code>-lpthread</code>. To avoid setting a path at run time, link the static{' '}
            <code>libmedius_capi.a</code> instead.
          </p>

          <div class="callout callout--info">
            <p>
              If your platform isn't listed, build it once: install the{' '}
              <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a>,{' '}
              <code>git clone https://github.com/K4HVH/medius</code>, then{' '}
              <code>cargo build -p medius-capi --release</code>. The library lands in{' '}
              <code>target/release/</code> and the header is <code>medius-capi/include/medius.h</code>.
              See <A href="/bindings/c/build">Build &amp; features</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="verify" data-search-target>
        <Card>
          <CardHeader title="Verify" subtitle="Version print, no box needed" />
          <p>
            <code>medius_version_string</code> and <code>medius_abi_version</code> are pure library
            calls. If this builds and prints a version, you're set.
          </p>
          <pre><code class="language-c">{`// app.c
#include <stdio.h>
#include <medius.h>

int main(void) {
    printf("%s, abi %u\\n", medius_version_string(), medius_abi_version());
    return 0;
}`}</code></pre>
          <div class="callout callout--warning">
            <p>
              A linker error (<code>cannot find -lmedius_capi</code> / <code>unresolved external</code>)
              means the library directory is wrong. A crash on start
              (<code>cannot open shared object</code> / a missing-DLL popup) means the loader can't find
              the library at run time. Fix the path or copy the file next to your program. More on{' '}
              <A href="/bindings/c/build">Build &amp; features</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="connect" data-search-target>
        <Card>
          <CardHeader title="Connect" subtitle="Open a box, read its version" />
          <p>
            <A href="/bindings/c/api#connect"><code>medius_device_find</code></A> opens the first{' '}
            <A href="/native/hardware">box</A> it sees and runs the{' '}
            <A href="/native/connection#handshake">handshake</A>;{' '}
            <A href="/bindings/c/api#connect"><code>medius_device_free</code></A> closes it. Full
            walk-through on <A href="/bindings/c/quickstart">First program</A>.
          </p>
          <pre><code class="language-c">{`MediusDevice *dev = NULL;
if (medius_device_find(&dev) != MEDIUS_STATUS_OK) { /* see Calls & errors */ }

MediusVersion v;
medius_device_query_version(dev, &v);
printf("firmware %u.%u.%u\\n", v.fw_major, v.fw_minor, v.fw_patch);

medius_device_free(dev);`}</code></pre>
          <p>
            Every call returns a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> you
            check; reading the failure text is on{' '}
            <A href="/bindings/c/usage#errors">Calls &amp; errors</A>. The full call list is the{' '}
            <A href="/bindings/c/api">API index</A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Install;
