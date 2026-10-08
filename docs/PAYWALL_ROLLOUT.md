# Personalized funnel and paywall rollout

The two release controls are:

- `PERSONALIZED_FUNNEL_V2` — declares the adaptive assessment rollout.
- `PAYWALL_ENABLED` — fail-safe charging and rank-lock control. Production charging is off unless this is explicitly `true`.

`render.yaml` intentionally keeps `PAYWALL_ENABLED=false`. Do not change it until every hard gate below is complete.

## Hard launch gates

Before any live charge:

1. Israeli counsel must approve the minor-payer and digital-service cancellation wording. Only then set `ISRAELI_LEGAL_REVIEW_CONFIRMED=true`.
2. Grow must confirm the callback-authentication design. The current implementation uses an unguessable callback URL secret and independently verifies immutable transaction fields with a server-to-server inquiry because Grow has not documented an HMAC. Only then set `GROW_CALLBACK_AUTH_CONFIRMED=true`.
3. Grow must complete its merchant domain and integration review. Only then set `GROW_DOMAIN_REVIEW_APPROVED=true`.
4. Supply real `BUSINESS_LEGAL_NAME`, `BUSINESS_PHONE`, `BUSINESS_ADDRESS`, `BUSINESS_CONTACT_EMAIL`, `CANCELLATION_URL`, and an ISO `PAYWALL_LAUNCH_AT`. Never invent operator details.
5. Supply Grow production identifiers and at least one reviewed production PageCode. Keep all credentials outside the repository.
6. Run `npm --prefix server run check:production`. A non-zero exit blocks launch.

## Stages

### 0. Internal and mock

- Keep `NODE_ENV` non-production, `PAYMENTS_PROVIDER=mock`, and use only test accounts.
- Verify checkout, parent-share, verified-return behavior, duplicate requests, refund-pending, and provider-confirmed revocation.
- Mock and Grow sandbox are forbidden in production.

### 1. Grow sandbox card

- Set `PAYMENTS_PROVIDER=grow` and `GROW_ENV=sandbox` in a non-production environment.
- Use the Grow sandbox card flow and verify callbacks, inquiry, approval, invoice links, and refund state.
- Grow does not provide a reliable wallet sandbox for Bit or Apple Pay; do not treat a card sandbox result as wallet validation.

### 2. Allowlisted low-value live verification

- Complete all hard gates first.
- Use a production environment restricted to named internal test accounts/domain access.
- Make one low-value ₪10 Bit transaction and one Apple Pay transaction where supported, then request and confirm each refund.
- Confirm the entitlement remains active while the refund is pending and is revoked only after provider-confirmed refund evidence.
- Confirm receipts and refund receipts open from the cancellation page.

### 3. Grandfather migration

1. Freeze the launch cutoff in `PAYWALL_LAUNCH_AT`.
2. Dry run (default):

   `npm --prefix server run grandfather-paywall`

3. Review eligible, existing-entitlement, already-grandfathered, and would-mark counts.
4. Apply explicitly:

   `npm --prefix server run grandfather-paywall -- --apply`

5. Re-run the dry run. It must report no remaining markers to add. Access checks also auto-upsert a missing marker for an eligible pre-launch account.

### 4. Small cohort

- Keep the general deployment disabled while an access-controlled production preview is tested by a small invited cohort.
- Watch the full funnel by device/browser and payment method; do not send account, role, profile, order, or token data to analytics.
- Expand only after support, cancellation, callback, receipt, and refund checks remain healthy.

### 5. Full rollout

- Re-run tests, production build, production readiness, and the manual matrix.
- Set all reviewed production values, then explicitly set `PAYWALL_ENABLED=true`.
- Verify the public offer contains only the product, configured methods, processor/receipt indicator, and published merchant contacts.

## Metrics and rollback

Monitor aggregate, non-PII counts for assessment completion, OTP success, counselor views, free-role expansion, paywall views, checkout starts, method selection, payment confirmed/failed/refunded, and unlocked-top-role views. Also monitor callback errors, duplicate/out-of-order callbacks, refund-pending age, receipt availability, support volume, and conversion by coarse browser category.

Rollback triggers include unexpected charges, callback-auth uncertainty, amount/method mismatch, entitlement leakage, inability to request refunds, missing legal operator details, or material accessibility regression.

To stop charging, set `PAYWALL_ENABLED=false` and redeploy. This also makes payment API routes return `PAYMENTS_DISABLED` and removes rank locking. Preserve the database and Grow records. Continue handling any existing purchaser through the published support email and Grow merchant console while the incident is resolved; never delete orders or manually revoke access before provider-confirmed refund.
