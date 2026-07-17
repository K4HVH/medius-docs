import {
  Component,
  Show,
  For,
  splitProps,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  BsCalendar,
  BsClock,
  BsChevronLeft,
  BsChevronRight,
  BsChevronUp,
  BsChevronDown,
  BsX,
} from 'solid-icons/bs';
import '../../styles/components/inputs/DatePicker.css';
import { useFormField } from '../../contexts/FormFieldContext';

export interface DatePickerRangeValue {
  start?: string;
  end?: string;
}

export interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  range?: boolean;
  rangeValue?: DatePickerRangeValue;
  onRangeChange?: (value: DatePickerRangeValue) => void;
  mode?: 'date' | 'time' | 'datetime';
  showSeconds?: boolean;
  use12Hour?: boolean;
  timeStep?: number;
  secondStep?: number;
  minDate?: string;
  maxDate?: string;
  isDateDisabled?: (date: Date) => boolean;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  size?: 'normal' | 'compact';
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  error?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onBlur?: () => void;
  class?: string;
  name?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-labelledby'?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseDateStr(iso: string): Date | null {
  if (!iso) return null;
  const s = iso.includes('T') ? iso
    : iso.includes(':') ? `1970-01-01T${iso}`
      : `${iso}T00:00:00`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toISODateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toISOTimeStr(h: number, m: number, s?: number): string {
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return s !== undefined ? `${base}:${String(s).padStart(2, '0')}` : base;
}

function toISODateTimeStr(d: Date, h: number, m: number, s?: number): string {
  return `${toISODateStr(d)}T${toISOTimeStr(h, m, s)}`;
}

function displayDate(d: Date): string {
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseManualDate(str: string): Date | null {
  str = str.trim();
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  m = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const monthIdx = MONTH_NAMES.findIndex(
      n => n.toLowerCase().startsWith(m![2].toLowerCase().substring(0, 3))
    );
    if (monthIdx >= 0) {
      const d = new Date(+m[3], monthIdx, +m[1]);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

interface ParsedTime { h: number; m: number; s: number; }

function parseManualTime(str: string): ParsedTime | null {
  str = str.trim();
  let m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (m) {
    let h = +m[1];
    const mn = +m[2];
    const s = m[3] !== undefined ? +m[3] : 0;
    const ampm = m[4].toUpperCase();
    if (ampm === 'AM' && h === 12) h = 0;
    else if (ampm === 'PM' && h !== 12) h += 12;
    if (h < 0 || h > 23 || mn < 0 || mn > 59 || s < 0 || s > 59) return null;
    return { h, m: mn, s };
  }
  m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const h = +m[1];
    const mn = +m[2];
    const s = m[3] !== undefined ? +m[3] : 0;
    if (h < 0 || h > 23 || mn < 0 || mn > 59 || s < 0 || s > 59) return null;
    return { h, m: mn, s };
  }
  if (/^\d{6}$/.test(str)) {
    const h = +str.slice(0, 2), mn = +str.slice(2, 4), s = +str.slice(4, 6);
    if (h <= 23 && mn <= 59 && s <= 59) return { h, m: mn, s };
  }
  if (/^\d{3,4}$/.test(str)) {
    const h = str.length === 4 ? +str.slice(0, 2) : +str.slice(0, 1);
    const mn = str.length === 4 ? +str.slice(2) : +str.slice(1);
    if (h <= 23 && mn <= 59) return { h, m: mn, s: 0 };
  }
  return null;
}

interface CalendarDay {
  date: Date;
  currentMonth: boolean;
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), currentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), currentMonth: true });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), currentMonth: false });
  }
  return days;
}

export const DatePicker: Component<DatePickerProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'value', 'onChange',
    'range', 'rangeValue', 'onRangeChange',
    'mode',
    'showSeconds', 'use12Hour', 'timeStep', 'secondStep',
    'minDate', 'maxDate', 'isDateDisabled',
    'label', 'placeholder', 'clearable',
    'size', 'disabled', 'invalid', 'error',
    'open', 'onOpenChange',
    'onBlur', 'class', 'name', 'id', 'required',
    'aria-describedby', 'aria-required', 'aria-labelledby',
  ]);

  const fieldCtx = useFormField();
  const mode = () => local.mode ?? 'date';
  const size = () => local.size ?? 'normal';

  const isControlled = () => local.open !== undefined;
  const [internalOpen, setInternalOpen] = createSignal(false);
  const isOpen = () => (isControlled() ? local.open! : internalOpen());
  const setOpen = (v: boolean) => {
    if (!isControlled()) setInternalOpen(v);
    local.onOpenChange?.(v);
  };

  const today = new Date();

  const initViewFromValue = () => {
    const val = local.range ? local.rangeValue?.start : local.value;
    if (val) {
      const d = parseDateStr(val);
      if (d) return d;
    }
    return today;
  };

  const [viewYear, setViewYear] = createSignal(initViewFromValue().getFullYear());
  const [viewMonth, setViewMonth] = createSignal(initViewFromValue().getMonth());
  const [viewMode, setViewMode] = createSignal<'days' | 'months' | 'years'>('days');
  const [decadeBase, setDecadeBase] = createSignal(Math.floor(today.getFullYear() / 20) * 20);

  const initTime = () => {
    const val = local.value;
    if (val) {
      const d = parseDateStr(val);
      if (d) return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
    }
    return { h: 0, m: 0, s: 0 };
  };

  const [hour, setHour] = createSignal(initTime().h);
  const [minute, setMinute] = createSignal(initTime().m);
  const [second, setSecond] = createSignal(initTime().s);

  const initRangeTimes = () => {
    const sd = local.rangeValue?.start ? parseDateStr(local.rangeValue.start) : null;
    const ed = local.rangeValue?.end ? parseDateStr(local.rangeValue.end) : null;
    return {
      sh: sd?.getHours() ?? 0, sm: sd?.getMinutes() ?? 0, ss: sd?.getSeconds() ?? 0,
      eh: ed?.getHours() ?? 0, em: ed?.getMinutes() ?? 0, es: ed?.getSeconds() ?? 0,
    };
  };

  const { sh, sm, ss, eh, em, es } = initRangeTimes();
  const [startHour, setStartHour] = createSignal(sh);
  const [startMinute, setStartMinute] = createSignal(sm);
  const [startSecond, setStartSecond] = createSignal(ss);
  const [endHour, setEndHour] = createSignal(eh);
  const [endMinute, setEndMinute] = createSignal(em);
  const [endSecond, setEndSecond] = createSignal(es);

  const [rangeStep, setRangeStep] = createSignal<'start' | 'end'>('start');
  const [hoverDate, setHoverDate] = createSignal<Date | null>(null);

  const [inputText, setInputText] = createSignal('');
  const [isEditing, setIsEditing] = createSignal(false);

  let triggerRef: HTMLDivElement | undefined;
  let calendarRef: HTMLDivElement | undefined;

  const [position, setPosition] = createSignal({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = createSignal(false);

  const updatePosition = () => {
    if (!triggerRef || !calendarRef) return;
    const trigRect = triggerRef.getBoundingClientRect();
    const calRect = calendarRef.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (calRect.width === 0 || calRect.height === 0) {
      requestAnimationFrame(() => updatePosition());
      return;
    }

    const gap = 4;
    let top = trigRect.bottom + gap;
    let left = trigRect.left;

    if (top + calRect.height > vh && trigRect.top - calRect.height - gap >= 0) {
      top = trigRect.top - calRect.height - gap;
    }
    if (left + calRect.width > vw) {
      left = Math.max(0, vw - calRect.width - 8);
    }

    setPosition({ top, left });
    setIsPositioned(true);
  };

  createEffect(() => {
    if (isOpen()) {
      setIsPositioned(false);
      requestAnimationFrame(() => requestAnimationFrame(() => updatePosition()));
    }
  });

  createEffect(() => {
    const val = local.value;
    if (!val || (mode() !== 'time' && mode() !== 'datetime')) return;
    const d = parseDateStr(val);
    if (d) {
      setHour(d.getHours());
      setMinute(d.getMinutes());
      setSecond(d.getSeconds());
    }
  });

  onMount(() => {
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    onCleanup(() => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    });
  });

  const calendarDays = createMemo(() => buildCalendarDays(viewYear(), viewMonth()));
  const visibleYears = createMemo(() => Array.from({ length: 20 }, (_, i) => decadeBase() + i));

  const selectedDate = createMemo((): Date | null => {
    if (local.range) return null;
    return local.value ? parseDateStr(local.value) : null;
  });

  const rangeStart = createMemo((): Date | null => {
    if (!local.range) return null;
    return local.rangeValue?.start ? parseDateStr(local.rangeValue.start) : null;
  });

  const rangeEnd = createMemo((): Date | null => {
    if (!local.range) return null;
    return local.rangeValue?.end ? parseDateStr(local.rangeValue.end) : null;
  });

  const minDateObj = createMemo((): Date | null =>
    local.minDate ? parseDateStr(local.minDate) : null
  );

  const maxDateObj = createMemo((): Date | null =>
    local.maxDate ? parseDateStr(local.maxDate) : null
  );

  const effectiveStart = createMemo((): Date | null => {
    if (!local.range) return null;
    const start = rangeStart();
    const end = rangeEnd();
    if (end) return start;
    if (start && hoverDate()) {
      const hover = startOfDay(hoverDate()!);
      return hover < startOfDay(start) ? hoverDate() : start;
    }
    return start;
  });

  const effectiveEnd = createMemo((): Date | null => {
    if (!local.range) return null;
    const end = rangeEnd();
    if (end) return end;
    const start = rangeStart();
    if (start && hoverDate()) {
      const hover = startOfDay(hoverDate()!);
      const startD = startOfDay(start);
      return hover >= startD ? hoverDate() : start;
    }
    return null;
  });

  const isDayDisabled = (date: Date): boolean => {
    const d = startOfDay(date);
    const min = minDateObj();
    const max = maxDateObj();
    if (min && d < startOfDay(min)) return true;
    if (max && d > startOfDay(max)) return true;
    if (local.isDateDisabled?.(date)) return true;
    return false;
  };

  const hasValue = () => {
    if (local.range) return !!(local.rangeValue?.start || local.rangeValue?.end);
    return !!local.value;
  };

  const formatTime = (h: number, m: number, s: number): string => {
    const use12 = local.use12Hour;
    const showSec = local.showSeconds;
    const displayH = use12 ? (h % 12 || 12) : h;
    const suffix = use12 ? (h < 12 ? ' AM' : ' PM') : '';
    const parts = [String(displayH).padStart(2, '0'), String(m).padStart(2, '0')];
    if (showSec) parts.push(String(s).padStart(2, '0'));
    return parts.join(':') + suffix;
  };

  const displayValue = createMemo((): string => {
    if (local.range) {
      const start = rangeStart();
      const end = rangeEnd();
      if (!start && !end) return '';
      const startStr = start ? displayDate(start) : '…';
      const endStr = end ? displayDate(end) : '…';
      if (mode() === 'datetime') {
        return `${startStr} ${formatTime(startHour(), startMinute(), startSecond())} → ${endStr} ${formatTime(endHour(), endMinute(), endSecond())}`;
      }
      return `${startStr} → ${endStr}`;
    }
    const val = local.value;
    if (!val) return '';
    const d = parseDateStr(val);
    if (!d) return val;
    if (mode() === 'date') return displayDate(d);
    if (mode() === 'time') return formatTime(hour(), minute(), second());
    return `${displayDate(d)}, ${formatTime(hour(), minute(), second())}`;
  });

  createEffect(() => {
    if (!isEditing()) {
      setInputText(displayValue());
    }
  });

  const placeholder = () => local.placeholder ?? (
    mode() === 'time' ? 'Select time'
      : mode() === 'datetime' ? 'Select date & time'
        : local.range ? 'Select date range'
          : 'Select date'
  );

  const emitTimeValue = (h: number, m: number, s: number) => {
    if (!local.onChange) return;
    const sec = local.showSeconds ? s : undefined;
    if (mode() === 'time') {
      local.onChange(toISOTimeStr(h, m, sec));
    } else if (mode() === 'datetime') {
      const d = selectedDate();
      if (d) local.onChange(toISODateTimeStr(d, h, m, sec));
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (!calendarRef || !triggerRef) return;
    const target = e.target as Node;
    if (!calendarRef.contains(target) && !triggerRef.contains(target)) {
      if (isEditing()) {
        setIsEditing(false);
        setInputText(displayValue());
      }
      setOpen(false);
      if (local.range) setRangeStep('start');
    }
  };

  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      setIsEditing(false);
      setInputText(displayValue());
      setOpen(false);
      if (local.range) setRangeStep('start');
    }
  };

  const openAndNavigate = () => {
    const val = local.range ? local.rangeValue?.start : local.value;
    if (val) {
      const d = parseDateStr(val);
      if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
    }
    setViewMode('days');
    setOpen(true);
  };

  const handleIconClick = (e: MouseEvent) => {
    e.preventDefault();
    if (local.disabled) return;
    if (isOpen()) {
      setIsEditing(false);
      setInputText(displayValue());
      setOpen(false);
      if (local.range) setRangeStep('start');
    } else {
      openAndNavigate();
    }
  };

  const handleInputFocus = () => {
    if (local.disabled) return;
    if (!isOpen()) openAndNavigate();
    if (!local.range) setIsEditing(true);
  };

  const tryParseAndNavigate = (text: string) => {
    if (mode() === 'date' || mode() === 'datetime') {
      const d = parseManualDate(text);
      if (d) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  };

  const handleTextInput = (e: InputEvent) => {
    const val = (e.currentTarget as HTMLInputElement).value;
    setInputText(val);
    tryParseAndNavigate(val);
  };

  const commitTextInput = (text: string): boolean => {
    text = text.trim();
    if (mode() === 'date') {
      const d = parseManualDate(text);
      if (d) {
        local.onChange?.(toISODateStr(d));
        setInputText(displayDate(d));
        setOpen(false);
        return true;
      }
    } else if (mode() === 'time') {
      const t = parseManualTime(text);
      if (t) {
        setHour(t.h); setMinute(t.m); setSecond(t.s);
        const sec = local.showSeconds ? t.s : undefined;
        local.onChange?.(toISOTimeStr(t.h, t.m, sec));
        setInputText(formatTime(t.h, t.m, t.s));
        setOpen(false);
        return true;
      }
    } else if (mode() === 'datetime') {
      let datePart = '';
      let timePart = '';
      const commaIdx = text.indexOf(',');
      const tIdx = text.indexOf('T');
      if (commaIdx >= 0) {
        datePart = text.slice(0, commaIdx).trim();
        timePart = text.slice(commaIdx + 1).trim();
      } else if (tIdx >= 0) {
        datePart = text.slice(0, tIdx).trim();
        timePart = text.slice(tIdx + 1).trim();
      } else {
        datePart = text;
      }
      const d = parseManualDate(datePart);
      const t = timePart ? parseManualTime(timePart) : { h: hour(), m: minute(), s: second() };
      if (d && t) {
        setHour(t.h); setMinute(t.m); setSecond(t.s);
        const sec = local.showSeconds ? t.s : undefined;
        local.onChange?.(toISODateTimeStr(d, t.h, t.m, sec));
        setInputText(`${displayDate(d)}, ${formatTime(t.h, t.m, t.s)}`);
        setOpen(false);
        return true;
      }
    }
    return false;
  };

  const handleTextBlur = () => {
    const text = inputText().trim();
    const dv = displayValue();
    if (text && text !== dv) {
      const committed = commitTextInput(text);
      setIsEditing(false);
      if (!committed) setInputText(displayValue());
    } else {
      setIsEditing(false);
      setInputText(dv);
    }
    local.onBlur?.();
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = inputText();
      const committed = commitTextInput(text);
      setIsEditing(false);
      if (!committed) setInputText(displayValue());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setInputText(displayValue());
      setOpen(false);
      if (local.range) setRangeStep('start');
    }
  };

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    if (local.range) {
      local.onRangeChange?.({ start: undefined, end: undefined });
      setRangeStep('start');
    } else {
      local.onChange?.('');
    }
  };

  const handleDayClick = (date: Date) => {
    if (isDayDisabled(date)) return;

    if (local.range) {
      if (rangeStep() === 'start' || !local.rangeValue?.start) {
        const iso = mode() === 'datetime'
          ? toISODateTimeStr(date, startHour(), startMinute(), local.showSeconds ? startSecond() : undefined)
          : toISODateStr(date);
        local.onRangeChange?.({ start: iso, end: undefined });
        setRangeStep('end');
      } else {
        const startD = parseDateStr(local.rangeValue!.start!);
        const isBeforeStart = startD && startOfDay(date) < startOfDay(startD);
        if (isBeforeStart) {
          const iso = mode() === 'datetime'
            ? toISODateTimeStr(date, startHour(), startMinute(), local.showSeconds ? startSecond() : undefined)
            : toISODateStr(date);
          local.onRangeChange?.({ start: iso, end: undefined });
        } else {
          const iso = mode() === 'datetime'
            ? toISODateTimeStr(date, endHour(), endMinute(), local.showSeconds ? endSecond() : undefined)
            : toISODateStr(date);
          local.onRangeChange?.({ start: local.rangeValue!.start, end: iso });
          setRangeStep('start');
          if (mode() !== 'datetime') setOpen(false);
        }
      }
    } else {
      if (mode() === 'date') {
        local.onChange?.(toISODateStr(date));
        setOpen(false);
      } else if (mode() === 'datetime') {
        const sec = local.showSeconds ? second() : undefined;
        local.onChange?.(toISODateTimeStr(date, hour(), minute(), sec));
      } else {
        const sec = local.showSeconds ? second() : undefined;
        local.onChange?.(toISOTimeStr(hour(), minute(), sec));
      }
    }
  };

  const handleTodayClick = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setViewMode('days');
    if (!local.range && mode() === 'date') {
      local.onChange?.(toISODateStr(now));
      setOpen(false);
    }
  };

  const handleNowClick = () => {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    setHour(h); setMinute(m); setSecond(s);
    const sec = local.showSeconds ? s : undefined;
    if (mode() === 'time') {
      local.onChange?.(toISOTimeStr(h, m, sec));
      setOpen(false);
    } else if (mode() === 'datetime') {
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      setViewMode('days');
      local.onChange?.(toISODateTimeStr(now, h, m, sec));
      setOpen(false);
    }
  };

  const prevPeriod = (e: MouseEvent) => {
    e.stopPropagation();
    if (viewMode() === 'years') { setDecadeBase(b => b - 20); return; }
    if (viewMode() === 'months') { setViewYear(y => y - 1); return; }
    if (viewMonth() === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextPeriod = (e: MouseEvent) => {
    e.stopPropagation();
    if (viewMode() === 'years') { setDecadeBase(b => b + 20); return; }
    if (viewMode() === 'months') { setViewYear(y => y + 1); return; }
    if (viewMonth() === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const toggleViewMode = () => {
    if (viewMode() === 'days') setViewMode('months');
    else if (viewMode() === 'months') setViewMode('years');
    else setViewMode('days');
  };

  const selectMonth = (month: number) => {
    setViewMonth(month);
    setViewMode('days');
  };

  const selectYear = (year: number) => {
    setViewYear(year);
    setViewMode('months');
  };

  const adjustHour = (delta: number) => {
    const newH = (hour() + delta + 24) % 24;
    setHour(newH);
    emitTimeValue(newH, minute(), second());
  };

  const adjustMinute = (delta: number) => {
    const step = local.timeStep ?? 1;
    const newM = ((minute() + delta * step) % 60 + 60) % 60;
    setMinute(newM);
    emitTimeValue(hour(), newM, second());
  };

  const adjustSecond = (delta: number) => {
    const step = local.secondStep ?? 1;
    const newS = ((second() + delta * step) % 60 + 60) % 60;
    setSecond(newS);
    emitTimeValue(hour(), minute(), newS);
  };

  const toggleAmPm = () => {
    const newH = (hour() + 12) % 24;
    setHour(newH);
    emitTimeValue(newH, minute(), second());
  };

  const emitRangeTime = (sh: number, sm: number, ss: number, eh: number, em: number, es: number) => {
    if (!local.onRangeChange) return;
    const start = rangeStart();
    const end = rangeEnd();
    const startSec = local.showSeconds ? ss : undefined;
    const endSec = local.showSeconds ? es : undefined;
    local.onRangeChange({
      start: start ? toISODateTimeStr(start, sh, sm, startSec) : local.rangeValue?.start,
      end: end ? toISODateTimeStr(end, eh, em, endSec) : local.rangeValue?.end,
    });
  };

  const adjustStartHour = (delta: number) => {
    const v = (startHour() + delta + 24) % 24;
    setStartHour(v);
    emitRangeTime(v, startMinute(), startSecond(), endHour(), endMinute(), endSecond());
  };
  const adjustStartMinute = (delta: number) => {
    const step = local.timeStep ?? 1;
    const v = ((startMinute() + delta * step) % 60 + 60) % 60;
    setStartMinute(v);
    emitRangeTime(startHour(), v, startSecond(), endHour(), endMinute(), endSecond());
  };
  const adjustStartSecond = (delta: number) => {
    const step = local.secondStep ?? 1;
    const v = ((startSecond() + delta * step) % 60 + 60) % 60;
    setStartSecond(v);
    emitRangeTime(startHour(), startMinute(), v, endHour(), endMinute(), endSecond());
  };
  const adjustEndHour = (delta: number) => {
    const v = (endHour() + delta + 24) % 24;
    setEndHour(v);
    emitRangeTime(startHour(), startMinute(), startSecond(), v, endMinute(), endSecond());
  };
  const adjustEndMinute = (delta: number) => {
    const step = local.timeStep ?? 1;
    const v = ((endMinute() + delta * step) % 60 + 60) % 60;
    setEndMinute(v);
    emitRangeTime(startHour(), startMinute(), startSecond(), endHour(), v, endSecond());
  };
  const adjustEndSecond = (delta: number) => {
    const step = local.secondStep ?? 1;
    const v = ((endSecond() + delta * step) % 60 + 60) % 60;
    setEndSecond(v);
    emitRangeTime(startHour(), startMinute(), startSecond(), endHour(), endMinute(), v);
  };

  const toggleStartAmPm = () => {
    const v = (startHour() + 12) % 24;
    setStartHour(v);
    emitRangeTime(v, startMinute(), startSecond(), endHour(), endMinute(), endSecond());
  };
  const toggleEndAmPm = () => {
    const v = (endHour() + 12) % 24;
    setEndHour(v);
    emitRangeTime(startHour(), startMinute(), startSecond(), v, endMinute(), endSecond());
  };

  const displayHour = () => local.use12Hour ? (hour() % 12 || 12) : hour();
  const displayStartHour = () => local.use12Hour ? (startHour() % 12 || 12) : startHour();
  const displayEndHour = () => local.use12Hour ? (endHour() % 12 || 12) : endHour();
  const ampm = () => hour() < 12 ? 'AM' : 'PM';
  const startAmpm = () => startHour() < 12 ? 'AM' : 'PM';
  const endAmpm = () => endHour() < 12 ? 'AM' : 'PM';

  const isDayRangeStart = (date: Date): boolean => {
    const s = effectiveStart();
    return s ? isSameDay(date, s) : false;
  };

  const isDayRangeEnd = (date: Date): boolean => {
    const e = effectiveEnd();
    return e ? isSameDay(date, e) : false;
  };

  const isDayInRange = (date: Date): boolean => {
    const s = effectiveStart();
    const e = effectiveEnd();
    if (!s || !e) return false;
    const d = startOfDay(date);
    return d > startOfDay(s) && d < startOfDay(e);
  };

  const dayClasses = (day: CalendarDay): string => {
    const classes = ['date-picker__day'];
    if (!day.currentMonth) classes.push('date-picker__day--other-month');
    if (isSameDay(day.date, today)) classes.push('date-picker__day--today');
    if (isDayDisabled(day.date)) classes.push('date-picker__day--disabled');

    if (local.range) {
      const isStart = isDayRangeStart(day.date);
      const isEnd = isDayRangeEnd(day.date);
      const inRange = isDayInRange(day.date);
      if (isStart && isEnd) classes.push('date-picker__day--selected');
      else if (isStart) classes.push('date-picker__day--range-start');
      else if (isEnd) classes.push('date-picker__day--range-end');
      if (inRange) classes.push('date-picker__day--in-range');
    } else {
      const sel = selectedDate();
      if (sel && isSameDay(day.date, sel)) classes.push('date-picker__day--selected');
    }

    return classes.join(' ');
  };

  const containerClasses = () => {
    const classes = ['date-picker'];
    if (size() === 'compact') classes.push('date-picker--compact');
    if (local.disabled) classes.push('date-picker--disabled');
    if (local.invalid || local.error) classes.push('date-picker--invalid');
    if (isOpen()) classes.push('date-picker--open');
    if (local.class) classes.push(local.class);
    return classes.join(' ');
  };

  const calendarPanelClasses = () => {
    const classes = ['date-picker__panel'];
    if (mode() !== 'date') classes.push('date-picker__panel--with-time');
    return classes.join(' ');
  };

  const headerLabel = () => {
    if (viewMode() === 'years') return `${visibleYears()[0]} - ${visibleYears()[visibleYears().length - 1]}`;
    if (viewMode() === 'months') return String(viewYear());
    return `${MONTH_NAMES[viewMonth()]} ${viewYear()}`;
  };

  const inputId = () => local.id ?? fieldCtx?.fieldId ?? local.name;
  const ariaDescribedBy = () => local['aria-describedby'] ?? fieldCtx?.ariaDescribedBy?.();
  const ariaRequired = () => local['aria-required'] ?? local.required ?? fieldCtx?.required;

  return (
    <div class={containerClasses()} {...rest}>
      <Show when={local.label}>
        <label class="date-picker__label" for={inputId()}>
          {local.label}
        </label>
      </Show>

      <div ref={triggerRef} class="date-picker__wrapper">
        <button
          type="button"
          class="date-picker__icon-btn"
          tabIndex={-1}
          disabled={local.disabled}
          onClick={handleIconClick}
          aria-label={mode() === 'time' ? 'Open time picker' : 'Open date picker'}
        >
          {mode() === 'time' ? <BsClock /> : <BsCalendar />}
        </button>
        <input
          id={inputId()}
          type="text"
          class="date-picker__input"
          value={inputText()}
          onInput={handleTextInput}
          onFocus={handleInputFocus}
          onBlur={handleTextBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder()}
          readOnly={!!local.range}
          disabled={local.disabled}
          required={local.required}
          aria-expanded={isOpen()}
          aria-haspopup="dialog"
          aria-invalid={local.invalid || !!local.error}
          aria-describedby={ariaDescribedBy()}
          aria-required={ariaRequired()}
          aria-labelledby={local['aria-labelledby']}
          name={local.name}
          autocomplete="off"
        />
        <Show when={local.clearable && hasValue() && !local.disabled}>
          <button
            type="button"
            class="date-picker__clear"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear"
          >
            <BsX />
          </button>
        </Show>
      </div>

      <Show when={isOpen()}>
        <Portal>
          <div
            ref={calendarRef}
            class={calendarPanelClasses()}
            style={{
              top: `${position().top}px`,
              left: `${position().left}px`,
              opacity: isPositioned() ? 1 : 0,
              transition: isPositioned() ? 'opacity 0.1s ease' : 'none',
            }}
            role="dialog"
            aria-label="Date picker"
          >
            <Show when={mode() !== 'time'}>
              <div class="date-picker__header">
                <button type="button" class="date-picker__nav-btn" onClick={prevPeriod} aria-label="Previous">
                  <BsChevronLeft />
                </button>
                <button type="button" class="date-picker__month-year-btn" onClick={toggleViewMode}>
                  {headerLabel()}
                </button>
                <button type="button" class="date-picker__nav-btn" onClick={nextPeriod} aria-label="Next">
                  <BsChevronRight />
                </button>
              </div>

              <Show when={viewMode() === 'days'}>
                <div class="date-picker__day-headers">
                  <For each={DAY_SHORT}>{(d) => <div class="date-picker__day-header">{d}</div>}</For>
                </div>
                <div class="date-picker__days-grid" onPointerLeave={() => setHoverDate(null)}>
                  <For each={calendarDays()}>
                    {(day) => (
                      <button
                        type="button"
                        class={dayClasses(day)}
                        onClick={() => handleDayClick(day.date)}
                        onPointerEnter={() => local.range && !isDayDisabled(day.date) && setHoverDate(day.date)}
                        disabled={isDayDisabled(day.date)}
                        tabIndex={-1}
                        aria-label={`${day.date.getDate()} ${MONTH_NAMES[day.date.getMonth()]} ${day.date.getFullYear()}`}
                        aria-pressed={!local.range && !!selectedDate() && isSameDay(day.date, selectedDate()!)}
                      >
                        {day.date.getDate()}
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={viewMode() === 'months'}>
                <div class="date-picker__month-grid">
                  <For each={MONTH_SHORT}>
                    {(m, i) => (
                      <button
                        type="button"
                        class={[
                          'date-picker__month-item',
                          i() === viewMonth() ? 'date-picker__month-item--selected' : '',
                          i() === today.getMonth() && viewYear() === today.getFullYear() ? 'date-picker__month-item--today' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => selectMonth(i())}
                      >
                        {m}
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={viewMode() === 'years'}>
                <div class="date-picker__year-grid">
                  <For each={visibleYears()}>
                    {(y) => (
                      <button
                        type="button"
                        class={[
                          'date-picker__year-item',
                          y === viewYear() ? 'date-picker__year-item--selected' : '',
                          y === today.getFullYear() ? 'date-picker__year-item--today' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => selectYear(y)}
                      >
                        {y}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </Show>

            <Show when={mode() !== 'date'}>
              <Show
                when={local.range && mode() === 'datetime'}
                fallback={
                  <div class="date-picker__time">
                    <span class="date-picker__time-label">Time</span>
                    <div class="date-picker__time-columns">
                      <div class="date-picker__time-column">
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustHour(1)} tabIndex={-1} aria-label="Increment hour"><BsChevronUp /></button>
                        <span class="date-picker__time-value">{String(displayHour()).padStart(2, '0')}</span>
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustHour(-1)} tabIndex={-1} aria-label="Decrement hour"><BsChevronDown /></button>
                      </div>
                      <span class="date-picker__time-sep">:</span>
                      <div class="date-picker__time-column">
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustMinute(1)} tabIndex={-1} aria-label="Increment minute"><BsChevronUp /></button>
                        <span class="date-picker__time-value">{String(minute()).padStart(2, '0')}</span>
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustMinute(-1)} tabIndex={-1} aria-label="Decrement minute"><BsChevronDown /></button>
                      </div>
                      <Show when={local.showSeconds}>
                        <span class="date-picker__time-sep">:</span>
                        <div class="date-picker__time-column">
                          <button type="button" class="date-picker__time-btn" onClick={() => adjustSecond(1)} tabIndex={-1} aria-label="Increment second"><BsChevronUp /></button>
                          <span class="date-picker__time-value">{String(second()).padStart(2, '0')}</span>
                          <button type="button" class="date-picker__time-btn" onClick={() => adjustSecond(-1)} tabIndex={-1} aria-label="Decrement second"><BsChevronDown /></button>
                        </div>
                      </Show>
                      <Show when={local.use12Hour}>
                        <button type="button" class="date-picker__ampm-btn" onClick={toggleAmPm} tabIndex={-1}>
                          {ampm()}
                        </button>
                      </Show>
                    </div>
                  </div>
                }
              >
                <div class="date-picker__time date-picker__time--range">
                  <div class="date-picker__time-row">
                    <span class="date-picker__time-label">Start</span>
                    <div class="date-picker__time-columns">
                      <div class="date-picker__time-column">
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustStartHour(1)} tabIndex={-1} aria-label="Increment start hour"><BsChevronUp /></button>
                        <span class="date-picker__time-value">{String(displayStartHour()).padStart(2, '0')}</span>
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustStartHour(-1)} tabIndex={-1} aria-label="Decrement start hour"><BsChevronDown /></button>
                      </div>
                      <span class="date-picker__time-sep">:</span>
                      <div class="date-picker__time-column">
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustStartMinute(1)} tabIndex={-1} aria-label="Increment start minute"><BsChevronUp /></button>
                        <span class="date-picker__time-value">{String(startMinute()).padStart(2, '0')}</span>
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustStartMinute(-1)} tabIndex={-1} aria-label="Decrement start minute"><BsChevronDown /></button>
                      </div>
                      <Show when={local.showSeconds}>
                        <span class="date-picker__time-sep">:</span>
                        <div class="date-picker__time-column">
                          <button type="button" class="date-picker__time-btn" onClick={() => adjustStartSecond(1)} tabIndex={-1} aria-label="Increment start second"><BsChevronUp /></button>
                          <span class="date-picker__time-value">{String(startSecond()).padStart(2, '0')}</span>
                          <button type="button" class="date-picker__time-btn" onClick={() => adjustStartSecond(-1)} tabIndex={-1} aria-label="Decrement start second"><BsChevronDown /></button>
                        </div>
                      </Show>
                      <Show when={local.use12Hour}>
                        <button type="button" class="date-picker__ampm-btn" onClick={toggleStartAmPm} tabIndex={-1}>
                          {startAmpm()}
                        </button>
                      </Show>
                    </div>
                  </div>
                  <div class="date-picker__time-row">
                    <span class="date-picker__time-label">End</span>
                    <div class="date-picker__time-columns">
                      <div class="date-picker__time-column">
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustEndHour(1)} tabIndex={-1} aria-label="Increment end hour"><BsChevronUp /></button>
                        <span class="date-picker__time-value">{String(displayEndHour()).padStart(2, '0')}</span>
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustEndHour(-1)} tabIndex={-1} aria-label="Decrement end hour"><BsChevronDown /></button>
                      </div>
                      <span class="date-picker__time-sep">:</span>
                      <div class="date-picker__time-column">
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustEndMinute(1)} tabIndex={-1} aria-label="Increment end minute"><BsChevronUp /></button>
                        <span class="date-picker__time-value">{String(endMinute()).padStart(2, '0')}</span>
                        <button type="button" class="date-picker__time-btn" onClick={() => adjustEndMinute(-1)} tabIndex={-1} aria-label="Decrement end minute"><BsChevronDown /></button>
                      </div>
                      <Show when={local.showSeconds}>
                        <span class="date-picker__time-sep">:</span>
                        <div class="date-picker__time-column">
                          <button type="button" class="date-picker__time-btn" onClick={() => adjustEndSecond(1)} tabIndex={-1} aria-label="Increment end second"><BsChevronUp /></button>
                          <span class="date-picker__time-value">{String(endSecond()).padStart(2, '0')}</span>
                          <button type="button" class="date-picker__time-btn" onClick={() => adjustEndSecond(-1)} tabIndex={-1} aria-label="Decrement end second"><BsChevronDown /></button>
                        </div>
                      </Show>
                      <Show when={local.use12Hour}>
                        <button type="button" class="date-picker__ampm-btn" onClick={toggleEndAmPm} tabIndex={-1}>
                          {endAmpm()}
                        </button>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>
            </Show>

            <div class="date-picker__footer">
              <div class="date-picker__footer-actions">
                <Show when={mode() !== 'time'}>
                  <button type="button" class="date-picker__footer-btn" onClick={handleTodayClick}>
                    Today
                  </button>
                </Show>
                <Show when={mode() !== 'date'}>
                  <button type="button" class="date-picker__footer-btn" onClick={handleNowClick}>
                    Now
                  </button>
                </Show>
              </div>
              <Show when={local.range}>
                <span class="date-picker__range-hint">
                  {rangeStep() === 'start' ? 'Pick start date' : 'Pick end date'}
                </span>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
