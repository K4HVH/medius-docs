import { Component, JSX, splitProps, children } from 'solid-js';
import '../../styles/components/inputs/ButtonGroup.css';

interface ButtonGroupProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  children?: JSX.Element;
}

export const ButtonGroup: Component<ButtonGroupProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'orientation',
    'children',
    'class',
  ]);

  const orientation = () => local.orientation ?? 'horizontal';

  const classNames = () => {
    const classes = ['button-group'];

    if (orientation() === 'vertical') {
      classes.push('button-group--vertical');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const isVertical = orientation() === 'vertical';
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

    if (e.key !== nextKey && e.key !== prevKey && e.key !== 'Home' && e.key !== 'End') return;

    const container = e.currentTarget as HTMLElement;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (buttons.length === 0) return;

    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;

    e.preventDefault();
    let next: number;

    if (e.key === nextKey) next = current < buttons.length - 1 ? current + 1 : 0;
    else if (e.key === prevKey) next = current > 0 ? current - 1 : buttons.length - 1;
    else if (e.key === 'Home') next = 0;
    else next = buttons.length - 1;

    buttons.forEach(b => b.setAttribute('tabindex', '-1'));
    buttons[next].setAttribute('tabindex', '0');
    buttons[next].focus();
  };

  return (
    <div class={classNames()} role="group" aria-orientation={orientation()} onKeyDown={handleKeyDown} {...rest}>
      {local.children}
    </div>
  );
};
