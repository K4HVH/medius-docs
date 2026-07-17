import { Component, JSX, splitProps, Show } from 'solid-js';
import { Progress } from '../feedback/Progress';
import '../../styles/components/inputs/Button.css';

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger';
  size?: 'compact' | 'normal' | 'spacious';
  loading?: boolean;
  icon?: Component;
  iconPosition?: 'left' | 'right';
  children?: JSX.Element;
}

export const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'variant',
    'size',
    'loading',
    'disabled',
    'icon',
    'iconPosition',
    'children',
    'class',
  ]);

  const variant = () => local.variant ?? 'primary';
  const size = () => local.size ?? 'normal';
  const iconPosition = () => local.iconPosition ?? 'left';
  const isIconOnly = () => local.icon && !local.children;

  const progressSize = () => {
    if (isIconOnly()) return 'lg';
    if (size() === 'compact') return 'sm';
    if (size() === 'spacious') return 'lg';
    return 'normal';
  };

  const classNames = () => {
    const classes = ['button'];

    classes.push(`button--${variant()}`);

    if (size() !== 'normal') {
      classes.push(`button--${size()}`);
    }

    if (local.loading) {
      classes.push('button--loading');
    }

    if (isIconOnly()) {
      classes.push('button--icon-only');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <button
      class={classNames()}
      disabled={local.disabled || local.loading}
      {...rest}
    >
      <Show when={local.loading}>
        <Progress type="circular" size={progressSize()} />
      </Show>
      <Show when={local.icon && iconPosition() === 'left' && !local.loading}>
        <span class="button__icon">
          {local.icon && <local.icon />}
        </span>
      </Show>
      {local.children}
      <Show when={local.icon && iconPosition() === 'right' && !local.loading}>
        <span class="button__icon">
          {local.icon && <local.icon />}
        </span>
      </Show>
    </button>
  );
};
