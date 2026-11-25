import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertStyles = cva(
  'relative w-full rounded-xl border p-4 text-sm flex gap-3 items-start',
  {
    variants: {
      variant: {
        default: 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-100',
        warning: 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100',
        destructive: 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-950 dark:text-red-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertStyles> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertStyles({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('font-semibold leading-snug', className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-xs opacity-90 mt-0.5', className)} {...props} />;
}
