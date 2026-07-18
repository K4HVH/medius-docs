import { Component, For, Show, splitProps, createSignal, createEffect, onCleanup } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { BsChevronUp, BsChevronDown, BsChevronLeft, BsChevronRight } from 'solid-icons/bs';
import '../../styles/components/navigation/Tabs.css';

export interface TabOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: Component;
}

interface TabsProps {
  options: TabOption[];
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  variant?: 'primary' | 'secondary' | 'subtle';
  orientation?: 'horizontal' | 'vertical';
  size?: 'compact' | 'normal' | 'spacious';
  iconOnly?: boolean;
  disabled?: boolean;
  scrollable?: boolean;
  class?: string;
}

export const Tabs: Component<TabsProps> = (props) => {
  const [local] = splitProps(props, [
    'options',
    'value',
    'onChange',
    'defaultValue',
    'variant',
    'orientation',
    'size',
    'iconOnly',
    'disabled',
    'scrollable',
    'class',
  ]);

  const variant = () => local.variant ?? 'primary';
  const orientation = () => local.orientation ?? 'horizontal';
  const size = () => local.size ?? 'normal';

  let scrollContainerRef: HTMLDivElement | undefined;
  let scrollIntervalRef: number | undefined;
  let isButtonScrolling = false;
  const [canScrollStart, setCanScrollStart] = createSignal(false);
  const [canScrollEnd, setCanScrollEnd] = createSignal(false);

  const isControlled = () => local.value !== undefined;
  const [internalValue, setInternalValue] = createSignal(
    local.defaultValue ?? local.options[0]?.value ?? ''
  );

  const currentValue = () => isControlled() ? local.value! : internalValue();

  const setValue = (newValue: string) => {
    if (!isControlled()) {
      setInternalValue(newValue);
    }
    local.onChange?.(newValue);
  };

  const handleClick = (option: TabOption) => {
    if (local.disabled || option.disabled) return;
    setValue(option.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const isHorizontal = orientation() === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    let direction: 1 | -1 | null = null;
    if (e.key === nextKey) direction = 1;
    else if (e.key === prevKey) direction = -1;
    else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const enabledOptions = local.options.filter(o => !o.disabled && !local.disabled);
      if (enabledOptions.length === 0) return;
      const target = e.key === 'Home' ? enabledOptions[0] : enabledOptions[enabledOptions.length - 1];
      setValue(target.value);
      const container = (e.currentTarget as HTMLElement);
      const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const targetIndex = local.options.indexOf(target);
      buttons[targetIndex]?.focus();
      return;
    } else {
      return;
    }

    e.preventDefault();
    const currentIndex = local.options.findIndex(o => o.value === currentValue());
    let nextIndex = currentIndex;
    const len = local.options.length;

    for (let i = 1; i <= len; i++) {
      const candidate = (currentIndex + direction * i + len) % len;
      const option = local.options[candidate];
      if (!option.disabled && !local.disabled) {
        nextIndex = candidate;
        break;
      }
    }

    if (nextIndex !== currentIndex) {
      setValue(local.options[nextIndex].value);
      const container = (e.currentTarget as HTMLElement);
      const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[nextIndex]?.focus();
    }
  };

  const updateScrollIndicators = () => {
    if (!local.scrollable || !scrollContainerRef) return;

    const isHorizontal = orientation() === 'horizontal';
    const scrollPos = isHorizontal ? scrollContainerRef.scrollLeft : scrollContainerRef.scrollTop;
    const scrollSize = isHorizontal ? scrollContainerRef.scrollWidth : scrollContainerRef.scrollHeight;
    const clientSize = isHorizontal ? scrollContainerRef.clientWidth : scrollContainerRef.clientHeight;

    setCanScrollStart(scrollPos > 1);
    setCanScrollEnd(scrollPos < scrollSize - clientSize - 1);
  };

  const handleScroll = () => {
    if (!isButtonScrolling && scrollIntervalRef !== undefined) {
      stopContinuousScroll();
    }
    updateScrollIndicators();
  };

  const scrollOneTab = (direction: -1 | 1) => {
    if (!scrollContainerRef) return;

    const isHorizontal = orientation() === 'horizontal';
    const tabs = scrollContainerRef.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (tabs.length === 0) return;

    const firstTab = tabs[0];
    const computedStyle = window.getComputedStyle(scrollContainerRef);
    const gap = parseFloat(computedStyle.gap || '0');

    const tabSize = isHorizontal
      ? firstTab.offsetWidth + gap
      : firstTab.offsetHeight + gap;

    const scrollAmount = tabSize * direction;

    if (isHorizontal) {
      scrollContainerRef.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    } else {
      scrollContainerRef.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const startContinuousScroll = (direction: -1 | 1) => {
    if (!scrollContainerRef) return;

    const isHorizontal = orientation() === 'horizontal';
    const scrollStep = 3;

    scrollIntervalRef = window.setInterval(() => {
      if (!scrollContainerRef) return;

      if (isHorizontal) {
        scrollContainerRef.scrollBy({
          left: scrollStep * direction,
          behavior: 'auto'
        });
      } else {
        scrollContainerRef.scrollBy({
          top: scrollStep * direction,
          behavior: 'auto'
        });
      }
    }, 16);
  };

  const stopContinuousScroll = () => {
    if (scrollIntervalRef !== undefined) {
      clearInterval(scrollIntervalRef);
      scrollIntervalRef = undefined;
    }
    isButtonScrolling = false;
  };

  const handleIndicatorPointerDown = (direction: -1 | 1, e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isButtonScrolling = true;

    if (scrollIntervalRef !== undefined) {
      clearInterval(scrollIntervalRef);
      scrollIntervalRef = undefined;
    }

    // Global listener catches release even if the pointer leaves the button.
    const handleGlobalPointerUp = () => {
      stopContinuousScroll();
      document.removeEventListener('pointerup', handleGlobalPointerUp);
    };
    document.addEventListener('pointerup', handleGlobalPointerUp);

    startContinuousScroll(direction);
  };

  const handleIndicatorPointerUp = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stopContinuousScroll();
  };

  createEffect(() => {
    if (!local.scrollable || !scrollContainerRef) return;

    updateScrollIndicators();

    scrollContainerRef.addEventListener('scroll', handleScroll);

    // Delay so layout is complete before measuring.
    const timeoutId = setTimeout(() => {
      updateScrollIndicators();
    }, 100);

    onCleanup(() => {
      scrollContainerRef?.removeEventListener('scroll', handleScroll);
      stopContinuousScroll();
      clearTimeout(timeoutId);
    });
  });

  createEffect(() => {
    if (!local.scrollable) return;

    const handleResize = () => updateScrollIndicators();
    window.addEventListener('resize', handleResize);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
    });
  });

  const classNames = () => {
    const classes = ['tabs'];

    classes.push(`tabs--${variant()}`);

    if (orientation() === 'vertical') {
      classes.push('tabs--vertical');
    }

    if (size() !== 'normal') {
      classes.push(`tabs--${size()}`);
    }

    if (local.iconOnly) {
      classes.push('tabs--icon-only');
    }

    if (local.disabled) {
      classes.push('tabs--disabled');
    }

    if (local.scrollable) {
      classes.push('tabs--scrollable');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  const getScrollIcon = (position: 'start' | 'end') => {
    const isHorizontal = orientation() === 'horizontal';
    if (isHorizontal) {
      return position === 'start' ? BsChevronLeft : BsChevronRight;
    } else {
      return position === 'start' ? BsChevronUp : BsChevronDown;
    }
  };

  const renderTabs = () => (
    <For each={local.options}>
      {(option) => {
        const isActive = () => currentValue() === option.value;
        const isDisabled = () => local.disabled || option.disabled;

        const tabClasses = () => {
          const classes = ['tabs__tab'];
          if (isActive()) classes.push('tabs__tab--active');
          if (isDisabled()) classes.push('tabs__tab--disabled');
          return classes.join(' ');
        };

        return (
          <button
            class={tabClasses()}
            role="tab"
            aria-selected={isActive()}
            aria-label={local.iconOnly ? option.label : undefined}
            tabIndex={isActive() ? 0 : -1}
            disabled={isDisabled()}
            onClick={() => handleClick(option)}
          >
            <Show when={option.icon}>
              <span class="tabs__tab-icon">
                <Dynamic component={option.icon!} />
              </span>
            </Show>
            <Show when={!local.iconOnly}>
              <span class="tabs__tab-label">{option.label}</span>
            </Show>
          </button>
        );
      }}
    </For>
  );

  const wrapperClassNames = () => {
    const classes = ['tabs-scrollable-wrapper'];
    if (orientation() === 'vertical') {
      classes.push('tabs-scrollable-wrapper--vertical');
    }
    return classes.join(' ');
  };

  if (local.scrollable) {
    return (
      <div class={wrapperClassNames()}>
        <div
          ref={scrollContainerRef}
          class={`${classNames()} tabs__scroll-container`}
          role="tablist"
          aria-orientation={orientation()}
          onKeyDown={handleKeyDown}
        >
          {renderTabs()}
        </div>

        <Show when={canScrollStart()}>
          <button
            class="tabs__scroll-indicator tabs__scroll-indicator--start"
            onPointerDown={(e) => handleIndicatorPointerDown(-1, e)}
            onPointerUp={handleIndicatorPointerUp}
            onPointerLeave={handleIndicatorPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Scroll to previous tabs"
          >
            <Dynamic component={getScrollIcon('start')} />
          </button>
        </Show>

        <Show when={canScrollEnd()}>
          <button
            class="tabs__scroll-indicator tabs__scroll-indicator--end"
            onPointerDown={(e) => handleIndicatorPointerDown(1, e)}
            onPointerUp={handleIndicatorPointerUp}
            onPointerLeave={handleIndicatorPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Scroll to next tabs"
          >
            <Dynamic component={getScrollIcon('end')} />
          </button>
        </Show>
      </div>
    );
  }

  return (
    <div
      class={classNames()}
      role="tablist"
      aria-orientation={orientation()}
      onKeyDown={handleKeyDown}
    >
      {renderTabs()}
    </div>
  );
};
