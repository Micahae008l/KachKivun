export function normalizeAnalyticsPath(pathname: string): string;
export function sanitizeAnalyticsUrl(input: string, fallbackOrigin?: string): string;
export function sanitizeAnalyticsProps(
  eventName: string,
  input?: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined;
export function isKnownAnalyticsEvent(eventName: string): boolean;
