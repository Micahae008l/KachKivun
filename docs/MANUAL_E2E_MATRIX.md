# Manual/E2E release matrix

No browser automation framework is currently installed. Run this concise matrix before enabling live charging; do not add real credentials or use production money except for the explicitly allowlisted low-value verification in the rollout guide.

## Assessment and results

- Mobile RTL (narrow iPhone and Android widths): disclosure appears before the first question, adaptive branches do not overflow, progress remains readable, and ranks render 5 → 1.
- Keyboard only: skip link, header/menu, all choices, sliders, OTP, role expansion, checkout, confirmation, receipts, and cancellation are reachable with a visible focus indicator.
- Screen reader: headings progress in order, form errors are announced, selected choices expose state, loaders have status text, locked roles do not expose hidden names, and refund state is understandable without icons.
- Reduced motion (OS preference and in-app control): no forced assessment/card delays; transitions, pulses, and spinners collapse to effectively zero duration while status text remains visible.
- Adaptive validation: combat and technical questions appear only when derived from prior answers; required branch answers are rejected client- and server-side; stale hidden branch answers are not persisted.
- Recalculation: free accounts continue to see ranks 5–3; grandfathered and paid accounts see all five after profile changes and later recalculations.

## Authentication and privacy

- OTP signup/login: request, resend cooldown, invalid/expired code, successful verify, refresh, logout, and resume draft.
- Inspect Plausible requests: no email, name, phone, free text, role title, scores, order ID, token, share token, or raw error. Query/hash are absent and `/checkout/<token>` is reported as `/checkout/:share`.
- Parent share: public payer sees product/merchant/payment details but no account profile, recommendation names, user ID, or account email.

## Checkout and return

- Standard mobile/desktop browser and Instagram in-app browser: warning/copy behavior is correct and the coarse browser category contains no user-agent string.
- Interrupted redirect: closing the provider tab or returning with `interrupted=1` never grants access from the URL alone; server verification decides the state.
- Forged callback: wrong URL secret, amount, currency, product, process, method, or transaction token fails closed.
- Duplicate and out-of-order callbacks: repeated paid/refunded callbacks are idempotent; pending/failed callbacks never grant access.
- Payment disabled: offer, checkout, share, return, callback, and refund API routes return `PAYMENTS_DISABLED`; production starts without Grow credentials.
- Card: sandbox flow, receipt callback, return page, and cancellation page.
- Bit and Apple Pay: no wallet sandbox is assumed. Test only in the allowlisted low-value live stage, then request and confirm refund.
- Google Pay (only if Grow enables a reviewed PageCode): unsupported device is not offered as proof of failure; supported live test follows the same allowlist/refund rule.

## Cancellation and refunds

- Guest sees OTP login direction and published support email.
- Purchaser sees only their paid, refund-pending, and refunded orders plus trusted receipt links.
- First click opens an explicit confirmation; cancellation request is idempotent.
- A requested/unconfirmed refund keeps the entitlement active and shows pending state.
- Only provider-confirmed refund changes the order to refunded and revokes the payment-sourced entitlement; refund receipt appears when supplied.
- A pre-launch grandfathered account remains unlocked independently of migration timing.
