/**
 * Development stand-in for a payment page: no money moves, the payment is
 * confirmed on the spot and the buyer goes straight to the return page.
 */
export async function createCheckout({ payment, returnUrl }) {
  return { url: returnUrl, confirmNow: { transactionId: `mock_${payment._id}` } };
}
