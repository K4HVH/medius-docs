import { Component, createSignal, createEffect, splitProps, onMount, onCleanup, Show, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useFormField } from '../../contexts/FormFieldContext';
import '../../styles/components/inputs/Slider.css';

interface SliderMark {
  value: number;
  label?: string;
}

interface SliderProps {
  value?: number | [number, number];
  onChange?: (value: number | [number, number]) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  min?: number;
  max?: number;
  step?: number | null;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'normal' | 'compact';
  range?: boolean;
  marks?: SliderMark[];
  showTooltip?: boolean;
  error?: string;
  invalid?: boolean;
  required?: boolean;
  class?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-labelledby'?: string;
}

export const Slider: Component<SliderProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'value',
    'onChange',
    'onBlur',
    'name',
    'id',
    'min',
    'max',
    'step',
    'disabled',
    'orientation',
    'size',
    'range',
    'marks',
    'showTooltip',
    'error',
    'invalid',
    'required',
    'class',
    'aria-describedby',
    'aria-required',
    'aria-labelledby',
  ]);

  const fieldCtx = useFormField();
  const sliderId = () => local.id ?? fieldCtx?.fieldId;
  const ariaDescribedBy = () => local['aria-describedby'] ?? fieldCtx?.ariaDescribedBy?.();
  const ariaRequired = () => local['aria-required'] ?? local.required ?? fieldCtx?.required;

  const min = () => local.min ?? 0;
  const max = () => local.max ?? 100;
  const step = () => local.step === null ? null : (local.step ?? 1);
  const orientation = () => local.orientation ?? 'horizontal';
  const size = () => local.size ?? 'normal';
  const restrictToMarks = () => step() === null && local.marks && local.marks.length > 0;

  const [isDragging, setIsDragging] = createSignal(false);
  const [activeThumb, setActiveThumb] = createSignal<'start' | 'end' | null>(null);
  const [hoveredThumb, setHoveredThumb] = createSignal<'start' | 'end' | null>(null);
  const [tooltipPosition, setTooltipPosition] = createSignal({ top: 0, left: 0 });

  let trackRef: HTMLDivElement | undefined;
  let startThumbRef: HTMLDivElement | undefined;
  let endThumbRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (local.name) endThumbRef?.setAttribute('name', local.name);
    else endThumbRef?.removeAttribute('name');
  });

  const getValue = (): [number, number] => {
    if (local.range) {
      if (Array.isArray(local.value)) {
        return local.value;
      }
      return [min(), max()];
    }
    const val = Array.isArray(local.value) ? local.value[0] : (local.value ?? min());
    return [val, val];
  };

  const [startValue, endValue] = getValue();

  const percentageFromValue = (value: number) => {
    const range = max() - min();
    return ((value - min()) / range) * 100;
  };

  const updateTooltipPosition = () => {
    const currentThumb = activeThumb() || hoveredThumb();
    const thumbRef = currentThumb === 'start' ? startThumbRef : endThumbRef;
    if (thumbRef) {
      const rect = thumbRef.getBoundingClientRect();
      const isHorizontal = orientation() === 'horizontal';
      setTooltipPosition({
        top: isHorizontal ? rect.top - 8 : rect.top + rect.height / 2,
        left: isHorizontal ? rect.left + rect.width / 2 : rect.right + 8,
      });
    }
  };

  const getTooltipValue = () => {
    const currentThumb = activeThumb() || hoveredThumb();
    const [start, end] = getValue();
    return currentThumb === 'start' ? start : end;
  };

  const valueFromPosition = (clientPos: number) => {
    if (!trackRef) return min();

    const rect = trackRef.getBoundingClientRect();
    const isHorizontal = orientation() === 'horizontal';
    const trackSize = isHorizontal ? rect.width : rect.height;
    const trackStart = isHorizontal ? rect.left : rect.top;
    const position = clientPos - trackStart;

    let percentage = isHorizontal ? position / trackSize : 1 - (position / trackSize);
    percentage = Math.max(0, Math.min(1, percentage));

    const range = max() - min();
    let value = min() + percentage * range;

    if (restrictToMarks()) {
      const marks = local.marks!;
      const nearest = marks.reduce((prev, curr) => {
        return Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev;
      });
      return nearest.value;
    } else {
      const stepValue = step()!;
      value = Math.round(value / stepValue) * stepValue;
      value = Math.max(min(), Math.min(max(), value));
      return value;
    }
  };

  const handlePointerDown = (e: PointerEvent, thumb: 'start' | 'end') => {
    if (local.disabled) return;

    e.preventDefault();
    setIsDragging(true);
    setActiveThumb(thumb);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (local.showTooltip !== false && hoveredThumb() !== thumb) {
      updateTooltipPosition();
    }
    setHoveredThumb(null);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging() || !activeThumb() || local.disabled) return;

    const clientPos = orientation() === 'horizontal' ? e.clientX : e.clientY;
    const newValue = valueFromPosition(clientPos);

    if (local.range) {
      const [start, end] = getValue();
      if (activeThumb() === 'start') {
        if (newValue > end) {
          setActiveThumb('end');
          local.onChange?.([end, newValue]);
        } else {
          local.onChange?.([newValue, end]);
        }
      } else {
        if (newValue < start) {
          setActiveThumb('start');
          local.onChange?.([newValue, start]);
        } else {
          local.onChange?.([start, newValue]);
        }
      }
    } else {
      local.onChange?.(newValue);
    }

    if (local.showTooltip !== false) {
      updateTooltipPosition();
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setActiveThumb(null);
  };

  const handleTrackClick = (e: MouseEvent) => {
    if (local.disabled || isDragging()) return;

    const clientPos = orientation() === 'horizontal' ? e.clientX : e.clientY;
    const newValue = valueFromPosition(clientPos);

    if (local.range) {
      const [start, end] = getValue();
      const distToStart = Math.abs(newValue - start);
      const distToEnd = Math.abs(newValue - end);

      if (distToStart < distToEnd) {
        local.onChange?.([newValue, end]);
      } else {
        local.onChange?.([start, newValue]);
      }
    } else {
      local.onChange?.(newValue);
    }
  };

  const handleThumbKeyDown = (e: KeyboardEvent, thumb: 'start' | 'end') => {
    if (local.disabled) return;

    const isHorizontal = orientation() === 'horizontal';
    const s = step() ?? 1;
    const range = max() - min();
    const largeStep = Math.max(s, range / 10);

    let delta: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        delta = s;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = -s;
        break;
      case 'PageUp':
        delta = largeStep;
        break;
      case 'PageDown':
        delta = -largeStep;
        break;
      case 'Home':
        delta = min() - max(); // Will be clamped to min
        break;
      case 'End':
        delta = max() - min(); // Will be clamped to max
        break;
      default:
        return;
    }

    e.preventDefault();

    const [startVal, endVal] = getValue();

    if (local.range) {
      if (thumb === 'start') {
        let newStart = startVal + delta;
        if (restrictToMarks()) {
          const marks = local.marks!;
          const currentIdx = marks.findIndex(m => m.value === startVal);
          const nextIdx = Math.max(0, Math.min(marks.length - 1, currentIdx + (delta > 0 ? 1 : -1)));
          newStart = marks[nextIdx].value;
        }
        newStart = Math.max(min(), Math.min(endVal, newStart));
        local.onChange?.([newStart, endVal]);
      } else {
        let newEnd = endVal + delta;
        if (restrictToMarks()) {
          const marks = local.marks!;
          const currentIdx = marks.findIndex(m => m.value === endVal);
          const nextIdx = Math.max(0, Math.min(marks.length - 1, currentIdx + (delta > 0 ? 1 : -1)));
          newEnd = marks[nextIdx].value;
        }
        newEnd = Math.max(startVal, Math.min(max(), newEnd));
        local.onChange?.([startVal, newEnd]);
      }
    } else {
      let newValue = endVal + delta;
      if (restrictToMarks()) {
        const marks = local.marks!;
        const currentIdx = marks.findIndex(m => m.value === endVal);
        const nextIdx = Math.max(0, Math.min(marks.length - 1, currentIdx + (delta > 0 ? 1 : -1)));
        newValue = marks[nextIdx].value;
      }
      newValue = Math.max(min(), Math.min(max(), newValue));
      local.onChange?.(newValue);
    }

    if (local.showTooltip !== false) {
      setActiveThumb(thumb);
      requestAnimationFrame(() => {
        updateTooltipPosition();
        setTimeout(() => setActiveThumb(null), 500);
      });
    }
  };

  const classNames = () => {
    const classes = ['slider'];

    if (orientation() === 'vertical') {
      classes.push('slider--vertical');
    }

    if (size() === 'compact') {
      classes.push('slider--compact');
    }

    if (local.disabled) {
      classes.push('slider--disabled');
    }

    if (isDragging()) {
      classes.push('slider--dragging');
    }

    if (local.invalid || local.error) {
      classes.push('slider--invalid');
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <>
      <div
        id={sliderId()}
        class={classNames()}
        onBlur={local.onBlur}
        aria-invalid={local.invalid || !!local.error}
        aria-describedby={ariaDescribedBy()}
        aria-required={ariaRequired()}
        aria-labelledby={local['aria-labelledby']}
        {...rest}
      >
        <div
          ref={trackRef}
          class="slider__track"
          onClick={handleTrackClick}
        >
          <div
            class="slider__range"
            style={{
              [orientation() === 'horizontal' ? 'left' : 'bottom']: `${percentageFromValue(getValue()[0])}%`,
              [orientation() === 'horizontal' ? 'width' : 'height']: `${percentageFromValue(getValue()[1]) - percentageFromValue(getValue()[0])}%`,
            }}
          />

          <Show when={local.marks}>
            <For each={local.marks}>
              {(mark) => (
                <div
                  class="slider__mark"
                  style={{
                    [orientation() === 'horizontal' ? 'left' : 'bottom']: `${percentageFromValue(mark.value)}%`,
                  }}
                >
                  <div class="slider__mark-dot" />
                  <Show when={mark.label}>
                    <div class="slider__mark-label">{mark.label}</div>
                  </Show>
                </div>
              )}
            </For>
          </Show>

          {local.range && (
            <div
              ref={startThumbRef}
              class="slider__thumb slider__thumb--start"
              style={{
                [orientation() === 'horizontal' ? 'left' : 'bottom']: `${percentageFromValue(getValue()[0])}%`,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'start')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => handleThumbKeyDown(e, 'start')}
              onPointerEnter={() => {
                if (local.showTooltip !== false) {
                  setHoveredThumb('start');
                  updateTooltipPosition();
                }
              }}
              onPointerLeave={() => setHoveredThumb(null)}
              tabIndex={local.disabled ? -1 : 0}
              role="slider"
              aria-valuemin={min()}
              aria-valuemax={getValue()[1]}
              aria-valuenow={getValue()[0]}
              aria-orientation={orientation()}
              aria-label="Range start"
            />
          )}

          <div
            ref={endThumbRef}
            class="slider__thumb slider__thumb--end"
            style={{
              [orientation() === 'horizontal' ? 'left' : 'bottom']: `${percentageFromValue(getValue()[1])}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'end')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => handleThumbKeyDown(e, 'end')}
            onPointerEnter={() => {
              if (local.showTooltip !== false) {
                setHoveredThumb('end');
                updateTooltipPosition();
              }
            }}
            onPointerLeave={() => setHoveredThumb(null)}
            tabIndex={local.disabled ? -1 : 0}
            role="slider"
            aria-valuemin={local.range ? getValue()[0] : min()}
            aria-valuemax={max()}
            aria-valuenow={getValue()[1]}
            aria-orientation={orientation()}
            aria-label={local.range ? 'Range end' : undefined}
          />
        </div>
      </div>

      <Show when={(isDragging() || hoveredThumb()) && local.showTooltip !== false}>
        <Portal>
          <div
            class="slider__tooltip"
            style={{
              position: 'fixed',
              top: `${tooltipPosition().top}px`,
              left: `${tooltipPosition().left}px`,
              transform: orientation() === 'horizontal'
                ? 'translate(-50%, -100%)'
                : 'translateY(-50%)',
            }}
          >
            {getTooltipValue()}
          </div>
        </Portal>
      </Show>
    </>
  );
};
