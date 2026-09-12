// Overwrite the bytes the clone presents at enumeration.
//
// A patch is stored whether or not imperfect clones are on, so the form stays live and only the apply
// is withheld. A refused set is the sharp edge: the box returns out of its start path and the clone
// never comes up, and clearing is the way back.

import { For, Show, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import { type PatchInfo, PATCHES_MAX, PatchSection, patchSectionName } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { chips, label, muted, row, section } from './ui';
import { displayName, parseHex } from './hex';

const SECTIONS = [
  PatchSection.Device,
  PatchSection.Config,
  PatchSection.Report,
  PatchSection.String,
  PatchSection.Bos,
];
const SECTION_OPTIONS = SECTIONS.map((s) => ({
  value: String(s),
  label: `${displayName(patchSectionName(s))} descriptor`,
}));

// What the offset counts from, which is the one thing the number field cannot say for itself.
const SECTION_BLURB: Record<number, string> = {
  [PatchSection.Device]: 'Offset into the 18-byte device descriptor.',
  [PatchSection.Config]: 'Offset into that whole configuration, its interfaces and endpoints included.',
  [PatchSection.Report]: "Offset into that interface's report descriptor.",
  [PatchSection.String]: 'Offset into that string descriptor, its two-byte header included.',
  [PatchSection.Bos]: 'Offset into the BOS descriptor.',
};

// The device and BOS descriptors are singletons, so cfg and index do not address them. A report
// descriptor keys on cfg + index (the interface); a configuration on cfg; a string on index.
const usesCfg = (s: PatchSection | null) => s === PatchSection.Config || s === PatchSection.Report;
const usesIndex = (s: PatchSection | null) => s === PatchSection.Report || s === PatchSection.String;

// A chip is capped at 250px and ellipsises past it, so a patch names only what addresses it. The
// section already names the number it keys on, except a report, which needs both of its.
const describe = (e: PatchInfo): string => {
  const narrow: string[] = [];
  if (e.section === PatchSection.Report) narrow.push(`cfg ${e.cfg}`, `interface ${e.index}`);
  else if (e.section === PatchSection.Config) narrow.push(String(e.cfg));
  else if (e.section === PatchSection.String) narrow.push(String(e.index));
  const head = [displayName(patchSectionName(e.section)), ...narrow].join(' ');
  return `${head} at ${e.offset}, ${e.len} B`;
};

const DevicePatch = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const patches = dash.poll('patches');
  const allowed = () => imperfect()?.allowed === true;

  const [pSection, setPSection] = createSignal(String(PatchSection.Device));
  const [pCfg, setPCfg] = createSignal(0);
  const [pIndex, setPIndex] = createSignal(0);
  const [pOff, setPOff] = createSignal(0);
  const [pBytes, setPBytes] = createSignal('');
  const cmd = createCommand(() => dash.refreshPoll('patches'));

  const psection = () => Number(pSection()) as PatchSection;
  const entries = () => patches()?.entries ?? ([] as PatchInfo[]);

  const setPatch = () => {
    const bytes = parseHex(pBytes());
    if (bytes === null || bytes.length === 0) {
      cmd.run(() => Promise.reject(new Error('Enter the bytes to write.')));
      return;
    }
    cmd.run(() => dash.link()!.setPatch(psection(), pCfg(), pIndex(), pOff(), bytes));
  };

  const removeOne = (e: PatchInfo) =>
    cmd.run(() => dash.link()!.removePatch(e.section ?? PatchSection.Device, e.cfg, e.index, e.offset));

  const applyWhy = (): string | null => {
    if (!allowed()) return 'Applying needs imperfect clones, on the Device tab.';
    if (entries().length === 0) return 'Nothing stored to apply.';
    return null;
  };

  const applyPatches = () => cmd.run(() => dash.link()!.applyPatch());
  const clearAll = () => cmd.run(() => dash.link()!.clearPatch());

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="descriptor-patches" data-search-target>
        <Card>
          <CardHeader title="Descriptor patches" subtitle="Overwrite the bytes the clone presents" />

          <div style={label}>Descriptor</div>
          <RadioGroup
            name="patch-section"
            value={pSection()}
            onChange={setPSection}
            options={SECTION_OPTIONS}
          />
          <p style={{ ...muted, 'margin-top': '4px' }}>{SECTION_BLURB[psection()]}</p>

          <div style={{ ...section, ...row, 'align-items': 'flex-end' }}>
            <Show when={usesCfg(psection())}>
              <div style={{ 'max-width': '9rem' }}>
                <NumberInput label="Configuration" value={pCfg()} min={0} max={255} onChange={(v) => setPCfg(v ?? 0)} />
              </div>
            </Show>
            <Show when={usesIndex(psection())}>
              <div style={{ 'max-width': '9rem' }}>
                <NumberInput
                  label={psection() === PatchSection.String ? 'String index' : 'Interface'}
                  value={pIndex()}
                  min={0}
                  max={255}
                  onChange={(v) => setPIndex(v ?? 0)}
                />
              </div>
            </Show>
            <div style={{ 'max-width': '9rem' }}>
              <NumberInput label="Offset" value={pOff()} min={0} max={65534} onChange={(v) => setPOff(v ?? 0)} />
            </div>
          </div>

          <div style={section}>
            <TextField label="Bytes (hex)" value={pBytes()} onInput={setPBytes} placeholder="e.g. 00 03" />
          </div>

          <div style={{ ...section, ...row }}>
            <Button variant="primary" disabled={cmd.busy()} onClick={setPatch}>
              Set patch
            </Button>
            <Button
              variant="secondary"
              disabled={cmd.busy() || applyWhy() !== null}
              title={applyWhy() ?? 'Re-present the clone carrying the stored set'}
              onClick={applyPatches}
            >
              Apply
            </Button>
            <Button variant="secondary" disabled={cmd.busy() || entries().length === 0} onClick={clearAll}>
              Clear all
            </Button>
          </div>
          <p style={{ ...muted, 'margin-top': '4px' }}>
            Applying re-presents the clone, so the game PC sees one replug. Clear all reboots the box if
            the patches were on the clone.
          </p>
          <Show when={!allowed()}>
            <div class="callout callout--info" style={section}>
              A patch is stored now and applied once{' '}
              <A href="/dashboard#imperfect-clone">imperfect clones</A> are on, on the Device tab.
            </div>
          </Show>
          <Show when={patches()?.tableFull}>
            <div class="callout callout--warning" style={section}>
              The box holds {PATCHES_MAX} patches and the store is full. Remove one before adding another.
            </div>
          </Show>
          <Show when={cmd.error()}>
            <div class="callout callout--danger" role="alert" style={section}>
              {cmd.error()}
            </div>
          </Show>

          <div style={section}>
            <div style={label}>State</div>
            <div style={chips}>
              <Chip variant={patches()?.applied ? 'success' : 'neutral'}>
                {patches()?.applied ? 'Applied' : 'Not applied'}
              </Chip>
              <Show when={patches()?.pending}>
                <Chip variant="info">Not on the clone</Chip>
              </Show>
              <Show when={patches()?.refused}>
                <Chip variant="warning">Last apply refused</Chip>
              </Show>
            </div>
            <Show when={patches()?.refused}>
              <div class="callout callout--warning" style={section}>
                A refused set leaves the clone down. Clear all brings it back.
              </div>
            </Show>
          </div>

          <div style={section}>
            <div style={label}>
              Stored ({entries().length} of {PATCHES_MAX})
            </div>
            <Show
              when={entries().length > 0}
              fallback={<p>No patches. The clone presents the native descriptors.</p>}
            >
              <div style={chips}>
                <For each={entries()}>
                  {(e) => (
                    <Chip variant="info" onRemove={() => removeOne(e)}>
                      {describe(e)}
                    </Chip>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Card>
      </div>
    </Show>
  );
};

export default DevicePatch;
