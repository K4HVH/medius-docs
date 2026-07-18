import { Component, createSignal, createEffect, Show, For, splitProps, JSX } from 'solid-js';
import { Checkbox } from './Checkbox';
import { Menu } from '../navigation/Menu';
import { Chip } from '../display/Chip';
import { useFormField } from '../../contexts/FormFieldContext';
import '../../styles/components/inputs/Combobox.css';

interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: Component;
  iconUnchecked?: Component;
  iconChecked?: Component;
}

interface ComboboxProps {
  name?: string;
  id?: string;
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  onBlur?: () => void;
  options: ComboboxOption[];
  placeholder?: string;
  size?: 'normal' | 'compact';
  disabled?: boolean;
  multiple?: boolean;
  required?: boolean;
  error?: string;
  invalid?: boolean;
  class?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-labelledby'?: string;
}

export const Combobox: Component<ComboboxProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'name',
    'id',
    'value',
    'onChange',
    'onBlur',
    'options',
    'placeholder',
    'size',
    'disabled',
    'multiple',
    'required',
    'error',
    'invalid',
    'class',
    'aria-describedby',
    'aria-required',
    'aria-labelledby',
  ]);

  const fieldCtx = useFormField();
  const inputId = () => local.id ?? fieldCtx?.fieldId;
  const ariaDescribedBy = () => local['aria-describedby'] ?? fieldCtx?.ariaDescribedBy?.();
  const ariaRequired = () => local['aria-required'] ?? local.required ?? fieldCtx?.required;

  const [isOpen, setIsOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);

  let triggerRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (local.name) triggerRef?.setAttribute('name', local.name);
    else triggerRef?.removeAttribute('name');
  });

  // No auto-highlight on open; only keyboard nav or pointer hover sets active
  createEffect(() => {
    if (!isOpen()) {
      setActiveIndex(-1);
    }
  });

  const size = () => local.size ?? 'normal';

  const selectedValues = (): string[] => {
    if (local.multiple) {
      return Array.isArray(local.value) ? local.value : [];
    }
    return local.value && typeof local.value === 'string' ? [local.value] : [];
  };

  const selectedOptions = () => {
    const values = selectedValues();
    return local.options.filter(opt => values.includes(opt.value));
  };

  const isSelected = (value: string) => {
    return selectedValues().includes(value);
  };

  const handleSelect = (value: string) => {
    if (!local.onChange) return;

    if (local.multiple) {
      const currentValues = selectedValues();
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      local.onChange(newValues);
    } else {
      local.onChange(value);
      setIsOpen(false);
    }
  };

  const handleRemove = (value: string) => {
    if (!local.onChange || !local.multiple) return;
    const currentValues = selectedValues();
    const newValues = currentValues.filter(v => v !== value);
    local.onChange(newValues);
  };

  const getEnabledIndices = () => local.options.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;

    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen() && activeIndex() >= 0) {
        const option = local.options[activeIndex()];
        if (option && !option.disabled) {
          handleSelect(option.value);
        }
      } else {
        setIsOpen(!isOpen());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen()) {
        setIsOpen(true);
      }
      const enabled = getEnabledIndices();
      if (enabled.length === 0) return;
      const current = activeIndex();
      if (current === -1) {
        // First keyboard nav: jump to first selected or first enabled
        const selVals = selectedValues();
        const firstSelectedIdx = local.options.findIndex(o => !o.disabled && selVals.includes(o.value));
        setActiveIndex(firstSelectedIdx >= 0 ? firstSelectedIdx : enabled[0]);
      } else {
        const pos = enabled.indexOf(current);
        const next = pos < enabled.length - 1 ? enabled[pos + 1] : enabled[0];
        setActiveIndex(next);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) {
        setIsOpen(true);
      }
      const enabled = getEnabledIndices();
      if (enabled.length === 0) return;
      const current = activeIndex();
      if (current === -1) {
        // First keyboard nav: jump to last enabled
        setActiveIndex(enabled[enabled.length - 1]);
      } else {
        const pos = enabled.indexOf(current);
        const next = pos > 0 ? enabled[pos - 1] : enabled[enabled.length - 1];
        setActiveIndex(next);
      }
    } else if (e.key === 'Home') {
      if (isOpen()) {
        e.preventDefault();
        const enabled = getEnabledIndices();
        if (enabled.length > 0) setActiveIndex(enabled[0]);
      }
    } else if (e.key === 'End') {
      if (isOpen()) {
        e.preventDefault();
        const enabled = getEnabledIndices();
        if (enabled.length > 0) setActiveIndex(enabled[enabled.length - 1]);
      }
    }
  };

  const classNames = () => {
    const classes = ['combobox'];

    if (local.disabled) {
      classes.push('combobox--disabled');
    }

    if (size() === 'compact') {
      classes.push('combobox--compact');
    }

    if (isOpen()) {
      classes.push('combobox--open');
    }

    if (local.invalid || local.error) {
      classes.push('combobox--invalid');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <Menu
      trigger={
        <div
          ref={triggerRef}
          id={inputId()}
          class={classNames()}
          tabIndex={local.disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen()}
          aria-haspopup="listbox"
          aria-activedescendant={activeIndex() >= 0 ? `${inputId()}-option-${activeIndex()}` : undefined}
          onKeyDown={handleKeyDown}
          onBlur={local.onBlur}
          aria-invalid={local.invalid || !!local.error}
          aria-describedby={ariaDescribedBy()}
          aria-required={ariaRequired()}
          aria-labelledby={local['aria-labelledby']}
          {...rest}
        >
          <div class="combobox__trigger">
            <span class="combobox__value">
              <Show when={selectedOptions().length > 0} fallback={<span class="combobox__placeholder">{local.placeholder || 'Select...'}</span>}>
                {local.multiple ? (
                  <div class="combobox__chips">
                    <For each={selectedOptions()}>
                      {(option) => {
                        const Icon = option.iconChecked || option.icon;
                        return (
                          <Chip
                            icon={Icon}
                            onRemove={() => handleRemove(option.value)}
                            size={size()}
                          >
                            {option.label}
                          </Chip>
                        );
                      }}
                    </For>
                  </div>
                ) : (
                  (() => {
                    const option = selectedOptions()[0];
                    const Icon = option?.icon;
                    return (
                      <>
                        {Icon && (
                          <span class="combobox__icon">
                            <Icon />
                          </span>
                        )}
                        <span>{option?.label}</span>
                      </>
                    );
                  })()
                )}
              </Show>
            </span>
            <span class="combobox__arrow" />
          </div>
        </div>
      }
      open={isOpen()}
      onOpenChange={(open) => {
        if (!local.disabled) {
          setIsOpen(open);
        }
      }}
      openOn="click"
      placement="bottom-start"
      matchTriggerWidth={true}
      closeOnContentClick={false}
      anchored={true}
      variant="default"
      size={size()}
      wrapperClass="combobox-wrapper"
    >
      <div class={`combobox__dropdown${size() === 'compact' ? ' combobox__dropdown--compact' : ''}`} role="listbox" aria-multiselectable={local.multiple || undefined}>
        <For each={local.options}>
          {(option, index) => (
            <div
              id={`${inputId()}-option-${index()}`}
              class={`combobox__option ${option.disabled ? 'combobox__option--disabled' : ''} ${isSelected(option.value) ? 'combobox__option--selected' : ''} ${activeIndex() === index() ? 'combobox__option--active' : ''}`}
              role="option"
              aria-selected={isSelected(option.value)}
              aria-disabled={option.disabled}
              onPointerDown={(e) => {
                if (option.disabled) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              onPointerEnter={() => {
                if (!option.disabled) setActiveIndex(index());
              }}
              onClick={(e) => {
                if (option.disabled) {
                  e.stopPropagation();
                  return;
                }
                handleSelect(option.value);
              }}
            >
              {local.multiple ? (
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'contents' }}>
                  <Checkbox
                    checked={isSelected(option.value)}
                    disabled={option.disabled}
                    iconUnchecked={option.iconUnchecked}
                    iconChecked={option.iconChecked}
                    onChange={() => handleSelect(option.value)}
                  />
                </span>
              ) : (
                option.icon && (
                  <span class="combobox__icon">
                    <option.icon />
                  </span>
                )
              )}
              <span>{option.label}</span>
            </div>
          )}
        </For>
      </div>
    </Menu>
  );
};
