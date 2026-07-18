import { Component, JSX, Show, createEffect, onCleanup, splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Card } from '../surfaces/Card';
import { BsX } from 'solid-icons/bs';
import '../../styles/components/feedback/Dialog.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  children?: JSX.Element;
  class?: string;
}

export const Dialog: Component<DialogProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'open',
    'onClose',
    'size',
    'dismissOnBackdrop',
    'dismissOnEscape',
    'children',
    'class',
  ]);

  const size = () => local.size ?? 'medium';
  const dismissOnBackdrop = () => local.dismissOnBackdrop ?? true;
  const dismissOnEscape = () => local.dismissOnEscape ?? true;

  let dialogRef: HTMLDivElement | undefined;

  const handleBackdropClick = (e: MouseEvent) => {
    if (dismissOnBackdrop() && e.target === dialogRef) {
      local.onClose();
    }
  };

  const handleEscapeKey = (e: KeyboardEvent) => {
    if (dismissOnEscape() && e.key === 'Escape' && local.open) {
      local.onClose();
    }
  };

  createEffect(() => {
    if (local.open) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscapeKey);
    } else {
      document.body.style.overflow = '';
    }
  });

  onCleanup(() => {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleEscapeKey);
  });

  const dialogClassNames = () => {
    const classes = ['dialog'];

    if (size() !== 'medium') {
      classes.push(`dialog--${size()}`);
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <Show when={local.open}>
      <Portal>
        <div
          ref={dialogRef}
          class="dialog__backdrop"
          onClick={handleBackdropClick}
          {...rest}
        >
          <div class={dialogClassNames()} role="dialog" aria-modal="true">
            <Card variant="emphasized" padding="normal">
              {local.children}
            </Card>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

interface DialogHeaderProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  showClose?: boolean;
}

export const DialogHeader: Component<DialogHeaderProps> = (props) => {
  const showClose = () => props.showClose ?? true;

  return (
    <div class="dialog__header">
      <div class="dialog__header-content">
        <h2 class="dialog__title">{props.title}</h2>
        {props.subtitle && <p class="dialog__subtitle">{props.subtitle}</p>}
      </div>
      <Show when={showClose() && props.onClose}>
        <button
          type="button"
          class="dialog__close"
          onClick={props.onClose}
          aria-label="Close dialog"
        >
          <BsX />
        </button>
      </Show>
    </div>
  );
};

interface DialogFooterProps {
  children?: JSX.Element;
  align?: 'left' | 'center' | 'right';
}

export const DialogFooter: Component<DialogFooterProps> = (props) => {
  const align = () => props.align ?? 'right';

  const classNames = () => {
    const classes = ['dialog__footer'];

    if (align() !== 'right') {
      classes.push(`dialog__footer--${align()}`);
    }

    return classes.join(' ');
  };

  return (
    <div class={classNames()}>
      {props.children}
    </div>
  );
};
