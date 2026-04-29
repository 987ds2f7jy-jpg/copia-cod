import React from 'react';
import { Banknote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/client-api/payments';
import { cn } from '@/lib/utils';

function normalizeAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

export default function NetAmountBadge({ amount, className = '' }) {
  const normalizedAmount = normalizeAmount(amount);

  if (normalizedAmount === null) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700',
        'dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
        className,
      )}
    >
      <Banknote className="h-3 w-3" />
      {formatMoney(normalizedAmount)}
    </Badge>
  );
}
