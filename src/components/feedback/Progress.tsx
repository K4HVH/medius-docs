import { Component, JSX, splitProps, Show } from 'solid-js';
import '../../styles/components/feedback/Progress.css';

type ProgressType = 'linear' | 'circular';
type ProgressVariant = 'primary' | 'success' | 'warning' | 'error';
type ProgressSize = 'sm' | 'normal' | 'lg';

interface ProgressProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Progress type: linear bar or circular radial */
  type?: ProgressType;
  /** Current progress value (0-100). If undefined, shows indeterminate/loading state */
  value?: number;
  /** Color variant */
  variant?: ProgressVariant;
  /** Size variant */
  size?: ProgressSize;
  /** Show percentage label */
  showLabel?: boolean;
  /** Custom label text (overrides percentage) */
  label?: string;
}

export const Progress: Component<ProgressProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'type',
    'value',
    'variant',
    'size',
    'showLabel',
    'label',
    'class',
  ]);

  const type = () => local.type ?? 'circular';
  const variant = () => local.variant ?? 'primary';
  const size = () => local.size ?? 'normal';
  const isIndeterminate = () => local.value === undefined || local.value === null;

  const normalizedValue = () => {
    if (isIndeterminate()) return 0;
    const val = local.value ?? 0;
    return Math.max(0, Math.min(100, val));
  };

  const displayLabel = () => {
    if (local.label) return local.label;
    if (local.showLabel && !isIndeterminate()) {
      return `${Math.round(normalizedValue())}%`;
    }
    return null;
  };

  const classNames = () => {
    const classes = ['progress'];

    classes.push(`progress--${type()}`);
    classes.push(`progress--${variant()}`);

    if (size() !== 'normal') {
      classes.push(`progress--${size()}`);
    }

    if (isIndeterminate()) {
      classes.push('progress--indeterminate');
    }

    if (type() === 'circular' && displayLabel()) {
      classes.push('progress--with-label');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <div class={classNames()} role="progressbar" aria-valuenow={isIndeterminate() ? undefined : normalizedValue()} aria-valuemin={0} aria-valuemax={100} {...rest}>
      <Show when={type() === 'linear'}>
        <div class="progress__track">
          <div
            class="progress__fill"
            style={!isIndeterminate() ? { width: `${normalizedValue()}%` } : undefined}
          />
        </div>
        <Show when={displayLabel()}>
          <span class="progress__label">{displayLabel()}</span>
        </Show>
      </Show>

      <Show when={type() === 'circular'}>
        <svg class="progress__svg" viewBox="0 0 100 100">
          <circle
            class="progress__circle-bg"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke-width="10"
          />
          <circle
            class="progress__circle"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke-width="10"
            stroke-linecap="round"
            style={
              !isIndeterminate()
                ? {
                    'stroke-dasharray': '283', // 2 * PI * r = 2 * 3.14159 * 45 ≈ 283
                    'stroke-dashoffset': `${283 - (283 * normalizedValue()) / 100}`,
                  }
                : undefined
            }
          />
        </svg>
        <Show when={displayLabel()}>
          <span class="progress__label progress__label--circular">{displayLabel()}</span>
        </Show>
      </Show>
    </div>
  );
};
