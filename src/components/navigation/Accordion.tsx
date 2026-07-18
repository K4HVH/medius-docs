import { Component, JSX, For, Show, splitProps, createSignal, createContext, useContext, children as resolveChildren } from 'solid-js';
import { BsChevronRight } from 'solid-icons/bs';
import '../../styles/components/navigation/Accordion.css';

export interface AccordionItemConfig {
  value: string;
  title: string | JSX.Element;
  content: JSX.Element;
  icon?: Component;
  disabled?: boolean;
}

interface AccordionContextValue {
  isExpanded: (value: string) => boolean;
  toggle: (value: string) => void;
  variant: () => 'default' | 'emphasized' | 'subtle';
  size: () => 'compact' | 'normal' | 'spacious';
}

const AccordionContext = createContext<AccordionContextValue>();

interface AccordionProps {
  items?: AccordionItemConfig[];
  children?: JSX.Element;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  exclusive?: boolean;
  variant?: 'default' | 'emphasized' | 'subtle';
  size?: 'compact' | 'normal' | 'spacious';
  class?: string;
}

export const Accordion: Component<AccordionProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'items',
    'children',
    'value',
    'defaultValue',
    'onChange',
    'exclusive',
    'variant',
    'size',
    'class',
  ]);

  const variant = () => local.variant ?? 'default';
  const size = () => local.size ?? 'normal';
  const exclusive = () => local.exclusive ?? true;

  const isControlled = () => local.value !== undefined;
  const [internalValue, setInternalValue] = createSignal<string[]>(
    local.defaultValue ?? []
  );

  const currentValue = () => isControlled() ? local.value! : internalValue();

  const setValue = (newValue: string[]) => {
    if (!isControlled()) {
      setInternalValue(newValue);
    }
    local.onChange?.(newValue);
  };

  const isExpanded = (value: string) => currentValue().includes(value);

  const toggle = (value: string) => {
    const current = currentValue();

    if (isExpanded(value)) {
      setValue(current.filter(v => v !== value));
    } else {
      if (exclusive()) {
        setValue([value]);
      } else {
        setValue([...current, value]);
      }
    }
  };

  const classNames = () => {
    const classes = ['accordion'];

    classes.push(`accordion--${variant()}`);

    if (size() !== 'normal') {
      classes.push(`accordion--${size()}`);
    }

    if (exclusive()) {
      classes.push('accordion--exclusive');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  const contextValue: AccordionContextValue = {
    isExpanded,
    toggle,
    variant,
    size,
  };

  return (
    <AccordionContext.Provider value={contextValue}>
      <div class={classNames()} {...rest}>
        <Show when={local.items}>
          <For each={local.items}>
            {(item) => (
              <AccordionItem
                value={item.value}
                title={item.title}
                icon={item.icon}
                disabled={item.disabled}
              >
                {item.content}
              </AccordionItem>
            )}
          </For>
        </Show>
        <Show when={local.children}>
          {local.children}
        </Show>
      </div>
    </AccordionContext.Provider>
  );
};

interface AccordionItemProps {
  value: string;
  title: string | JSX.Element;
  icon?: Component;
  disabled?: boolean;
  children: JSX.Element;
  class?: string;
}

export const AccordionItem: Component<AccordionItemProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'value',
    'title',
    'icon',
    'disabled',
    'children',
    'class',
  ]);

  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('AccordionItem must be used within an Accordion');
  }

  const isExpanded = () => context.isExpanded(local.value);
  const disabled = () => local.disabled ?? false;

  const handleClick = () => {
    if (disabled()) return;
    context.toggle(local.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled()) return;
    const header = e.currentTarget as HTMLElement;
    const accordion = header.closest('.accordion');
    if (!accordion) return;

    const headers = Array.from(accordion.querySelectorAll<HTMLButtonElement>('.accordion__header:not([disabled])'));
    const currentIndex = headers.indexOf(header as HTMLButtonElement);
    if (currentIndex < 0) return;

    let targetIndex: number | null = null;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetIndex = currentIndex < headers.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetIndex = currentIndex > 0 ? currentIndex - 1 : headers.length - 1;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = headers.length - 1;
    }

    if (targetIndex !== null) {
      headers[targetIndex]?.focus();
    }
  };

  const itemClassNames = () => {
    const classes = ['accordion__item'];

    if (isExpanded()) {
      classes.push('accordion__item--expanded');
    }

    if (disabled()) {
      classes.push('accordion__item--disabled');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  const headerClassNames = () => {
    return 'accordion__header';
  };

  const iconClassNames = () => {
    const classes = ['accordion__icon'];

    if (isExpanded()) {
      classes.push('accordion__icon--expanded');
    }

    return classes.join(' ');
  };

  const content = resolveChildren(() => local.children);

  const contentClassNames = () => {
    const classes = ['accordion__content'];

    if (isExpanded()) {
      classes.push('accordion__content--expanded');
    }

    return classes.join(' ');
  };

  return (
    <div class={itemClassNames()} {...rest}>
      <button
        class={headerClassNames()}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled()}
        aria-expanded={isExpanded()}
        aria-disabled={disabled()}
      >
        <Show when={local.icon}>
          <span class="accordion__custom-icon">
            {local.icon && <local.icon />}
          </span>
        </Show>
        <span class="accordion__title">{local.title}</span>
        <span class={iconClassNames()}>
          <BsChevronRight />
        </span>
      </button>
      <div class={contentClassNames()}>
        <div class="accordion__content-inner">
          {content()}
        </div>
      </div>
    </div>
  );
};
