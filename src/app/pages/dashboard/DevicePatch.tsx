// Overwrite the bytes the clone presents at enumeration.
//
// A patch is stored whether or not imperfect clones are on, so the form stays live and only the apply
// waits for the opt-in. The clone serves the copy of the set it was last presented with, so the card
// reads the applied and pending flags to say whether what is stored is what the clone carries.

import { For, Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import { type PatchInfo, PATCH_POOL, PATCHES_MAX, PatchSection, patchSectionName } from '../../../dashboard/protocol';
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

// What the offset counts from, which is the one thing the number field cannot say for itself. A
// string patch has no offset: its bytes are the whole new string.
const SECTION_BLURB: Record<number, string> = {
  [PatchSection.Device]: 'Offset into the 18-byte device descriptor.',
  [PatchSection.Config]: 'Offset into that whole configuration, its interfaces and endpoints included.',
  [PatchSection.Report]: "Offset into that interface's report descriptor.",
  [PatchSection.String]: 'The bytes are the new text, one character each, up to 127, and replace the whole string. A 00 byte ends it early.',
  [PatchSection.Bos]: 'Offset into the BOS descriptor.',
};

// The device and BOS descriptors are singletons, so cfg and index do not address them. A report
// descriptor keys on cfg + index (the interface); a configuration on cfg; a string on index.
const usesCfg = (s: PatchSection | null) => s === PatchSection.Config || s === PatchSection.Report;
const usesIndex = (s: PatchSection | null) => s === PatchSection.Report || s === PatchSection.String;
const usesOffset = (s: PatchSection | null) => s !== PatchSection.String;

// A chip is capped at 250px and ellipsises past it, so a patch names only what addresses it. The
// section already names the number it keys on, except a report, which needs both of its.
const describe = (e: PatchInfo): string => {
  const narrow: string[] = [];
  if (e.section === PatchSection.Report) narrow.push(`cfg ${e.cfg}`, `interface ${e.index}`);
  else if (e.section === PatchSection.Config) narrow.push(String(e.cfg));
  else if (e.section === PatchSection.String) narrow.push(String(e.index));
  const head = [displayName(patchSectionName(e.section)), ...narrow].join(' ');
  return usesOffset(e.section) ? `${head} at ${e.offset}, ${e.len} B` : `${head}, ${e.len} B`;
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
    cmd.run(() => dash.link()!.setPatch(psection(), pCfg(), pIndex(), usesOffset(psection()) ? pOff() : 0, bytes));
  };

  const removeOne = (e: PatchInfo) =>
    cmd.run(() => dash.link()!.removePatch(e.section ?? PatchSection.Device, e.cfg, e.index, e.offset));

  const applied = () => patches()?.applied === true;
  const pending = () => patches()?.pending === true;
  const refused = () => patches()?.refused === true;

  // The box ignores an Apply that would serve the set the clone already serves, and one for a refused
  // set that has not changed, so the button says why rather than sending a frame that does nothing.
  const applyWhy = (): string | null => {
    if (!allowed()) return 'Applying needs imperfect clones, on the Device tab.';
    if (refused()) return 'This set failed a check. Change it, then apply.';
    if (entries().length === 0 && !applied()) return 'Nothing stored to apply.';
    if (!pending()) return 'The clone already carries this set.';
    return null;
  };

  // An emptied set still on the clone is cleared the way a stored one is, so Clear all stays live while
  // anything is on the clone, not only while something is stored.
  const clearable = () => entries().length > 0 || applied() || refused();

  // Where the stored set stands against the clone, and what to do about it. A refused set and a set
  // waiting on the opt-in have callouts of their own.
  const stateLine = (): string | null => {
    if (refused() || !allowed()) return null;
    if (applied() && !pending()) return 'The clone carries this set.';
    if (applied() && entries().length === 0) return 'The clone still carries the patches you removed. Apply or Clear all takes them off.';
    if (applied()) return 'The clone carries an earlier version of this set. Apply to put the changes on it.';
    if (pending()) return 'This set is not on the clone yet. Apply to put it on.';
    return null;
  };

  const applyPatches = () => cmd.run(() => dash.link()!.applyPatch());
  const clearAll = () => cmd.run(() => dash.link()!.clearPatch());

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="descriptor-patches" data-search-target>
        <Card>
          <CardHeader title="Descriptor patches" subtitle="Change how the clone introduces itself" />

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
                <NumberInput label="Configuration index" value={pCfg()} min={0} max={255} precision={0} onChange={(v) => setPCfg(v ?? 0)} />
              </div>
            </Show>
            <Show when={usesIndex(psection())}>
              <div style={{ 'max-width': '9rem' }}>
                <NumberInput
                  label={psection() === PatchSection.String ? 'String index' : 'Interface'}
                  value={pIndex()}
                  min={0}
                  max={255}
                  precision={0}
                  onChange={(v) => setPIndex(v ?? 0)}
                />
              </div>
            </Show>
            <Show when={usesOffset(psection())}>
              <div style={{ 'max-width': '9rem' }}>
                <NumberInput label="Offset" value={pOff()} min={0} max={65534} precision={0} onChange={(v) => setPOff(v ?? 0)} />
              </div>
            </Show>
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
              title={applyWhy() ?? 'Re-clone the device carrying the stored set'}
              onClick={applyPatches}
            >
              Apply
            </Button>
            <Button variant="secondary" disabled={cmd.busy() || !clearable()} onClick={clearAll}>
              Clear all
            </Button>
          </div>
          <p style={{ ...muted, 'margin-top': '4px' }}>
            Apply re-clones the device with the stored set. Clear all erases the set, and re-clones the
            device without it if the clone carries patches. A re-clone is a replug on the game PC and
            drops the session: injection, locks, rules, the clip and catch subscriptions.
          </p>
          <Show when={!allowed()}>
            <div class="callout callout--info" style={section}>
              A patch is stored now and applied once imperfect clones are on, on the Device tab.
            </div>
          </Show>
          <Show when={patches()?.tableFull}>
            <div class="callout callout--warning" style={section}>
              The box refused the last patch: it holds {PATCHES_MAX} patches and {PATCH_POOL} bytes of patch
              data per device. Remove or shorten one, then set it again.
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
              <Chip variant={applied() ? 'success' : 'neutral'}>{applied() ? 'Applied' : 'Not applied'}</Chip>
              <Show when={pending() && !refused()}>
                <Chip variant="info">Changes not on the clone</Chip>
              </Show>
              <Show when={refused()}>
                <Chip variant="warning">Refused</Chip>
              </Show>
            </div>
            <Show when={stateLine()}>
              <p style={{ ...muted, 'margin-top': '4px' }}>{stateLine()}</p>
            </Show>
            <Show when={refused()}>
              <div class="callout callout--warning" style={section}>
                This set failed a check, so the clone runs without it and the device log names the check.
                Change the set and apply, or clear it.
              </div>
            </Show>
          </div>

          <div style={section}>
            <div style={label}>
              Stored ({entries().length} of {PATCHES_MAX})
            </div>
            <Show
              when={entries().length > 0}
              fallback={<p>{applied() ? 'Nothing stored.' : 'Nothing patched.'}</p>}
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
