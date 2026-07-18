import { Component, JSX, splitProps, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { BsX } from 'solid-icons/bs';
import '../../styles/components/display/Chip.css';

interface ChipProps {
  children: JSX.Element;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'compact' | 'normal' | 'spacious';
  icon?: Component;
  onRemove?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  class?: string;
}

export const Chip: Component<ChipProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'children',
    'variant',
    'size',
    'icon',
    'onRemove',
    'onClick',
    'disabled',
    'class',
  ]);

  const variant = () => local.variant ?? 'neutral';
  const size = () => local.size ?? 'normal';
  const isClickable = () => !!local.onClick;
  const isRemovable = () => !!local.onRemove;
  const isFocusable = () => isClickable() || isRemovable();

  const handleClick = (e: MouseEvent) => {
    if (local.disabled) return;
    if (local.onClick) {
      local.onClick();
    }
  };

  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation();
    if (local.disabled || !local.onRemove) return;
    local.onRemove();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;

    if (local.onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      local.onClick();
    }

    if (local.onRemove && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      local.onRemove();
    }
  };

  const classNames = () => {
    const classes = ['chip'];

    classes.push(`chip--${variant()}`);

    if (size() !== 'normal') {
      classes.push(`chip--${size()}`);
    }

    if (isClickable() && !local.disabled) {
      classes.push('chip--clickable');
    }

    if (local.disabled) {
      classes.push('chip--disabled');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <span
      class={classNames()}
      onClick={local.onClick && !local.disabled ? handleClick : undefined}
      onKeyDown={isFocusable() ? handleKeyDown : undefined}
      tabIndex={isFocusable() ? (local.disabled ? -1 : 0) : undefined}
      role={local.onClick ? 'button' : undefined}
      aria-disabled={local.disabled ? 'true' : undefined}
      {...rest}
    >
      <Show when={local.icon}>
        <span class="chip__icon">
          <Dynamic component={local.icon!} />
        </span>
      </Show>
      <span class="chip__label">{local.children}</span>
      <Show when={isRemovable()}>
        <button
          type="button"
          class="chip__remove"
          onClick={handleRemove}
          aria-label="Remove"
          tabIndex={-1}
        >
          <BsX />
        </button>
      </Show>
    </span>
  );
};
