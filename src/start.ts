import { createMiddleware, createStart } from "@tanstack/react-start";

// Every external origin the site talks to; keep in sync with what pages load.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.kachkivun.com https://plausible.io",
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

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}));
