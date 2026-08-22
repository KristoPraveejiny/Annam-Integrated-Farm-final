import { useState, useMemo, useRef, useEffect } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** Local YYYY-MM-DD. toISOString() would shift the day across a timezone. */
const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** YYYY-MM-DD dates that cannot be picked, e.g. a worker's approved leave. */
  disabledDates?: string[];
  /** Earliest selectable date, YYYY-MM-DD. */
  min?: string;
  disabledReason?: string;
  placeholder?: string;
};

/**
 * A month picker that can grey out individual days.
 *
 * The native date input cannot disable specific dates - only a min/max range -
 * so a manager could pick a day the worker is on leave and only find out when
 * the server rejected it.
 */
export function LeaveAwareDatePicker({
  value,
  onChange,
  disabledDates = [],
  min,
  disabledReason = 'Unavailable',
  placeholder = 'Select a date'
}: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => (value ? new Date(value) : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  const blocked = useMemo(() => new Set(disabledDates), [disabledDates]);

  useEffect(() => {
    if (value) setCursor(new Date(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first offset.
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    return cells;
  }, [cursor]);

  const isDisabled = (date: Date) => {
    const key = toKey(date);
    if (min && key < min) return true;
    return blocked.has(key);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-left text-white focus:border-emerald-500 focus:outline-none"
      >
        <span className={value ? '' : 'text-slate-500'}>
          {value ? new Date(value).toLocaleDateString() : placeholder}
        </span>
        <FiCalendar className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg p-1 text-slate-300 hover:bg-white/10"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <FiChevronLeft />
            </button>
            <span className="text-sm font-bold text-white">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              className="rounded-lg p-1 text-slate-300 hover:bg-white/10"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <FiChevronRight />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-center text-[10px] font-bold uppercase text-slate-500">{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((date, index) => {
              if (!date) return <span key={`pad-${index}`} />;

              const key = toKey(date);
              const disabled = isDisabled(date);
              const selected = value === key;
              const onLeave = blocked.has(key);

              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  title={onLeave ? disabledReason : undefined}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`relative h-8 rounded-lg text-xs font-semibold transition-colors ${
                    selected
                      ? 'bg-emerald-600 text-white'
                      : onLeave
                        ? 'cursor-not-allowed bg-red-500/10 text-red-400/70 line-through'
                        : disabled
                          ? 'cursor-not-allowed text-slate-700'
                          : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {blocked.size > 0 && (
            <p className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2 text-[11px] text-red-300">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-500/40" />
              {disabledReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
