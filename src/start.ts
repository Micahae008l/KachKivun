import { createMiddleware, createStart } from "@tanstack/react-start";

// Every external origin the site talks to; keep in sync with what pages load.
const CSP = [
  "default-src 'self'",
  // static.cloudflareinsights.com: Cloudflare Web Analytics, injected by Cloudflare on the live site.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.google-analytics.com https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com",
  "connect-src 'self' https://api.kachkivun.com https://plausible.io https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com https://cloudflareinsights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // No `preload`: joining the browser preload list is hard to undo.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // ponytail: report-only until the live console shows no violations, then rename to Content-Security-Policy.
  "Content-Security-Policy-Report-Only": CSP,
};

/** Security headers on every page and server-function response. */
const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next();
  // Copy into a fresh Response: some upstream responses have immutable headers.
  const headers = new Headers(result.response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return {
    ...result,
    response: new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers,
    }),
  };
});

/** First path segments of public pages whose case is normalized (/About → /about). */
const PUBLIC_SECTIONS = new Set([
  "about",
  "contact",
  "role-insights",
  "roles",
  "blog",
  "attention-test",
  "role-calculator",
  "privacy",
  "terms",
  "accessibility",
  "cancellation",
]);

/**
 * Canonical page URL, or null when the path already is one. Drops trailing slashes, and lowercases
 * the first segment of public pages only: slugs are Hebrew (percent-encoded, never touched) and
 * other routes carry case-sensitive tokens (/report/$id, /checkout/$token).
 */
function canonicalPath(pathname: string): string | null {
  let path = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
  const first = path.split("/")[1] ?? "";
  if (/[A-Z]/.test(first) && PUBLIC_SECTIONS.has(first.toLowerCase())) {
    path = `/${first.toLowerCase()}${path.slice(first.length + 1)}`;
  }
  return path === pathname ? null : path;
}

/**
 * 301 to the canonical page URL. Without it the router answers a trailing slash with a 307 and
 * serves /About as a duplicate page.
 */
const canonicalRedirect = createMiddleware().server(({ request, pathname, handlerType, next }) => {
  if (handlerType !== "router" || (request.method !== "GET" && request.method !== "HEAD")) {
    return next();
  }
  const target = canonicalPath(pathname);
  if (!target) return next();
  const { search } = new URL(request.url);
  return new Response(null, { status: 301, headers: { Location: target + search } });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders, canonicalRedirect],
}));
