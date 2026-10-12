import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import type { PaymentProduct } from "@/lib/api";
import { formatPaymentPrice, salePercentOff } from "@/lib/payment-offer";

function remaining(endsAt: string, now: number) {
  const ms = Date.parse(endsAt) - now;
  if (!(ms > 0)) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days} ימים ו־${hours} שעות`;
  if (hours > 0) return `${hours} שעות ו־${minutes} דקות`;
  return `${Math.max(1, minutes)} דקות`;
}

/**
 * Real, time-limited sale (the end date and both prices come from the server catalog): the regular
 * price struck through, the percent off and a live countdown. Renders nothing outside a sale.
 */
export function SaleTag({ product, className = "" }: { product: PaymentProduct; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const percent = salePercentOff(product);
  if (!percent || !product.saleEndsAt) return null;
  const left = remaining(product.saleEndsAt, now);
  if (!left) return null;
  const regular = formatPaymentPrice({ ...product, amountMinor: product.listAmountMinor ?? product.amountMinor });

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`.trim()} dir="rtl">
      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-black text-primary-foreground">
        {percent}% הנחה
      </span>
      <s className="font-mono text-sm text-dust/80" dir="ltr" aria-label={`במקום ${regular}`}>
        {regular}
      </s>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
        <Timer className="h-3.5 w-3.5 text-primary" aria-hidden />
        לזמן מוגבל · נגמר בעוד {left}
      </span>
    </div>
  );
}
