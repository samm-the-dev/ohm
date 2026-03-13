import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { toISODate } from '../../utils/schedule-utils';

interface DatePickerProps {
  value?: string;
  onChange: (date: string | undefined) => void;
  max?: string;
  className?: string;
  accent?: { border: string; ring: string };
}

export function DatePicker({ value, onChange, max, className, accent }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = value ? parseISO(value) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  return (
    <>
      {/* Desktop: popover calendar */}
      <div className={`hidden md:block ${className ?? ''}`}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${accent?.border ?? 'border-ohm-border'} bg-ohm-bg font-body text-ohm-text flex items-center gap-2 rounded-md border px-3 py-1.5 text-base transition-colors hover:bg-white/5`}
            >
              <CalendarIcon size={14} className="text-ohm-muted" />
              {selected ? (
                format(selected, 'MMM d, yyyy')
              ) : (
                <span className="text-ohm-muted/50">Pick a date</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="border-ohm-border bg-ohm-bg p-0">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(day) => {
                onChange(day ? toISODate(day) : undefined);
                setOpen(false);
              }}
              disabled={maxDate ? { after: maxDate } : undefined}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile: native date input */}
      <div className={`md:hidden ${className ?? ''}`}>
        <input
          type="date"
          autoComplete="off"
          data-form-type="other"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          max={max}
          className={`${accent?.border ?? 'border-ohm-border'} bg-ohm-bg font-body text-ohm-text focus:ring-ohm-text/10 rounded-md border px-3 py-1.5 text-base focus:ring-1 focus:outline-hidden`}
        />
      </div>
    </>
  );
}
