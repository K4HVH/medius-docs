import { For, Show } from 'solid-js';
import { BsLightbulb, BsPlus } from 'solid-icons/bs';
import { Button } from '../../../components/inputs/Button';
import { versionString } from '../../../dashboard/protocol';
import { speaksCurrentWire } from '../../../dashboard/serial';
import { type BoxEntry, type BoxSession, useBoxes } from './context';

export type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral' | 'hollow' | 'muted';

export interface RowView {
  name: string;
  detail: string;
  tone: Tone;
  canIdentify: boolean;
}

const DOT: Record<Tone, { background: string; border: string }> = {
  success: { background: 'var(--color-success)', border: 'var(--color-success)' },
  warning: { background: 'var(--color-warning)', border: 'var(--color-warning)' },
  danger: { background: 'var(--color-danger)', border: 'var(--color-danger)' },
  primary: { background: 'var(--color-primary)', border: 'var(--color-primary)' },
  neutral: { background: 'var(--g-text-muted)', border: 'var(--g-text-muted)' },
  hollow: { background: 'transparent', border: 'var(--g-text-muted)' },
  muted: { background: 'transparent', border: 'var(--g-border-color-subtle)' },
};

export function rowView(s: BoxSession): RowView {
  const name = s.name() ?? 'Unknown device';
  const row = (detail: string, tone: Tone, canIdentify = false): RowView => ({ name, detail, tone, canIdentify });
  if (!s.present()) return row('Not plugged in', 'muted');
  switch (s.status()) {
    case 'flashing': {
      const p = s.updateProgress();
      const pct = p?.phase === 'writing' && p.total ? Math.round(((p.written ?? 0) / p.total) * 100) : null;
      return row(pct === null ? 'Updating' : `Updating ${pct}%`, 'primary');
    }
    case 'connecting':
      return row('Connecting...', 'neutral');
    case 'lost':
      return row('Not answering', 'danger');
    case 'connected': {
      const v = s.version();
      return s.updateOnly() || !v ? row('Update needed', 'warning', true) : row(`v${versionString(v)}`, 'success', true);
    }
    case 'error':
      return row('Update failed', 'danger');
  }
  const p = s.probe();
  switch (p?.kind) {
    case undefined:
      return row('Checking...', 'neutral');
    case 'box':
      return row(speaksCurrentWire(p.version) ? `v${versionString(p.version)}` : 'Update needed', 'hollow', !s.held());
    case 'old-firmware':
      return row('Needs setup', 'warning');
    case 'new-firmware':
      return row('Reload needed', 'warning');
    case 'busy':
      return row('In use', 'warning');
    case 'silent':
      return row('Not answering', 'hollow');
    case 'other':
      return row("Can't open", 'warning');
  }
}

const Row = (props: { entry: BoxEntry; active: boolean; disabled: boolean; onSelect: () => void }) => {
  const v = () => rowView(props.entry.session);
  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--g-spacing-xs)' }}>
      <button
        type="button"
        class={`tabs__tab${props.active ? ' tabs__tab--active' : ''}`}
        style={{ flex: '1', 'min-width': '0' }}
        aria-current={props.active ? 'true' : undefined}
        disabled={props.disabled}
        onClick={() => props.onSelect()}
      >
        <span class="tabs__tab-icon" aria-hidden="true" style={{ width: '1em' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              'border-radius': '50%',
              background: DOT[v().tone].background,
              border: `1.5px solid ${DOT[v().tone].border}`,
            }}
          />
        </span>
        <span style={{ display: 'flex', 'flex-direction': 'column', 'min-width': '0', 'text-align': 'left', 'line-height': '1.25' }}>
          <span style={{ overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{v().name}</span>
          <span style={{ overflow: 'hidden', 'text-overflow': 'ellipsis', 'font-size': '0.8em', opacity: '0.75' }}>
            {v().detail}
          </span>
        </span>
      </button>
      <Show when={v().canIdentify}>
        <Button
          variant="subtle"
          size="compact"
          icon={BsLightbulb}
          aria-label={`Identify ${v().name}`}
          title="Blink its light"
          disabled={props.disabled}
          loading={props.entry.session.identifying()}
          onClick={() => void props.entry.session.identify()}
        />
      </Show>
    </div>
  );
};

export const BoxList = (props: { onPick?: () => void; disabled?: boolean }) => {
  const boxes = useBoxes();
  const pick = () => props.onPick?.();
  return (
    <div class="tabs tabs--subtle tabs--vertical">
      <For each={boxes.entries()}>
        {(e) => (
          <Row
            entry={e}
            active={boxes.selected()?.key === e.key}
            disabled={!!props.disabled}
            onSelect={() => {
              boxes.select(e.key);
              pick();
            }}
          />
        )}
      </For>
      <Show when={boxes.supported && boxes.secure}>
        <button
          type="button"
          class="tabs__tab"
          disabled={props.disabled}
          onClick={() => void boxes.add().then(pick)}
        >
          <span class="tabs__tab-icon">
            <BsPlus />
          </span>
          <span class="tabs__tab-label">Add a box</span>
        </button>
      </Show>
    </div>
  );
};
