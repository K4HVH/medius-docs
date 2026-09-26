import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Install: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Install" subtitle="One header, one prebuilt library" />
        <p>
          Download your platform's archive, point the compiler at <code>include/</code> and{' '}
          <code>lib/</code>, and link. <code>medius.h</code> and <code>libmedius_capi</code> serve{' '}
          <a href="https://learn.microsoft.com/en-us/cpp/" target="_blank" rel="noreferrer">C and C++</a>{' '}
          without a <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust</a> toolchain.
        </p>
      </Card>

      <div id="download" data-search-target>
        <Card>
          <CardHeader title="Download" subtitle="Release archive per platform" />
          <p>
            Download your platform's file from the{' '}
            <a href="https://github.com/K4HVH/medius/releases" target="_blank" rel="noreferrer">Releases page</a>{' '}
            and unzip it.
          </p>
          <table class="api-params">
            <thead><tr><th>Platform</th><th>File</th></tr></thead>
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
        </Card>
      </div>

      <div id="build" data-search-target>
        <Card>
          <CardHeader title="Build & run" subtitle="Compiler and linker flags" />

          <div class="api-response-label">WINDOWS · VISUAL STUDIO</div>
          <p>
            In the project's <strong>Properties</strong> (same for C and C++):
          </p>
          <ol>
            <li>Under <strong>C/C++ → General → Additional Include Directories</strong>, add the unzipped <code>include\</code> folder.</li>
            <li>Under <strong>Linker → General → Additional Library Directories</strong>, add the <code>lib\</code> folder.</li>
            <li>Under <strong>Linker → Input → Additional Dependencies</strong>, add <code>medius_capi.dll.lib</code>.</li>
            <li>Copy <code>medius_capi.dll</code> next to your built <code>.exe</code> (or onto your <code>PATH</code>).</li>
          </ol>
          <p>To skip the DLL, add <code>medius_capi.lib</code> in step 3 instead (static, nothing to copy).</p>

          <div class="api-response-label">WINDOWS · COMMAND LINE</div>
          <p>From the <strong>x64 Native Tools Command Prompt</strong>:</p>
          <pre><code class="language-bash">{`cl app.c /I include /link /LIBPATH:lib medius_capi.dll.lib
:: C++:  cl /std:c++17 app.cpp /I include /link /LIBPATH:lib medius_capi.dll.lib
:: copy medius_capi.dll next to app.exe, then run:
app.exe`}</code></pre>

          <div class="api-response-label">LINUX &amp; MACOS</div>
          <pre><code class="language-bash">{`# C
cc  app.c   -I include -L lib -lmedius_capi -o app
# C++ (same header and library)
g++ -std=c++17 app.cpp -I include -L lib -lmedius_capi -o app

# run, with the loader pointed at lib/
LD_LIBRARY_PATH=lib ./app        # macOS: DYLD_LIBRARY_PATH=lib ./app`}</code></pre>
          <p>
            On Linux add <code>-lpthread</code>. Link the static <code>libmedius_capi.a</code> to
            skip the run-time path.
          </p>

          <div class="callout callout--info">
            <p>
              For an unlisted platform, install the{' '}
              <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a>,{' '}
              <code>git clone https://github.com/K4HVH/medius</code>, then{' '}
              <code>cargo build -p medius-capi --release</code>. The library lands in{' '}
              <code>target/release/</code>; the header is <code>medius-capi/include/medius.h</code>.
              See <A href="/bindings/c/build">Build &amp; features</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="verify" data-search-target>
        <Card>
          <CardHeader title="Verify" subtitle="Version print, no box needed" />
          <p>
            <A href="/bindings/c/api#module"><code>medius_version_string</code></A> and{' '}
            <A href="/bindings/c/api#module"><code>medius_abi_version</code></A> are pure library
            calls. A printed version means header and library are wired in. On a{' '}
            <code>MEDIUS_ABI_VERSION</code> mismatch, call nothing else; rebuild against the header
            shipped with the library.
          </p>
          <pre><code class="language-c">{`// app.c
#include <stdio.h>
#include <medius.h>

int main(void) {
    if (medius_abi_version() != MEDIUS_ABI_VERSION) {       /* structs laid out differently */
        fprintf(stderr, "library is abi %u, medius.h is abi %u\\n",
                medius_abi_version(), (unsigned)MEDIUS_ABI_VERSION);
        return 1;
    }
    printf("%s, abi %u\\n", medius_version_string(), medius_abi_version());
    return 0;
}`}</code></pre>
          <div class="callout callout--warning">
            <p>
              A linker error (<code>cannot find -lmedius_capi</code> / <code>unresolved external</code>)
              means the library directory is wrong.
            </p>
            <p>
              A crash on start
              (<code>cannot open shared object</code> / a missing-DLL popup) means the loader can't find
              the library. See <A href="/bindings/c/build">Build &amp; features</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="connect" data-search-target>
        <Card>
          <CardHeader title="Connect" subtitle="Open a box, read its version" />
          <p>
            <A href="/bindings/c/api#connect"><code>medius_device_find</code></A> opens the first{' '}
            <A href="/native/hardware">box</A> it finds and runs the{' '}
            <A href="/native/connection#handshake">handshake</A>;{' '}
            <A href="/bindings/c/api#connect"><code>medius_device_free</code></A> closes it. See{' '}
            <A href="/bindings/c/quickstart">First program</A>.
          </p>
          <pre><code class="language-c">{`MediusDevice *dev = NULL;
if (medius_device_find(&dev) != MEDIUS_STATUS_OK) { /* see Calls & errors */ }

MediusVersion v;
medius_device_query_version(dev, &v);
printf("firmware %u.%u.%u\\n", v.fw_major, v.fw_minor, v.fw_patch);

medius_device_free(dev);`}</code></pre>
          <p>
            Every call returns a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A>.{' '}
            <A href="/bindings/c/usage#errors">Calls &amp; errors</A> covers the failure text; the{' '}
            <A href="/bindings/c/api">API index</A> lists every call.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Install;
