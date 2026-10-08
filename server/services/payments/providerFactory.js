import { getLifecyclePaymentConfig, getPaymentConfig } from "./config.js";
import { PaymentError } from "./errors.js";
import { GrowLinkProvider } from "./growLinkProvider.js";
import { GrowProvider } from "./growProvider.js";
import { MockPaymentProvider } from "./mockProvider.js";

function providerFor(config, fetchImpl) {
  if (config.provider === "grow") return new GrowProvider(config, { fetchImpl });
  if (config.provider === "grow_link") return new GrowLinkProvider(config);
  return new MockPaymentProvider(config);
}

export function createPaymentProvider({
  env = process.env,
  config = getPaymentConfig(env),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!config.enabled || config.provider === "disabled") {
    throw new PaymentError("PAYMENTS_DISABLED", "התשלומים אינם זמינים כרגע.", 503);
  }
  return providerFor(config, fetchImpl);
}

export function createLifecyclePaymentProvider({
  env = process.env,
  order = null,
  config = getLifecyclePaymentConfig(env, { provider: order?.provider }),
  fetchImpl = globalThis.fetch,
} = {}) {
  return providerFor(config, fetchImpl);
}
