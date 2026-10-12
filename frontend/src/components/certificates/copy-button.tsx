'use client';

import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-certificates';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string;
  /** Visible text. Without it the button is icon-only and `label` is its accessible name. */
  text?: string;
  label: string;
  successMessage?: string;
}

/** Copies `value` to the clipboard and confirms with a check mark. */
export function CopyButton({ value, text, label, successMessage, className, variant = 'ghost', size, ...props }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();
  const Icon = copied ? Check : Copy;

  const onClick = async () => {
    const ok = await copy(value);
    if (!ok) {
      toast({ title: 'Could not copy', description: 'Your browser blocked clipboard access. Select the text and copy it manually.', variant: 'destructive' });
    } else if (successMessage) {
      toast({ title: successMessage });
    }
  };

  if (!text) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size ?? 'icon'}
        onClick={onClick}
        aria-label={label}
        title={label}
        className={cn('h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground', className)}
        {...props}
      >
        <Icon className={cn('h-3.5 w-3.5', copied && 'text-emerald-600 dark:text-emerald-400')} />
      </Button>
    );
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={onClick} aria-label={label} className={className} {...props}>
      <Icon className={cn('mr-2 h-4 w-4', copied && 'text-emerald-600 dark:text-emerald-400')} />
      {copied ? 'Copied' : text}
    </Button>
  );
}
