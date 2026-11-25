import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeStyles = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950',
        secondary: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        outline: 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300',
        destructive: 'border-transparent bg-red-600 text-white',
        live: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        estimated: 'border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeStyles> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeStyles({ variant }), className)} {...props} />;
}
