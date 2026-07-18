import {
  Component,
  JSX,
  Show,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  splitProps,
  children as resolveChildren,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { BsChevronRight } from 'solid-icons/bs';
import '../../styles/components/navigation/Menu.css';

export interface MenuProps {
  trigger: JSX.Element;
  children: JSX.Element;
  openOn?: 'click' | 'contextmenu' | 'both';
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start';
  autoFlip?: boolean;
  anchored?: boolean; // menu follows trigger on scroll/resize (default: true)
  matchTriggerWidth?: boolean; // menu width matches trigger width (default: false)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnContentClick?: boolean; // menu closes when content is clicked (default: true)
  variant?: 'default' | 'emphasized' | 'subtle';
  size?: 'compact' | 'normal' | 'spacious';
  class?: string;
  wrapperClass?: string;
}

export const Menu: Component<MenuProps> = (props) => {
  const [local] = splitProps(props, [
    'trigger',
    'children',
    'openOn',
    'placement',
    'autoFlip',
    'anchored',
    'matchTriggerWidth',
    'open',
    'onOpenChange',
    'closeOnContentClick',
    'variant',
    'size',
    'class',
    'wrapperClass',
  ]);

  const openOn = () => local.openOn ?? 'both';
  const placement = () => local.placement ?? 'bottom-start';
  const autoFlip = () => local.autoFlip ?? true;
  const anchored = () => local.anchored ?? true;
  const matchTriggerWidth = () => local.matchTriggerWidth ?? false;
  const closeOnContentClick = () => local.closeOnContentClick ?? true;
  const variant = () => local.variant ?? 'default';
  const size = () => local.size ?? 'normal';

  const isControlled = () => local.open !== undefined;
  const [internalOpen, setInternalOpen] = createSignal(false);
  const isOpen = () => (isControlled() ? local.open! : internalOpen());

  const setOpen = (value: boolean) => {
    if (!isControlled()) {
      setInternalOpen(value);
    }
    local.onOpenChange?.(value);
  };

  let triggerRef: HTMLDivElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  const [position, setPosition] = createSignal({ top: 0, left: 0 });
  const [menuWidth, setMenuWidth] = createSignal<number | undefined>(undefined);
  const [finalPlacement, setFinalPlacement] = createSignal(placement());
  const [isPositioned, setIsPositioned] = createSignal(false);

  const updatePosition = () => {
    if (!triggerRef || !menuRef) return;

    const actualTriggerElement = triggerRef.firstElementChild || triggerRef;
    const triggerRect = actualTriggerElement.getBoundingClientRect();
    const menuRect = menuRef.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (menuRect.width === 0 || menuRect.height === 0) {
      // menu not fully rendered yet, retry next frame
      requestAnimationFrame(() => updatePosition());
      return;
    }

    let top = 0;
    let left = 0;
    let currentPlacement = placement();

    const gap = 4;

    switch (placement()) {
      case 'bottom-start':
        top = triggerRect.bottom + gap;
        left = triggerRect.left;
        break;
      case 'bottom-end':
        top = triggerRect.bottom + gap;
        left = triggerRect.right - menuRect.width;
        break;
      case 'top-start':
        top = triggerRect.top - menuRect.height - gap;
        left = triggerRect.left;
        break;
      case 'top-end':
        top = triggerRect.top - menuRect.height - gap;
        left = triggerRect.right - menuRect.width;
        break;
      case 'right-start':
        top = triggerRect.top;
        left = triggerRect.right + gap;
        break;
      case 'left-start':
        top = triggerRect.top;
        left = triggerRect.left - menuRect.width - gap;
        break;
    }

    if (autoFlip()) {
      const wouldOverflowBottom = top + menuRect.height > viewportHeight;
      const hasSpaceAbove = triggerRect.top - menuRect.height - gap >= 0;
      const wouldOverflowTop = top < 0;
      const hasSpaceBelow = triggerRect.bottom + menuRect.height + gap <= viewportHeight;
      const wouldOverflowRight = left + menuRect.width > viewportWidth;
      const hasSpaceOnLeft = triggerRect.left - menuRect.width - gap >= 0;
      const wouldOverflowLeft = left < 0;
      const hasSpaceOnRight = triggerRect.right + menuRect.width + gap <= viewportWidth;

      if (currentPlacement.startsWith('bottom') && wouldOverflowBottom && hasSpaceAbove) {
        currentPlacement = currentPlacement.replace('bottom', 'top') as typeof currentPlacement;
        top = triggerRect.top - menuRect.height - gap;
      } else if (currentPlacement.startsWith('top') && wouldOverflowTop && hasSpaceBelow) {
        currentPlacement = currentPlacement.replace('top', 'bottom') as typeof currentPlacement;
        top = triggerRect.bottom + gap;
      }

      if (currentPlacement === 'right-start' && wouldOverflowRight && hasSpaceOnLeft) {
        currentPlacement = 'left-start';
        left = triggerRect.left - menuRect.width - gap;
      } else if (currentPlacement === 'left-start' && wouldOverflowLeft && hasSpaceOnRight) {
        currentPlacement = 'right-start';
        left = triggerRect.right + gap;
      }

      if (currentPlacement.endsWith('-start') && wouldOverflowRight && !wouldOverflowLeft) {
        if (currentPlacement.startsWith('bottom') || currentPlacement.startsWith('top')) {
          currentPlacement = currentPlacement.replace('-start', '-end') as typeof currentPlacement;
          left = triggerRect.right - menuRect.width;
        }
      } else if (currentPlacement.endsWith('-end') && wouldOverflowLeft && !wouldOverflowRight) {
        if (currentPlacement.startsWith('bottom') || currentPlacement.startsWith('top')) {
          currentPlacement = currentPlacement.replace('-end', '-start') as typeof currentPlacement;
          left = triggerRect.left;
        }
      }
    }

    setPosition({ top, left });
    setFinalPlacement(currentPlacement);

    if (matchTriggerWidth()) {
      setMenuWidth(triggerRect.width);
    }

    setIsPositioned(true);
  };

  const handleTriggerClick = (e: MouseEvent) => {
    if (openOn() === 'click' || openOn() === 'both') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!isOpen());
    }
  };

  const handleTriggerContextMenu = (e: MouseEvent) => {
    if (openOn() === 'contextmenu' || openOn() === 'both') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (!menuRef || !triggerRef) return;
    const target = e.target as Node;
    const clickedInMenu = menuRef.contains(target);
    const clickedInTrigger = triggerRef.contains(target);

    if (!clickedInMenu && !clickedInTrigger) {
      setOpen(false);
    } else if (clickedInMenu && closeOnContentClick()) {
      setOpen(false);
    }
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      setOpen(false);
      const focusTarget = triggerRef?.querySelector<HTMLElement>('[tabindex], button, a, input') || triggerRef;
      focusTarget?.focus();
    }
  };

  let typeAheadBuffer = '';
  let typeAheadTimer: number | undefined;

  const getMenuItems = (): HTMLButtonElement[] => {
    if (!menuRef) return [];
    return Array.from(menuRef.querySelectorAll<HTMLButtonElement>('.menu__item:not(.menu__item--disabled):not([disabled])'));
  };

  const focusMenuItem = (index: number) => {
    const items = getMenuItems();
    if (items.length === 0) return;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    items[clamped]?.focus();
  };

  const handleMenuKeyDown = (e: KeyboardEvent) => {
    const items = getMenuItems();
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        focusMenuItem(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        focusMenuItem(prev);
        break;
      }
      case 'Home': {
        e.preventDefault();
        focusMenuItem(0);
        break;
      }
      case 'End': {
        e.preventDefault();
        focusMenuItem(items.length - 1);
        break;
      }
      case 'ArrowRight': {
        const current = items[currentIndex];
        if (current?.classList.contains('menu__item--has-submenu')) {
          e.preventDefault();
          // dispatch pointerenter to open the hover-driven submenu, then focus its first item
          current.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const submenu = document.querySelector('.menu--submenu:last-of-type');
              const firstItem = submenu?.querySelector<HTMLButtonElement>('.menu__item:not(.menu__item--disabled):not([disabled])');
              firstItem?.focus();
            });
          });
        }
        break;
      }
      case 'ArrowLeft': {
        // handled at the submenu level
        break;
      }
      case 'Enter':
      case ' ': {
        // native button handles the click; here we only add submenu behavior
        if (items[currentIndex]?.classList.contains('menu__item--has-submenu')) {
          e.preventDefault();
          items[currentIndex].dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const submenu = document.querySelector('.menu--submenu:last-of-type');
              const firstItem = submenu?.querySelector<HTMLButtonElement>('.menu__item:not(.menu__item--disabled):not([disabled])');
              firstItem?.focus();
            });
          });
        }
        break;
      }
      case 'Escape': {
        // handled by the global handler
        break;
      }
      default: {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          typeAheadBuffer += e.key.toLowerCase();
          clearTimeout(typeAheadTimer);
          typeAheadTimer = window.setTimeout(() => { typeAheadBuffer = ''; }, 500);

          const match = items.findIndex((item) => {
            const text = item.textContent?.trim().toLowerCase() ?? '';
            return text.startsWith(typeAheadBuffer);
          });
          if (match >= 0) focusMenuItem(match);
        }
        break;
      }
    }
  };

  onMount(() => {
    // pointerdown gives faster response and touch compatibility
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    if (anchored()) {
      window.addEventListener('scroll', updatePosition, true); // capture, to catch scrolls in any ancestor
      window.addEventListener('resize', updatePosition);
    }

    onCleanup(() => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      clearTimeout(typeAheadTimer);
      if (anchored()) {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      }
    });
  });

  createEffect(() => {
    if (isOpen() && menuRef) {
      setIsPositioned(false);
      // double RAF ensures layout is complete before measuring
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updatePosition();
          const triggerHadFocus = triggerRef?.contains(document.activeElement);
          if (triggerHadFocus) {
            const firstItem = menuRef?.querySelector<HTMLButtonElement>('.menu__item:not(.menu__item--disabled):not([disabled])');
            firstItem?.focus();
          }
        });
      });
    }
  });

  const resolved = resolveChildren(() => local.children);

  const menuClasses = () => {
    const classes = ['menu'];
    classes.push(`menu--${variant()}`);
    if (size() !== 'normal') {
      classes.push(`menu--${size()}`);
    }
    classes.push(`menu--${finalPlacement()}`);
    if (local.class) {
      classes.push(local.class);
    }
    return classes.join(' ');
  };

  return (
    <>
      <div
        ref={triggerRef}
        class={`menu__trigger${local.wrapperClass ? ' ' + local.wrapperClass : ''}`}
        onClick={handleTriggerClick}
        onContextMenu={handleTriggerContextMenu}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            if (openOn() === 'click' || openOn() === 'both') {
              e.preventDefault();
              if (!isOpen()) setOpen(true);
            }
          }
        }}
      >
        {local.trigger}
      </div>

      <Show when={isOpen()}>
        <Portal>
          <div
            ref={menuRef}
            class={menuClasses()}
            role="menu"
            onKeyDown={handleMenuKeyDown}
            style={{
              top: `${position().top}px`,
              left: `${position().left}px`,
              width: menuWidth() ? `${menuWidth()}px` : undefined,
              opacity: isPositioned() ? 1 : 0,
              transition: isPositioned() ? 'opacity 0.1s ease' : 'none',
            }}
          >
            {resolved()}
          </div>
        </Portal>
      </Show>
    </>
  );
};

export const MenuItem: Component<{
  children: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  submenu?: () => JSX.Element;
  class?: string;
}> = (props) => {
  const [local] = splitProps(props, ['children', 'onClick', 'disabled', 'submenu', 'class']);

  const [isHovered, setIsHovered] = createSignal(false);
  const [submenuPosition, setSubmenuPosition] = createSignal({ top: 0, left: 0 });
  let itemRef: HTMLButtonElement | undefined;
  let submenuRef: HTMLDivElement | undefined;

  const updateSubmenuPosition = () => {
    if (!itemRef || !submenuRef) return;

    const itemRect = itemRef.getBoundingClientRect();
    const submenuRect = submenuRef.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const gap = 4;
    let top = itemRect.top;
    let left = itemRect.right + gap;

    if (left + submenuRect.width > viewportWidth && itemRect.left - submenuRect.width - gap >= 0) {
      left = itemRect.left - submenuRect.width - gap;
    }

    if (top + submenuRect.height > viewportHeight) {
      top = Math.max(0, viewportHeight - submenuRect.height - 8);
    }

    setSubmenuPosition({ top, left });
  };

  createEffect(() => {
    if (isHovered() && submenuRef) {
      updateSubmenuPosition();
    }
  });

  const handleMouseEnter = () => {
    if (local.submenu && !local.disabled) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e: MouseEvent) => {
    if (local.submenu) {
      // keep the menu open when the item has a submenu
      e.stopPropagation();
    }
    local.onClick?.();
  };

  return (
    <>
      <button
        ref={itemRef}
        class={`menu__item${local.disabled ? ' menu__item--disabled' : ''}${local.submenu ? ' menu__item--has-submenu' : ''}${local.class ? ' ' + local.class : ''}`}
        role="menuitem"
        onClick={handleClick}
        onPointerEnter={handleMouseEnter}
        onPointerLeave={handleMouseLeave}
        disabled={local.disabled}
        aria-haspopup={local.submenu ? 'menu' : undefined}
        aria-expanded={local.submenu ? isHovered() : undefined}
      >
        {local.children}
        <Show when={local.submenu}>
          <BsChevronRight class="menu__item-chevron" />
        </Show>
      </button>

      <Show when={local.submenu && isHovered()}>
        <Portal>
          <div
            ref={submenuRef}
            class="menu menu--submenu"
            role="menu"
            style={{
              top: `${submenuPosition().top}px`,
              left: `${submenuPosition().left}px`,
            }}
            onPointerEnter={handleMouseEnter}
            onPointerLeave={handleMouseLeave}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'ArrowLeft' || e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setIsHovered(false);
                itemRef?.focus();
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                const subItems = Array.from(submenuRef?.querySelectorAll<HTMLButtonElement>('.menu__item:not(.menu__item--disabled):not([disabled])') ?? []);
                if (subItems.length === 0) return;
                const current = subItems.indexOf(document.activeElement as HTMLButtonElement);
                let next: number;
                if (e.key === 'ArrowDown') next = current < subItems.length - 1 ? current + 1 : 0;
                else if (e.key === 'ArrowUp') next = current > 0 ? current - 1 : subItems.length - 1;
                else if (e.key === 'Home') next = 0;
                else next = subItems.length - 1;
                subItems[next]?.focus();
              }
            }}
          >
            {local.submenu!()}
          </div>
        </Portal>
      </Show>
    </>
  );
};

export const MenuSeparator: Component = () => {
  return <div class="menu__separator" />;
};
