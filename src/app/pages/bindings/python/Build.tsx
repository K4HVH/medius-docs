import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Build: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Build & features" subtitle="Turning on mock and flash, and building from source" />
        <p>
          The <A href="/library/features/mock">mock</A> and <A href="/library/features/flash">flash</A>{' '}
          features are compiled into the native library, not switched on from Python, so turning one
          on means building that library. The <code><a href="https://pip.pypa.io" target="_blank" rel="noreferrer">pip</a> install medius</code> wheel ships with both
          off. Everything else is a{' '}
          <a href="https://docs.python.org/3/library/ctypes.html" target="_blank" rel="noreferrer">ctypes</a>{' '}
          layer with no Python build step.
        </p>
      </Card>

      <div id="features" data-search-target>
        <Card>
          <CardHeader title="Feature flags" subtitle="mock and flash, and how to tell what's built in" />
          <p>
            Both are <a href="https://doc.rust-lang.org/cargo/reference/features.html" target="_blank" rel="noreferrer">Cargo features</a>{' '}
            on the <a href="https://github.com/K4HVH/medius" target="_blank" rel="noreferrer"><code>medius-capi</code></a>{' '}
            crate. On import, Python reads what the loaded library exposes and sets{' '}
            <code>medius.HAS_MOCK</code> and <code>medius.HAS_FLASH</code> to match.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Feature</th><th>Cargo flag</th><th>Python surface</th><th><code>medius.HAS_*</code></th><th>Adds</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>mock</code></td>
                <td><code>--features mock</code></td>
                <td><code>MockBox().open()</code> / <code>.with_device()</code></td>
                <td><code>HAS_MOCK</code></td>
                <td>A scriptable in-process fake box. See <A href="/library/features/mock">Mock box</A>.</td>
              </tr>
              <tr>
                <td><code>flash</code></td>
                <td><code>--features flash</code></td>
                <td><A href="/bindings/python/api#module"><code>medius.flash(port, bin_path, host=False)</code></A></td>
                <td><code>HAS_FLASH</code></td>
                <td>Flash firmware via <a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer">esptool</a>, Linux and Windows. See <A href="/library/features/flash">Flash</A>.</td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              The <code>pip install medius</code> wheel has neither feature. <code>MockBox()</code>{' '}
              and <code>medius.flash(...)</code> raise <code><a href="https://docs.python.org/3/library/exceptions.html#RuntimeError" target="_blank" rel="noreferrer">RuntimeError</a></code> there. Gate on the
              flag first: <code>if medius.HAS_MOCK:</code> / <code>if medius.HAS_FLASH:</code>.
            </p>
          </div>
          <div class="api-response-label">CHECK WHAT'S BUILT IN</div>
          <pre><code>{`python -c "import medius; print('mock', medius.HAS_MOCK, 'flash', medius.HAS_FLASH)"
# mock False flash False   <- the published wheel`}</code></pre>
          <div class="api-response-label">ENABLE A FEATURE</div>
          <p>
            Build the library with the features you want, then point Python at it with{' '}
            <code>MEDIUS_LIB</code> (<A href="/bindings/python/build#loading">below</A>). No reinstall.
          </p>
          <pre><code>{`# from the repo root
cargo build --release -p medius-capi --features mock,flash

export MEDIUS_LIB=$PWD/target/release/libmedius_capi.so
python -c "import medius; print(medius.HAS_MOCK, medius.HAS_FLASH)"
# True True`}</code></pre>
          <p>
            To bake features into an installed wheel, build the library first and let pip reuse it:
          </p>
          <pre><code>{`cargo build --release -p medius-capi --features mock,flash
MEDIUS_SKIP_CARGO=1 pip install ./bindings/python`}</code></pre>
        </Card>
      </div>

      <div id="loading" data-search-target>
        <Card>
          <CardHeader title="Finding the library" subtitle="MEDIUS_LIB and the load order" />
          <p>
            On <code>import medius</code> the package loads the native library, trying these in order
            and stopping at the first hit. Set <code>MEDIUS_LIB</code> to override the rest and run any
            script against the build you want (a debug build, or one with{' '}
            <A href="/library/features/mock">mock</A>/<A href="/library/features/flash">flash</A>).
          </p>
          <pre class="diagram">{`import medius
   │
   ├─ 1. $MEDIUS_LIB set?                   ──▶  CDLL(that exact path)   (dev / test builds)
   ├─ 2. bundled beside the package?        ──▶  CDLL(medius/<libname>)  (what the wheel ships)
   ├─ 3. on the system loader path?         ──▶  CDLL(<libname>)         (LD_LIBRARY_PATH / PATH)
   ├─ 4. ctypes.util.find_library(...)?     ──▶  CDLL(found)             
   └─ none                                  ──▶  OSError                 (cannot locate the library)`}</pre>
          <div class="api-response-label">POINT AT ANY BUILD WITH MEDIUS_LIB</div>
          <pre><code>{`MEDIUS_LIB=/path/to/target/release/libmedius_capi.so python myscript.py`}</code></pre>
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
          <CardHeader title="Build from source" subtitle="musl Linux, 32-bit Windows, and contributors" />
          <p>
            Linux (<a href="https://www.gnu.org/software/libc/" target="_blank" rel="noreferrer">glibc</a>), macOS, and 64-bit Windows get a prebuilt wheel from{' '}
            <code>pip install medius</code>. On <a href="https://musl.libc.org" target="_blank" rel="noreferrer">musl</a> Linux (<a href="https://alpinelinux.org" target="_blank" rel="noreferrer">Alpine</a>) or 32-bit Windows there's no wheel,
            so <code>pip</code> builds the native library from source. Force a source build anywhere,
            or build from a checkout:
          </p>
          <pre><code>{`# build from source even where a wheel exists
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
