import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Build: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Build & features" subtitle="Turning on mock, and building from source" />
        <p>
          The <A href="/library/features/mock">mock</A> feature is compiled into the native library,
          not switched on from Python, so turning it on means building that library.
        </p>
      </Card>

      <div id="features" data-search-target>
        <Card>
          <CardHeader title="Feature flags" subtitle="mock, and how to tell what's built in" />
          <p>
            Both are <a href="https://doc.rust-lang.org/cargo/reference/features.html" target="_blank" rel="noreferrer">Cargo features</a>{' '}
            on the <a href="https://github.com/K4HVH/medius" target="_blank" rel="noreferrer"><code>medius-capi</code></a>{' '}
            crate. On import, Python reads what the loaded library exposes and sets{' '}
            <code>medius.HAS_MOCK</code> to match.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Feature</th><th>Cargo flag</th><th>Python surface</th><th><code>medius.HAS_MOCK</code></th><th>Adds</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>mock</code></td>
                <td><code>--features mock</code></td>
                <td><code>MockBox().open()</code> / <code>.with_device()</code></td>
                <td><code>HAS_MOCK</code></td>
                <td>A scriptable in-process fake box. See <A href="/library/features/mock">Mock box</A>.</td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              The <code><a href="https://pip.pypa.io" target="_blank" rel="noreferrer">pip</a> install medius</code>{' '}
              wheel does not have it. <code>MockBox()</code> raises{' '}
              <code><a href="https://docs.python.org/3/library/exceptions.html#RuntimeError" target="_blank" rel="noreferrer">RuntimeError</a></code> there.
              Gate on the flag first: <code>if medius.HAS_MOCK:</code>.
            </p>
          </div>
          <div class="api-response-label">FEATURE CHECK</div>
          <pre><code class="language-bash">{`python -c "import medius; print('mock', medius.HAS_MOCK)"
# mock False   <- the published wheel`}</code></pre>
          <div class="api-response-label">ENABLE A FEATURE</div>
          <p>
            Build the library with the feature, then point Python at it with{' '}
            <code>MEDIUS_LIB</code> (<A href="/bindings/python/build#loading">below</A>). No reinstall.
          </p>
          <pre><code class="language-bash">{`# from the repo root
cargo build --release -p medius-capi --features mock

export MEDIUS_LIB=$PWD/target/release/libmedius_capi.so
python -c "import medius; print(medius.HAS_MOCK)"
# True`}</code></pre>
          <p>
            To bake the feature into an installed wheel, build the library first and let pip reuse it:
          </p>
          <pre><code class="language-bash">{`cargo build --release -p medius-capi --features mock
MEDIUS_SKIP_CARGO=1 pip install ./bindings/python`}</code></pre>
        </Card>
      </div>

      <div id="loading" data-search-target>
        <Card>
          <CardHeader title="Finding the library" subtitle="MEDIUS_LIB and the load order" />
          <p>
            On <code>import medius</code> the package loads the native library, trying these in order
            and stopping at the first hit. <code>MEDIUS_LIB</code> overrides the rest.
          </p>
          <pre class="diagram">{`import medius
   │
   ├─ 1. $MEDIUS_LIB set?                   ──▶  CDLL(that exact path)   (dev / test builds)
   ├─ 2. bundled beside the package?        ──▶  CDLL(medius/<libname>)  (what the wheel ships)
   ├─ 3. on the system loader path?         ──▶  CDLL(<libname>)         (LD_LIBRARY_PATH / PATH)
   ├─ 4. ctypes.util.find_library(...)?     ──▶  CDLL(found)             (ldconfig / system paths)
   └─ none                                  ──▶  OSError                 (cannot locate the library)`}</pre>
          <div class="api-response-label">MEDIUS_LIB</div>
          <pre><code class="language-bash">{`MEDIUS_LIB=/path/to/target/release/libmedius_capi.so python myscript.py`}</code></pre>
          <div class="callout callout--warning">
            <p>
              An <code><a href="https://docs.python.org/3/library/exceptions.html#OSError" target="_blank" rel="noreferrer">OSError</a></code> on import means every step failed: a bad <code>MEDIUS_LIB</code>{' '}
              path, or an unsupported platform where the install built from source without a{' '}
              <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a>.
            </p>
          </div>
        </Card>
      </div>

      <div id="packaging" data-search-target>
        <Card>
          <CardHeader title="Packaging" subtitle="Prebuilt wheels, and building from source" />
          <p>
            Linux (<a href="https://www.gnu.org/software/libc/" target="_blank" rel="noreferrer">glibc</a>), macOS, and 64-bit Windows get a prebuilt wheel from{' '}
            <code>pip install medius</code>. On <a href="https://musl.libc.org" target="_blank" rel="noreferrer">musl</a> Linux (<a href="https://alpinelinux.org" target="_blank" rel="noreferrer">Alpine</a>) or 32-bit Windows there's no wheel,
            so <code>pip</code> builds the native library from source.
          </p>
          <pre><code class="language-bash">{`# build from source even where a wheel exists
pip install medius --no-binary medius

# from a checkout
pip install ./bindings/python`}</code></pre>
          <div class="callout callout--warning">
            <p>
              A source build runs <code>cargo build --release -p medius-capi</code>, so it needs a{' '}
              <a href="https://rustup.rs" target="_blank" rel="noreferrer">Rust toolchain</a> on PATH.
              On Linux the library links <code><a href="https://www.freedesktop.org/software/systemd/man/latest/libudev.html" target="_blank" rel="noreferrer">libudev</a></code> through <a href="https://crates.io/crates/serialport" target="_blank" rel="noreferrer">serialport</a>; install{' '}
              <code>systemd-devel</code> (or your distro's <code>libudev-dev</code>) first.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Build;
