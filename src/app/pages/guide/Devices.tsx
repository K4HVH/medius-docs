import { createMemo, createResource, createSignal, For, onCleanup, onMount, Show, type Component } from 'solid-js';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { Filter, FixLink } from '../../shell/Filter';
import { prefersReducedMotion } from '../../shell/motion';
import { COMPAT, KIND_LABEL, VERDICT_LABEL, VERDICT_TONE } from '../../data/compatibility';
import { mergeCompat, withIds } from '../../data/compatMerge';
import { LINKS } from '../../site';
import { fetchStats } from '../../../dashboard/stats';
import { matches } from '../../search/text';
import { CopyLink } from '../../shell/CopyLink';
import { itemPath } from '../../items';

// A note naming a setting links to where it is set.
const SETTING = /imperfect clone|forced to 1000 Hz/;

const Devices: Component = () => {
  // A failed load shows the reports alone.
  const [stats] = createResource(() => fetchStats().catch(() => null));
  const [query, setQuery] = createSignal('');
  const all = createMemo(() => withIds(mergeCompat(COMPAT, stats()?.devices.top ?? null)));
  // Matched as the site search matches, by name or ids.
  const rows = createMemo(() => all().filter((r) => matches(`${r.name} ${r.vidpid ?? ''}`, query())));

  // The steps' numbers light in order as the list comes into view.
  let steps: HTMLOListElement | undefined;
  onMount(() => {
    if (!steps) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return steps.classList.add('lit');
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      steps!.classList.add('lit');
    }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(steps);
    onCleanup(() => io.disconnect());
  });

  return (
    <>
      <PageHeader />

      <Filter value={query()} onInput={setQuery} placeholder="Search devices" count={rows().length} noun={['device', 'devices']} />
      <div class="table-scroll">
        <table class="api-params names compat">
          <colgroup>
            <col style={{ width: '27%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr><th>Device</th><th>Kind</th><th>Status</th><th>Note</th><th>Reported</th><th class="num">Boxes</th></tr>
          </thead>
          <tbody data-fill="compat" data-search-skip>
            <For each={rows()}>
              {(r) => (
                <tr id={r.id}>
                  <td>
                    {r.name}
                    <CopyLink id={r.id} label={r.name} to={itemPath('device', r.id.replace(/^device-/, ''))} />
                    <Show when={r.vidpid !== r.name && r.vidpid}>{(vp) => <span class="vp">{vp()}</span>}</Show>
                  </td>
                  <td>{KIND_LABEL[r.kind]}</td>
                  <td><span class={`status ${VERDICT_TONE[r.verdict]}`}>{VERDICT_LABEL[r.verdict]}</span></td>
                  <td>
                    <Show when={r.note && SETTING.test(r.note)} fallback={r.note ?? ''}>
                      <div class="ni">
                        <span>{r.note}</span>
                        <FixLink href={/wire rate/.test(r.note!) ? '/dashboard#options' : '/dashboard#imperfect-clone'}>Options</FixLink>
                      </div>
                    </Show>
                  </td>
                  <td class="v">{r.reported ?? ''}</td>
                  <td class="num">{r.boxes ?? ''}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={rows().length === 0}>
          <p class="none">No devices match.</p>
        </Show>
      </div>
      <p class="src">
        Owners' reports from Discord, and every mouse and keyboard the usage stats saw on 2 or more boxes.
        Reported: the latest release on the day of the report.
      </p>

      <DocSection id="limits" title="Limits">
        <div class="table-scroll">
          <table class="api-params names fixed">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '26%' }} />
              <col />
            </colgroup>
            <thead><tr><th>Limit</th><th>Value</th><th>Note</th></tr></thead>
            <tbody>
              <tr><td>Report rate</td><td class="v">1000 Hz</td><td>4K and 8K mice run at 1000 Hz through the box</td></tr>
              <tr>
                <td>Box capacity</td>
                <td class="v">4 IN endpoints in use at once, 6 HID interfaces</td>
                <td>A device over either limit, or with a vendor bulk or isochronous endpoint, needs imperfect clone</td>
              </tr>
              <tr><td>Devices</td><td class="v">1 per box</td><td>A receiver carrying a mouse and a keyboard counts as 1</td></tr>
              <tr><td>USB speed</td><td class="v">Full speed</td><td>High-speed devices run at full speed through the box</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="device-fixes" title="Device fixes">
        <div class="table-scroll">
          <table class="api-params names fixed">
            <colgroup>
              <col style={{ width: '36%' }} />
              <col />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead><tr><th>Device</th><th>Setting</th><th>Where</th></tr></thead>
            <tbody>
              <tr>
                <td>Logitech G PRO X2 SUPERSTRIKE, and Logitech devices stuck at 125 Hz</td>
                <td>Imperfect clone on, wire rate forced to 1000 Hz</td>
                <td>
                  <div class="ni">
                    <FixLink href="/dashboard#imperfect-clone">Imperfect clone</FixLink>
                    <FixLink href="/dashboard#wire-rate">Wire rate</FixLink>
                  </div>
                </td>
              </tr>
              <tr>
                <td>Wooting keyboards</td>
                <td>Imperfect clone on (v3.4.4 or later)</td>
                <td><FixLink href="/dashboard#imperfect-clone">Imperfect clone</FixLink></td>
              </tr>
              <tr>
                <td>Devices over box capacity, or high speed</td>
                <td>Imperfect clone on</td>
                <td><FixLink href="/dashboard#imperfect-clone">Imperfect clone</FixLink></td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="reporting" title="Reporting a device">
        <p>For a device that doesn't work through the box:</p>
        <ol class="numbered" ref={steps}>
          <li style={{ '--d': '0ms' }}><span>Plug it into a computer directly, not through the box.</span></li>
          <li style={{ '--d': '140ms' }}>
            <span>
              In{' '}
              <a class="ln-a" href="https://www.uwe-sieber.de/usbtreeview_e.html" target="_blank" rel="noreferrer">
                USB Device Tree Viewer
              </a>
              , select the device and copy all the text on the right.
            </span>
          </li>
          <li style={{ '--d': '280ms' }}>
            <span>
              Send it in a support ticket on{' '}
              <a class="ln-a" href={LINKS.discord} target="_blank" rel="noreferrer">Discord</a>.
            </span>
          </li>
        </ol>
      </DocSection>
    </>
  );
};

export default Devices;
