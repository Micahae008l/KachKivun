import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import type { PaymentProduct } from "@/lib/api";
import { formatPaymentPrice, salePercentOff } from "@/lib/payment-offer";

const pad = (n: number) => String(n).padStart(2, "0");

/** "2 ימים 14:05:33", or "14:05:33" on the last day; null once the sale is over. */
function countdown(endsAt: string, now: number) {
  const s = Math.floor((Date.parse(endsAt) - now) / 1000);
  if (!(s > 0)) return null;
  const days = Math.floor(s / 86_400);
  const clock = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  if (days === 0) return { days: "", clock };
  return { days: days === 1 ? "יום" : `${days} ימים`, clock };
}

/**
 * Real, time-limited sale (the end date and both prices come from the server catalog): the regular
 * price struck through, the percent off and a live countdown. Renders nothing outside a sale.
 */
export function SaleTag({
  product,
  className = "",
}: {
  product: PaymentProduct;
  className?: string;
}) {
  // Starts after mount: a ticking clock can never match the server-rendered HTML.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const percent = salePercentOff(product);
  if (!percent || !product.saleEndsAt) return null;
  const left = now == null ? null : countdown(product.saleEndsAt, now);
  if (now != null && !left) return null;
  const regular = formatPaymentPrice({
    ...product,
    amountMinor: product.listAmountMinor ?? product.amountMinor,
  });

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`.trim()} dir="rtl">
      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-black text-primary-foreground">
        {percent}% הנחה
      </span>
      <s className="font-mono text-sm text-dust/80" dir="ltr" aria-label={`במקום ${regular}`}>
        {regular}
      </s>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Timer className="h-3.5 w-3.5 text-primary" aria-hidden />
        נגמר בעוד
        {left ? (
          <>
            {left.days ? <span>{left.days}</span> : null}
            <span className="font-mono font-bold tabular-nums text-primary" dir="ltr">
              {left.clock}
            </span>
          </>
        ) : (
          <span className="font-mono tabular-nums text-dust" dir="ltr">
            --:--:--
          </span>
        )}
      </span>
    </div>
  );
}
