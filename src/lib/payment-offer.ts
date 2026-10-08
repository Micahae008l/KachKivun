import type { PaymentProduct } from "@/lib/api";

/** Grow payment-link pages redirect to a fixed URL, so the order to check is kept here. */
export const PENDING_PAYMENT_RETURN_KEY = "kk.pendingPaymentReturn";

export function formatPaymentPrice(product: PaymentProduct): string {
  const amount = product.amountMinor / 100;
  const formatted = amount.toLocaleString("he-IL", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return product.currency === "ILS" ? `₪${formatted}` : `${formatted} ${product.currency}`;
}
