import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Drawer } from 'vaul';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useHistoryDismiss } from '@/hooks/useHistoryDismiss';

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** vaul snap points for mobile drawer (fractions 0-1). Ignored on desktop. */
  snapPoints?: (number | string)[];
  /** Which snap point to start at when the drawer opens. Defaults to last (fully open). */
  activeSnapPoint?: number | string | null;
  onSnapPointChange?: (snap: number | string | null) => void;
  /**
   * Index of the snap point from which the overlay starts fading in.
   * Defaults to 0 (overlay visible at all snap points).
   * Set to a higher index to keep the overlay transparent at lower snap points.
   */
  fadeFromIndex?: number;
}

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  snapPoints,
  activeSnapPoint,
  onSnapPointChange,
  fadeFromIndex = 0,
}: ResponsiveDialogProps) {
  const mobile = useIsMobile();
  const onClose = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useHistoryDismiss(open, onClose);

  if (mobile) {
    const snapProps = snapPoints
      ? {
          snapPoints,
          fadeFromIndex,
          ...(activeSnapPoint !== undefined && {
            activeSnapPoint,
            setActiveSnapPoint: onSnapPointChange,
          }),
        }
      : {};
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} {...snapProps} noBodyStyles>
        {children}
      </Drawer.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

interface ResponsiveDialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  className?: string;
  /**
   * When true, skips the inner scroll wrapper so the consumer can manage its
   * own height/scroll layout (e.g. a tabbed settings page with sticky header).
   */
  managed?: boolean;
}

const ResponsiveDialogContent = React.forwardRef<HTMLDivElement, ResponsiveDialogContentProps>(
  ({ className, children, managed, style, ...props }, ref) => {
    const mobile = useIsMobile();

    if (mobile) {
      return (
        <Drawer.Portal>
          <Drawer.Overlay
            className="fixed inset-x-0 top-0 z-50 bg-black/60 backdrop-blur-xs"
            style={{ bottom: 'var(--budget-bar-height, 0px)' }}
          />
          <Drawer.Content
            ref={ref}
            className={cn(
              'border-ohm-border bg-ohm-surface fixed inset-x-0 z-50 flex flex-col rounded-t-xl border-t outline-none',
              className,
            )}
            style={{
              ...style,
              bottom: 'var(--budget-bar-height, 0px)',
              maxHeight: 'calc(100dvh - var(--budget-bar-height, 0px))',
            }}
            {...props}
          >
            <Drawer.Handle className="bg-ohm-muted/40 mx-auto my-4 h-1 w-9 shrink-0 rounded-full" />
            {managed ? (
              <>{children}</>
            ) : (
              <div className="overflow-y-auto px-5 pb-5">{children}</div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      );
    }

    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              'animate-slide-up border-ohm-border bg-ohm-surface relative max-h-[90dvh] w-full max-w-lg rounded-xl border shadow-2xl',
              managed ? 'flex flex-col p-0' : 'overflow-y-auto p-5',
              className,
            )}
            {...props}
          >
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    );
  },
);
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent';

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const ResponsiveDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
ResponsiveDialogHeader.displayName = 'ResponsiveDialogHeader';

const ResponsiveDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
ResponsiveDialogFooter.displayName = 'ResponsiveDialogFooter';

const ResponsiveDialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg leading-none font-semibold tracking-tight', className)}
    {...props}
  />
));
ResponsiveDialogTitle.displayName = 'ResponsiveDialogTitle';

const ResponsiveDialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
));
ResponsiveDialogDescription.displayName = 'ResponsiveDialogDescription';

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
