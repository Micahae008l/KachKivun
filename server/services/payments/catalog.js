export const AI_COUNSELOR_TOP_TWO_PRODUCT_KEY = "ai_counselor_top_two";

export const PAYMENT_METHOD_PRIORITY = Object.freeze(["apple_pay", "bit", "google_pay", "card"]);

/**
 * Limited-time sale: a real 40% off (₪24.99 → ₪14.99) until `endsAt`, then the regular price
 * returns by itself. Set the Grow link price to match on both dates; webhooks accept either price
 * so a payment made around the switch still unlocks. To change or end the sale, edit this object.
 */
export const SALE = Object.freeze({
  amountMinor: 1499,
  endsAt: "2026-10-26T21:59:59.000Z", // Monday 26 Oct 2026, 23:59 Israel time
});

export function isSaleActive(now = new Date()) {
  return now.getTime() < Date.parse(SALE.endsAt);
}

const products = {
  [AI_COUNSELOR_TOP_TWO_PRODUCT_KEY]: Object.freeze({
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    displayName: "פתיחת מקומות 3, 2 ו־1",
    // Regular price. Must equal the price on the Grow payment link outside a sale.
    amountMinor: 2499,
    currency: "ILS",
    permanent: true,
    futureRecalculationsIncluded: true,
    vatIncludedWhereApplicable: true,
    billingType: "one_time",
  }),
};

export const PAYMENT_CATALOG = Object.freeze(products);

export function getPaymentProduct(productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY, now = new Date()) {
  const key = String(productKey || "");
  if (!Object.hasOwn(PAYMENT_CATALOG, key)) {
    const error = new Error("Unknown payment product");
    error.code = "PAYMENT_PRODUCT_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }
  const product = PAYMENT_CATALOG[key];
  const sale = isSaleActive(now);
  return Object.freeze({
    ...product,
    amountMinor: sale ? SALE.amountMinor : product.amountMinor,
    listAmountMinor: product.amountMinor,
    saleEndsAt: sale ? SALE.endsAt : null,
  });
}

/** Every real price of the product: the current one and, during a sale, the regular one too. */
export function acceptedAmountsMinor(productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY, now = new Date()) {
  const product = getPaymentProduct(productKey, now);
  return [...new Set([product.amountMinor, product.listAmountMinor, SALE.amountMinor])];
}

export function publicPaymentProduct(productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY) {
  const product = getPaymentProduct(productKey);
  return {
    productKey: product.productKey,
    displayName: product.displayName,
    amountMinor: product.amountMinor,
    listAmountMinor: product.listAmountMinor,
    saleEndsAt: product.saleEndsAt,
    currency: product.currency,
    permanent: product.permanent,
    futureRecalculationsIncluded: product.futureRecalculationsIncluded,
    vatIncludedWhereApplicable: product.vatIncludedWhereApplicable,
    billingType: product.billingType,
  };
}
