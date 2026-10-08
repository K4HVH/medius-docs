import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { COMPAT, type Verdict } from '../../data/compatibility';
import { mergeCompat } from '../../data/compatMerge';
import { fetchStats } from '../../../dashboard/stats';

const VERDICT: Record<Verdict, string> = { works: 'Works', partial: 'Partial', doesnt: "Doesn't" };
const KIND = { mouse: 'Mouse', keyboard: 'Keyboard', other: 'Other' };

const Compatibility: Component = () => {
  // A failed load shows the reports alone.
  const [stats] = createResource(() => fetchStats().catch(() => null));
  const [query, setQuery] = createSignal('');
  const rows = createMemo(() => {
    const all = mergeCompat(COMPAT, stats()?.devices.top ?? null);
    const q = query().trim().toLowerCase();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  });

  return (
    <>
      <PageHeader lead="Owners' reports from the Discord server, and every device the usage stats saw cloned on two or more boxes." />

      <DocSection id="devices" title="Devices" caption="Search by name">
        <label class="compat-search">
          <span class="label">Filter</span>
          <input type="search" placeholder="Razer Viper" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
        </label>
        <div class="table-scroll">
          <table class="api-params compat">
            <thead><tr><th>Device</th><th>Type</th><th>Verdict</th><th>Note</th><th>Boxes</th></tr></thead>
            <tbody data-fill="compat">
              <For each={rows()}>
                {(r) => (
                  <tr>
                    <td>
                      {r.name}
                      <Show when={r.vidpid}>{(vp) => <span class="vp">{vp()}</span>}</Show>
                    </td>
                    <td>{KIND[r.kind]}</td>
                    <td><span class={`verdict verdict--${r.verdict}`}>{VERDICT[r.verdict]}</span></td>
                    <td>{r.note ?? ''}</td>
                    <td>{r.boxes ?? ''}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="add" title="Add a device" caption="Report it on Discord">
        <p>
          A device that isn't listed, or doesn't work: the <A href="/guide/faq#report">FAQ</A> has the steps to
          report it. Some devices need a setting first; see <A href="/guide/device-fixes">Device fixes</A>.
        </p>
      </DocSection>
    </>
  );
};

export default Compatibility;
