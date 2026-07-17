import { Component, JSX, Show, createSignal, createEffect, createMemo, onCleanup, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { BsChevronLeft, BsChevronRight, BsChevronUp, BsChevronDown } from 'solid-icons/bs';
import '../../styles/components/navigation/Pane.css';

export type PaneState = 'closed' | 'partial' | 'open';
export type PanePosition = 'left' | 'right' | 'top' | 'bottom';

interface PaneProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Which edge the pane attaches to. Default: 'left' */
  position?: PanePosition;

  /** Permanent panes always show a handle. Temporary panes can be fully hidden. Default: 'permanent' */
  mode?: 'permanent' | 'temporary';

  /** Push displaces adjacent content. Overlay slides over content. Default: 'push' for permanent, 'overlay' for temporary */
  behavior?: 'push' | 'overlay';

  /** Controlled state */
  state?: PaneState;

  /** Callback when state changes */
  onStateChange?: (state: PaneState) => void;

  /** Initial state for uncontrolled mode. Default: 'closed' */
  defaultState?: PaneState;

  /** Show a clickable handle to toggle state. Default: true for permanent, false for temporary */
  handle?: boolean;

  /** Show backdrop when overlay pane is not closed. Default: true */
  backdrop?: boolean;

  /** Use fixed positioning (viewport-level) instead of absolute (container-level). Only applies to overlay behavior. Default: false */
  fixed?: boolean;

  /** CSS value for open state size. Default: '280px' for left/right, '240px' for top/bottom */
  openSize?: string;

  /** CSS value for partial state size. Default: '56px' */
  partialSize?: string;

  /** Size variant affecting handle dimensions. Default: 'normal' */
  size?: 'compact' | 'normal' | 'spacious';

  /** Content shown in the open state */
  children?: JSX.Element;

  /** Content shown in the partial state. If not provided, partial state is skipped in the cycle. */
  partialChildren?: JSX.Element;

  class?: string;
}

export const Pane: Component<PaneProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'position',
    'mode',
    'behavior',
    'state',
    'onStateChange',
    'defaultState',
    'handle',
    'backdrop',
    'fixed',
    'openSize',
    'partialSize',
    'size',
    'children',
    'partialChildren',
    'class',
  ]);

  // Defaults
  const position = () => local.position ?? 'left';
  const mode = () => local.mode ?? 'permanent';
  const behavior = () => local.behavior ?? (mode() === 'permanent' ? 'push' : 'overlay');
  const showHandle = () => local.handle ?? (mode() === 'permanent');
  const showBackdrop = () => local.backdrop ?? true;
  const isFixed = () => local.fixed ?? false;
  const sizeVariant = () => local.size ?? 'normal';
  const isHorizontal = () => position() === 'left' || position() === 'right';

  // State management: controlled or uncontrolled
  const isControlled = () => local.state !== undefined;
  const [internalState, setInternalState] = createSignal<PaneState>(local.defaultState ?? 'closed');

  const currentState = (): PaneState => isControlled() ? local.state! : internalState();

  const setState = (newState: PaneState) => {
    if (!isControlled()) {
      setInternalState(newState);
    }
    local.onStateChange?.(newState);
  };

  // Handle click cycles: closed → partial → open → closed
  // Includes partial if partialChildren or partialSize is provided
  const cycleState = () => {
    const current = currentState();
    const hasPartial = local.partialChildren !== undefined || local.partialSize !== undefined;

    if (current === 'closed') {
      setState(hasPartial ? 'partial' : 'open');
    } else if (current === 'partial') {
      setState('open');
    } else {
      setState('closed');
    }
  };

  // Backdrop click closes the pane
  const handleBackdropClick = () => {
    setState('closed');
  };

  // Escape key closes temporary overlay panes
  createEffect(() => {
    if (mode() === 'temporary' && currentState() !== 'closed') {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setState('closed');
        }
      };
      document.addEventListener('keydown', handler);
      onCleanup(() => document.removeEventListener('keydown', handler));
    }
  });

  // Base chevron icon per position, points outward (toward opening direction).
  // Rotated 180deg via CSS when open to point inward (toward closing).
  const baseIcon = createMemo(() => {
    switch (position()) {
      case 'left': return BsChevronRight;
      case 'right': return BsChevronLeft;
      case 'top': return BsChevronDown;
      default: return BsChevronUp;
    }
  });

  // CSS custom properties for sizing
  const paneStyle = (): JSX.CSSProperties => ({
    '--pane-open-size': local.openSize ?? (isHorizontal() ? '280px' : '240px'),
    '--pane-partial-size': local.partialSize ?? '56px',
  });

  // Class names
  const classNames = () => {
    const classes = ['pane'];
    classes.push(`pane--${position()}`);
    classes.push(`pane--${currentState()}`);
    classes.push(`pane--${mode()}`);

    if (behavior() === 'overlay') {
      classes.push('pane--overlay');
    }

    if (isFixed()) {
      classes.push('pane--fixed');
    }

    if (sizeVariant() !== 'normal') {
      classes.push(`pane--${sizeVariant()}`);
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  // Backdrop visible when overlay + not closed
  const isBackdropVisible = () =>
    behavior() === 'overlay' &&
    showBackdrop() &&
    currentState() !== 'closed';

  // ARIA label for handle
  const handleLabel = () => {
    const state = currentState();
    if (state === 'closed') return 'Open pane';
    if (state === 'partial') return 'Expand pane';
    return 'Close pane';
  };

  return (
    <>
      <div
        class="pane__backdrop"
        classList={{
          'pane__backdrop--visible': isBackdropVisible(),
          'pane__backdrop--fixed': isFixed(),
        }}
        onClick={handleBackdropClick}
      />
      <div
        class={classNames()}
        style={paneStyle()}
        role="region"
        aria-expanded={currentState() !== 'closed'}
        {...rest}
      >
        <div class="pane__body">
          <div
            class="pane__content pane__content--full"
            classList={{ 'pane__content--active': currentState() === 'open' || (currentState() === 'partial' && !local.partialChildren) }}
          >
            {local.children}
          </div>
          <Show when={local.partialChildren}>
            <div
              class="pane__content pane__content--partial"
              classList={{ 'pane__content--active': currentState() === 'partial' }}
            >
              {local.partialChildren}
            </div>
          </Show>
        </div>
        <Show when={showHandle()}>
          <button
            class="pane__handle"
            onClick={cycleState}
            aria-label={handleLabel()}
          >
            <span
              class="pane__handle-icon"
              classList={{ 'pane__handle-icon--rotated': currentState() === 'open' }}
            >
              <Dynamic component={baseIcon()} />
            </span>
          </button>
        </Show>
      </div>
    </>
  );
};
