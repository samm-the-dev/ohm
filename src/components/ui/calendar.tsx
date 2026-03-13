import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('bg-background p-3', className)}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-8 w-full items-center justify-center',
          defaultClassNames.month_caption,
        ),
        caption_label: cn('text-sm font-medium select-none', defaultClassNames.caption_label),
        table: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        day: cn(
          'group/day relative flex aspect-square size-8 items-center justify-center p-0 text-center text-sm select-none',
          defaultClassNames.day,
        ),
        today: cn('rounded-md bg-accent text-accent-foreground', defaultClassNames.today),
        outside: cn('text-muted-foreground opacity-50', defaultClassNames.outside),
        disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootCn, rootRef, ...rootProps }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(rootCn)} {...rootProps} />
        ),
        Chevron: ({ className: chevCn, orientation, ...chevProps }) =>
          orientation === 'left' ? (
            <ChevronLeftIcon className={cn('size-4', chevCn)} {...chevProps} />
          ) : (
            <ChevronRightIcon className={cn('size-4', chevCn)} {...chevProps} />
          ),
        DayButton: ({ className: dayCn, day: _day, modifiers, ...dayProps }) => {
          const ref = React.useRef<HTMLButtonElement>(null);
          React.useEffect(() => {
            if (modifiers.focused) ref.current?.focus();
          }, [modifiers.focused]);

          return (
            <button
              ref={ref}
              type="button"
              data-selected={modifiers.selected || undefined}
              className={cn(
                'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring data-[selected]:bg-primary data-[selected]:text-primary-foreground inline-flex size-8 items-center justify-center rounded-md text-sm font-normal transition-colors focus-visible:ring-1 focus-visible:outline-hidden',
                dayCn,
              )}
              {...dayProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
