import { Component, For, splitProps, Show } from 'solid-js';
import { BsChevronLeft, BsChevronRight, BsChevronBarLeft, BsChevronBarRight } from 'solid-icons/bs';
import '../../styles/components/navigation/Pagination.css';

export interface PaginationProps {
  page: number; // 1-indexed
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: 'primary' | 'secondary' | 'subtle';
  size?: 'compact' | 'normal' | 'spacious';
  showFirstLast?: boolean; // default: true
  showPrevNext?: boolean; // default: true
  siblingCount?: number; // page buttons each side of current, default: 1
  disabled?: boolean;
  class?: string;
}

export const Pagination: Component<PaginationProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'page',
    'totalPages',
    'onPageChange',
    'variant',
    'size',
    'showFirstLast',
    'showPrevNext',
    'siblingCount',
    'disabled',
    'class',
  ]);

  const variant = () => local.variant ?? 'secondary';
  const size = () => local.size ?? 'normal';
  const shouldShowFirstLast = () => local.showFirstLast !== false;
  const shouldShowPrevNext = () => local.showPrevNext !== false;
  const siblingCount = () => local.siblingCount ?? 1;

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const current = local.page;
    const total = local.totalPages;
    const siblings = siblingCount();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    const leftSibling = Math.max(current - siblings, 1);
    const rightSibling = Math.min(current + siblings, total);

    const showLeftEllipsis = leftSibling > 2;
    const showRightEllipsis = rightSibling < total - 1;

    pages.push(1);

    if (showLeftEllipsis) {
      pages.push('ellipsis');
    }

    for (let i = leftSibling; i <= rightSibling; i++) {
      if (i > 1 && i < total) {
        pages.push(i);
      }
    }

    if (showRightEllipsis) {
      pages.push('ellipsis');
    }

    if (total > 1) {
      pages.push(total);
    }

    return pages;
  };

  const handlePageChange = (newPage: number) => {
    if (local.disabled) return;
    if (newPage < 1 || newPage > local.totalPages) return;
    if (newPage === local.page) return;
    local.onPageChange(newPage);
  };

  const canGoPrev = () => local.page > 1 && !local.disabled;
  const canGoNext = () => local.page < local.totalPages && !local.disabled;

  const classNames = () => {
    const classes = ['pagination'];

    classes.push(`pagination--${variant()}`);

    if (size() !== 'normal') {
      classes.push(`pagination--${size()}`);
    }

    if (local.disabled) {
      classes.push('pagination--disabled');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  const handleContainerKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;

    const container = e.currentTarget as HTMLElement;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.pagination__button:not([disabled])'));
    if (buttons.length === 0) return;

    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;

    e.preventDefault();
    let next: number;

    if (e.key === 'ArrowRight') next = current < buttons.length - 1 ? current + 1 : 0;
    else if (e.key === 'ArrowLeft') next = current > 0 ? current - 1 : buttons.length - 1;
    else if (e.key === 'Home') next = 0;
    else next = buttons.length - 1;

    buttons.forEach(b => b.setAttribute('tabindex', '-1'));
    buttons[next].setAttribute('tabindex', '0');
    buttons[next].focus();
  };

  return (
    <nav class={classNames()} aria-label="Pagination" onKeyDown={handleContainerKeyDown} {...rest}>
      <div class="pagination__container">
        <Show when={shouldShowFirstLast()}>
          <button
            type="button"
            class="pagination__button pagination__button--first"
            onClick={() => handlePageChange(1)}
            disabled={!canGoPrev()}
            tabIndex={-1}
            aria-label="Go to first page"
          >
            <BsChevronBarLeft />
          </button>
        </Show>

        <Show when={shouldShowPrevNext()}>
          <button
            type="button"
            class="pagination__button pagination__button--prev"
            onClick={() => handlePageChange(local.page - 1)}
            disabled={!canGoPrev()}
            tabIndex={-1}
            aria-label="Go to previous page"
          >
            <BsChevronLeft />
          </button>
        </Show>

        <div class="pagination__pages">
          <For each={getPageNumbers()}>
            {(item) => (
              <Show
                when={item !== 'ellipsis'}
                fallback={
                  <span class="pagination__ellipsis" aria-hidden="true">
                    …
                  </span>
                }
              >
                <button
                  type="button"
                  class={`pagination__button pagination__button--page ${
                    item === local.page ? 'pagination__button--active' : ''
                  }`}
                  onClick={() => handlePageChange(item as number)}
                  disabled={local.disabled}
                  tabIndex={item === local.page ? 0 : -1}
                  aria-label={`Go to page ${item}`}
                  aria-current={item === local.page ? 'page' : undefined}
                >
                  {item}
                </button>
              </Show>
            )}
          </For>
        </div>

        <Show when={shouldShowPrevNext()}>
          <button
            type="button"
            class="pagination__button pagination__button--next"
            onClick={() => handlePageChange(local.page + 1)}
            disabled={!canGoNext()}
            tabIndex={-1}
            aria-label="Go to next page"
          >
            <BsChevronRight />
          </button>
        </Show>

        <Show when={shouldShowFirstLast()}>
          <button
            type="button"
            class="pagination__button pagination__button--last"
            onClick={() => handlePageChange(local.totalPages)}
            disabled={!canGoNext()}
            tabIndex={-1}
            aria-label="Go to last page"
          >
            <BsChevronBarRight />
          </button>
        </Show>
      </div>
    </nav>
  );
};
