import { Component, For, Show, splitProps, createSignal, createMemo, JSX } from 'solid-js';
import { BsChevronUp, BsChevronDown, BsChevronExpand } from 'solid-icons/bs';
import { Checkbox } from '../inputs/Checkbox';
import '../../styles/components/display/Table.css';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => JSX.Element | string | number;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  selectedRows?: Set<string> | string[];
  onSelectionChange?: (selected: Set<string>) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  variant?: 'default' | 'emphasized' | 'subtle';
  size?: 'compact' | 'normal' | 'spacious';
  stickyHeader?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  class?: string;
}

export const Table = <T,>(props: TableProps<T>) => {
  const [local] = splitProps(props, [
    'columns',
    'data',
    'getRowId',
    'selectable',
    'selectedRows',
    'onSelectionChange',
    'sortKey',
    'sortDirection',
    'onSort',
    'variant',
    'size',
    'stickyHeader',
    'loading',
    'emptyMessage',
    'class',
  ]);

  const variant = () => local.variant ?? 'default';
  const size = () => local.size ?? 'normal';

  const selectedSet = createMemo(() => {
    if (!local.selectedRows) return new Set<string>();
    if (local.selectedRows instanceof Set) return local.selectedRows;
    return new Set(local.selectedRows);
  });

  const allSelected = createMemo(() => {
    if (!local.selectable || local.data.length === 0) return false;
    return local.data.every(row => selectedSet().has(local.getRowId(row)));
  });

  const someSelected = createMemo(() => {
    if (!local.selectable || local.data.length === 0) return false;
    const selected = selectedSet();
    return local.data.some(row => selected.has(local.getRowId(row))) && !allSelected();
  });

  const handleSelectAll = () => {
    if (!local.onSelectionChange) return;

    const newSelected = new Set<string>();
    if (!allSelected()) {
      local.data.forEach(row => {
        newSelected.add(local.getRowId(row));
      });
    }
    local.onSelectionChange(newSelected);
  };

  const handleSelectRow = (rowId: string) => {
    if (!local.onSelectionChange) return;

    const newSelected = new Set(selectedSet());
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    local.onSelectionChange(newSelected);
  };

  const handleSort = (columnKey: string) => {
    if (!local.onSort) return;

    let newDirection: 'asc' | 'desc' = 'asc';
    if (local.sortKey === columnKey) {
      newDirection = local.sortDirection === 'asc' ? 'desc' : 'asc';
    }
    local.onSort(columnKey, newDirection);
  };

  const getSortIcon = (columnKey: string) => {
    if (local.sortKey !== columnKey) {
      return BsChevronExpand;
    }
    return local.sortDirection === 'asc' ? BsChevronUp : BsChevronDown;
  };

  const classNames = () => {
    const classes = ['table'];

    classes.push(`table--${variant()}`);

    if (size() !== 'normal') {
      classes.push(`table--${size()}`);
    }

    if (local.stickyHeader) {
      classes.push('table--sticky-header');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  const renderSkeletonRows = () => {
    const skeletonCount = 5;
    return (
      <For each={Array.from({ length: skeletonCount })}>
        {() => (
          <tr class="table__row table__row--skeleton">
            <Show when={local.selectable}>
              <td class="table__cell table__cell--checkbox">
                <div class="table__skeleton" />
              </td>
            </Show>
            <For each={local.columns}>
              {(column) => (
                <td
                  class="table__cell"
                  style={{
                    width: column.width,
                    'text-align': column.align || 'left',
                  }}
                >
                  <div class="table__skeleton" />
                </td>
              )}
            </For>
          </tr>
        )}
      </For>
    );
  };

  const renderEmptyState = () => {
    const colSpan = local.columns.length + (local.selectable ? 1 : 0);
    return (
      <tr class="table__row table__row--empty">
        <td class="table__cell table__cell--empty" colspan={colSpan}>
          {local.emptyMessage || 'No data available'}
        </td>
      </tr>
    );
  };

  return (
    <div class={classNames()}>
      <div class="table__container">
        <table class="table__element">
          <thead class="table__header">
            <tr class="table__header-row">
              <Show when={local.selectable}>
                <th class="table__header-cell table__header-cell--checkbox">
                  <Checkbox
                    checked={allSelected()}
                    indeterminate={someSelected()}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              </Show>
              <For each={local.columns}>
                {(column) => {
                  const isSortable = column.sortable !== false && !!local.onSort;
                  const isSorted = local.sortKey === column.key;

                  return (
                    <th
                      class="table__header-cell"
                      classList={{
                        'table__header-cell--sortable': isSortable,
                        'table__header-cell--sorted': isSorted,
                      }}
                      style={{
                        width: column.width,
                        'text-align': column.align || 'left',
                      }}
                      tabIndex={isSortable ? 0 : undefined}
                      role="columnheader"
                      aria-sort={isSorted ? (local.sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      onClick={() => isSortable && handleSort(column.key)}
                      onKeyDown={(e: KeyboardEvent) => {
                        if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleSort(column.key);
                        }
                      }}
                    >
                      <div class="table__header-content">
                        <span class="table__header-label">{column.header}</span>
                        <Show when={isSortable}>
                          <span class="table__sort-icon">
                            {getSortIcon(column.key)({ size: 14 })}
                          </span>
                        </Show>
                      </div>
                    </th>
                  );
                }}
              </For>
            </tr>
          </thead>
          <tbody class="table__body">
            <Show when={local.loading}>
              {renderSkeletonRows()}
            </Show>
            <Show when={!local.loading && local.data.length === 0}>
              {renderEmptyState()}
            </Show>
            <Show when={!local.loading && local.data.length > 0}>
              <For each={local.data}>
                {(row) => {
                  const rowId = local.getRowId(row);

                  return (
                    <tr
                      class="table__row"
                      classList={{
                        'table__row--selected': selectedSet().has(rowId),
                      }}
                    >
                      <Show when={local.selectable}>
                        <td class="table__cell table__cell--checkbox">
                          <Checkbox
                            checked={selectedSet().has(rowId)}
                            onChange={() => handleSelectRow(rowId)}
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      </Show>
                      <For each={local.columns}>
                        {(column) => (
                          <td
                            class="table__cell"
                            style={{
                              width: column.width,
                              'text-align': column.align || 'left',
                            }}
                          >
                            {column.cell(row)}
                          </td>
                        )}
                      </For>
                    </tr>
                  );
                }}
              </For>
            </Show>
          </tbody>
        </table>
      </div>
    </div>
  );
};
