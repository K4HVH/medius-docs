import { Component, JSX, Show, splitProps } from 'solid-js';
import { BsExclamationCircle } from 'solid-icons/bs';
import '../../styles/components/feedback/FieldError.css';

interface FieldErrorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  error?: string;
  id?: string;
}

export const FieldError: Component<FieldErrorProps> = (props) => {
  const [local, rest] = splitProps(props, ['error', 'class', 'id']);

  const classNames = () => {
    const classes = ['field-error'];

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <Show when={local.error}>
      <div
        id={local.id}
        class={classNames()}
        role="alert"
        aria-live="polite"
        {...rest}
      >
        <BsExclamationCircle />
        <span class="field-error__message">{local.error}</span>
      </div>
    </Show>
  );
};
