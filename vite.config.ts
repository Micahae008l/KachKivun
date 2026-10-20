// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      proxy: {
        "/api": {
          target: `http://localhost:${process.env.API_PORT || 3001}`,
          changeOrigin: true,
          timeout: 120_000,
          proxyTimeout: 120_000,
          /** When nothing listens on :3001, http-proxy would surface as an opaque 500 — make it explicit. */
          configure(proxy) {
            proxy.on("error", (err, req, res) => {
              const out = res as import("http").ServerResponse | undefined;
              if (!out || typeof out.writeHead !== "function" || out.headersSent) return;
              const code =
                err && typeof err === "object" && "code" in err
                  ? (err as NodeJS.ErrnoException).code
                  : undefined;
              const refused = code === "ECONNREFUSED";
              const reset = code === "ECONNRESET" || code === "EPIPE";
              const path = req && typeof req === "object" && "url" in req && typeof (req as import("http").IncomingMessage).url === "string"
                ? (req as import("http").IncomingMessage).url
                : "";
              const msg = refused
                ? `שרת ה-API לא זמין ב־http://localhost:3001 (בקשה: ${path || "/api/…"}). מהשורש הריצו npm run dev (מפעיל API + אתר) — או בשני חלונות: npm run server ואז npm run dev:web. ודאו ש־MongoDB רץ ושהגדרות השרת ב־server/.env.`
                : reset
                  ? `שרת ה-API מתעדכן (הפעלה מחדש). המתינו 2–3 שניות ונסו שוב.`
                  : `שגיאת רשת מול שרת ה-API: ${err instanceof Error ? err.message : String(err)}`;
              out.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
              out.end(JSON.stringify({ error: msg }));
            });
          },
        },
      },
    },
  },
});
