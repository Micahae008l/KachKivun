import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { markFunnelStep } from "@/lib/funnel";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { warmApi, bootstrapAuth, logoutRequest } from "@/lib/api";
import { getToken, isStoredAdmin, setStoredRole, subscribeAuth } from "@/lib/auth";
import { prefetchAuthedData, sessionQueryOptions } from "@/lib/queries";
import { MotionConfig } from "framer-motion";
import { ChevronLeft, ClipboardList, Menu, X } from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { FREE_TOOLS, FREE_TOOLS_LABEL, NavToolsMenu } from "@/components/NavToolsMenu";
import { SiteFooter } from "@/components/FooterNav";
import appCss from "../styles.css?url";
import { queryClient } from "@/lib/query-client";
import { KachKivunLogo } from "@/components/KachKivunLogo";
import { SITE_DESCRIPTION, SITE_NAME_HE } from "@/lib/brand";
import { ARIA, MAIN_CONTENT_ID, MOBILE_NAV_ID } from "@/lib/a11y";
import {
  A11Y_BOOT_SCRIPT,
  A11Y_PREFS_EVENT,
  readA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y-prefs";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
import { CookieConsent } from "@/components/CookieConsent";
import { preloadIdfBackdropImages } from "@/lib/idf-images";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trackError } from "@/lib/analytics";
import { startAttribution } from "@/lib/attribution";
import { CONSENT_BOOT_SCRIPT } from "@/lib/third-party-analytics";

// Weights the site uses: 400, 500, 600, 700, 900 (800 was loaded but never used).
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;600&display=swap";
/** Adds the Google Fonts stylesheet without blocking render; text shows in a system font first. */
const FONT_LOADER_SCRIPT = `(function(){var l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(FONT_CSS)};document.head.appendChild(l)})()`;

const SITE_URL = "https://kachkivun.com";

// Loaded after hydration: no toast can fire before then, and it keeps sonner out of the entry bundle.
const Toaster = lazy(() => import("sonner").then((m) => ({ default: m.Toaster })));

export const Route = createRootRoute({
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_DESCRIPTION },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "he_IL" },
      { property: "og:site_name", content: SITE_NAME_HE },
      { property: "og:title", content: SITE_DESCRIPTION },
      { property: "og:description", content: SITE_DESCRIPTION },
      // Absolute: WhatsApp, Facebook and X ignore relative og:image paths.
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { property: "og:image:alt", content: "קח כיוון: לאילו תפקידים בצה״ל אתם באמת מתאימים?" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_DESCRIPTION },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [
      // Bump ?v= whenever the icon changes: browsers cache favicons separately and ignore normal reloads.
      { rel: "icon", type: "image/png", href: "/favicon.png?v=2" },
      { rel: "apple-touch-icon", href: "/favicon.png?v=2" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      // Fetched early but applied by FONT_LOADER_SCRIPT, so it never blocks the first paint.
      { rel: "preload", as: "style", href: FONT_CSS },
      // No hero image preload here: it went out on every page (quiz, roles) at high priority.
      // React already emits one in the homepage head for the hero <img fetchPriority="high">.
    ],
  }),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CONSENT_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FONT_LOADER_SCRIPT }} />
        <noscript>
          <link rel="stylesheet" href={FONT_CSS} />
        </noscript>
      </head>
      <body className="min-h-dvh font-sans antialiased text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const [manualReduceMotion, setManualReduceMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setManualReduceMotion(readA11yPrefs().reduceMotion);
    function onPrefsChange(event: Event) {
      setManualReduceMotion((event as CustomEvent<A11yPrefs>).detail.reduceMotion);
    }
    window.addEventListener(A11Y_PREFS_EVENT, onPrefsChange);
    return () => window.removeEventListener(A11Y_PREFS_EVENT, onPrefsChange);
  }, []);

  // Start waking the API immediately. On the free Render plan a sleeping instance
  // takes ~50s, and without this the visitor's first call is the OTP request.
  useEffect(() => {
    warmApi();
  }, []);

  // Where this visitor came from (TikTok, Instagram, UTM tags), sent once after sign-in.
  useEffect(() => startAttribution(), []);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      trackError(event.message, "global");
    }
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
      trackError(msg, "unhandled_rejection");
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return (
    <MotionConfig reducedMotion={manualReduceMotion ? "always" : "user"}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RootLayoutInner />
          {mounted && (
            <Suspense fallback={null}>
              <Toaster richColors position="top-center" />
            </Suspense>
          )}
        </QueryClientProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}

const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/contact",
  "/role-insights",
  "/blog",
  "/attention-test",
  "/role-calculator",
  "/privacy",
  "/terms",
  "/accessibility",
  "/cancellation",
  "/gibush",
]);

function RootLayoutInner() {
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBareShell = pathname === "/post-signup";

  // Funnel ends outside the quiz (the quiz counts its own screens).
  useEffect(() => {
    if (pathname === "/") markFunnelStep("home");
    else if (pathname === "/ai-counselor") markFunnelStep("results");
    else if (pathname.startsWith("/checkout")) markFunnelStep("checkout");
  }, [pathname]);
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrapAuth();
      if (cancelled) return;
      setAuthed(!!getToken());
      setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeAuth(() => setAuthed(!!getToken()));
  }, []);

  useEffect(() => {
    if (!authReady) return;
    setAuthed(!!getToken());
  }, [pathname, authReady]);

  // After the page has loaded, so the next slideshow photos never compete with the first one.
  useEffect(() => {
    if (document.readyState === "complete") {
      preloadIdfBackdropImages();
      return;
    }
    window.addEventListener("load", preloadIdfBackdropImages, { once: true });
    return () => window.removeEventListener("load", preloadIdfBackdropImages);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const token = getToken();
    if (token) prefetchAuthedData(queryClient, token);
  }, [pathname, queryClient, authReady, authed]);

  async function logout() {
    await logoutRequest();
    queryClient.clear();
    setAuthed(false);
    navigate({ to: "/" });
  }

  // Marketing and legal pages never depend on the session; only gated pages wait for the refresh.
  // The quiz (bare shell) waits for it itself, so its first question is in the server HTML.
  if (
    !authReady &&
    !isBareShell &&
    !PUBLIC_PATHS.has(pathname) &&
    !/^\/(roles|blog)\//.test(pathname)
  ) {
    return (
      <>
        <main
          id={MAIN_CONTENT_ID}
          className="flex min-h-dvh items-center justify-center"
          aria-busy="true"
          aria-label={ARIA.main}
        >
          <span className="text-sm text-dust">טוען…</span>
        </main>
        <AccessibilityMenu />
      </>
    );
  }

  return (
    <>
      {!isBareShell && (
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          {ARIA.skipToMain}
        </a>
      )}
      {!isBareShell && <SiteHeader authed={authed} tokenPresent={authed} onLogout={logout} />}
      {/* No fade-in: main is not keyed per route, so it only ever hid the first paint. */}
      <main id={MAIN_CONTENT_ID} aria-label={ARIA.main} tabIndex={-1}>
        <Outlet />
      </main>
      <AccessibilityMenu />
      <CookieConsent />
      {!isBareShell && <SiteFooter authed={authed} />}
    </>
  );
}

/** Secondary links beside the free-tools menu. Utility pages live in the footer. */
const NAV_SECONDARY = [
  { to: "/blog", label: "מדריכים" },
  { to: "/about", label: "אודות" },
] as const;

/** The one primary action: guests start the questionnaire, signed-in users see their results. */
function primaryCta(authed: boolean) {
  return authed
    ? { to: "/ai-counselor", label: "התוצאות שלי" }
    : { to: "/post-signup", label: "התחילו את השאלון" };
}

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-1 rounded-md border border-primary/45 font-semibold text-primary transition hover:border-primary hover:bg-primary/10";

function SiteHeader({
  authed,
  tokenPresent,
  onLogout,
}: {
  authed: boolean;
  tokenPresent: boolean;
  onLogout: () => void;
}) {
  const { data: session } = useQuery(sessionQueryOptions(tokenPresent));

  useEffect(() => {
    if (session?.role) setStoredRole(session.role);
  }, [session?.role]);

  const isAdmin = session?.role === "admin" || (tokenPresent && isStoredAdmin());
  const cta = primaryCta(authed);

  const profileName =
    session?.preferredName?.trim() || (session?.email ? session.email.split("@")[0] : undefined);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      data-site-chrome
      aria-label={ARIA.siteHeader}
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled || mobileOpen
          ? "border-b border-iron/30 bg-background/95 backdrop-blur-sm shadow-[0_1px_8px_oklch(0_0_0/0.4)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <KachKivunLogo size="md" linked className="shrink-0 whitespace-nowrap" />

        {/* Desktop: grouped secondary links, then the single primary action */}
        <div className="hidden items-center gap-2 lg:flex">
          <nav className="flex items-center" aria-label={ARIA.navPrimary}>
            <NavToolsMenu authed={authed} />
            {NAV_SECONDARY.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <span className="mx-2 h-6 w-px bg-iron/40" aria-hidden />

          {authed ? (
            <ProfileMenu displayName={profileName} isAdmin={isAdmin} onLogout={onLogout} />
          ) : (
            <Link
              to="/post-signup"
              hash="login"
              className="px-3 py-2 text-sm font-semibold text-dust transition hover:text-foreground"
            >
              התחברו
            </Link>
          )}
          <Link to={cta.to} className={`${PRIMARY_BTN} h-9 px-3.5 text-sm`}>
            {cta.label}
          </Link>
        </div>

        {/* Mobile: just the menu button; the menu opens with the primary action as its first item. */}
        <div className="flex min-w-0 items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-dust transition hover:text-foreground"
            aria-label={mobileOpen ? ARIA.closeMenu : ARIA.openMenu}
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_NAV_ID}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown: primary on top, then the grouped secondary items */}
      {mobileOpen && (
        <div className="animate-fade-in max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-iron/20 bg-background/98 backdrop-blur-sm lg:hidden">
          <nav
            id={MOBILE_NAV_ID}
            className="mx-auto flex max-w-7xl flex-col px-4 pt-4 pb-5"
            aria-label={ARIA.navMobile}
          >
            <Link
              to={cta.to}
              className="flex min-h-12 items-center gap-3 border-b border-iron/15 px-2 py-2 text-base font-bold text-primary transition-colors hover:text-primary/80"
            >
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{cta.label}</span>
              <ChevronLeft className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            </Link>
            {!authed && (
              <p className="mt-2 px-2 text-xs text-dust">
                בסוף השאלון: 5 תפקידים שמתאימים לכם, 2 מהם בחינם
              </p>
            )}

            <p className="mt-5 px-2 pb-1 font-mono text-[11px] tracking-wide text-dust/70">
              {FREE_TOOLS_LABEL}
            </p>
            {FREE_TOOLS.map(({ to, label, desc, Icon, tone }) => (
              <MobileNavLink key={to} to={to}>
                <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block">{label}</span>
                  <span className="block text-xs font-normal text-dust">{desc}</span>
                </span>
              </MobileNavLink>
            ))}

            <div className="mt-3">
              {NAV_SECONDARY.map((item) => (
                <MobileNavLink key={item.to} to={item.to}>
                  {item.label}
                </MobileNavLink>
              ))}
            </div>

            {authed ? (
              <ProfileMenu
                variant="list"
                displayName={profileName}
                isAdmin={isAdmin}
                onLogout={onLogout}
                onNavigate={() => setMobileOpen(false)}
              />
            ) : (
              <p className="mt-4 px-2 text-sm text-dust">
                כבר נרשמתם?{" "}
                <Link
                  to="/post-signup"
                  hash="login"
                  className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4"
                >
                  התחברו
                </Link>
              </p>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function MobileNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-12 items-center gap-3 border-b border-iron/15 px-2 py-2 text-base font-semibold transition-colors"
      inactiveProps={{ className: "text-foreground/85" }}
      activeProps={{ className: "text-primary" }}
    >
      {children}
    </Link>
  );
}

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-6xl font-black tabular-nums text-primary">404</p>
      <h1 className="mt-4 text-xl font-bold text-foreground">העמוד לא נמצא</h1>
      <p className="mt-2 text-sm text-dust">הכתובת לא קיימת או שהעמוד הוסר.</p>
      <Link to="/" className="btn-primary mt-8 px-6 py-2.5">
        חזרה לדף הראשי
      </Link>
    </div>
  );
}

function NavLink({ to, exact, children }: { to: string; exact?: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={exact ? { exact: true } : undefined}
      className="relative flex h-14 items-center px-3 text-sm font-semibold whitespace-nowrap transition-colors"
      inactiveProps={{
        className: "text-dust hover:bg-foreground/5 hover:text-foreground",
      }}
      activeProps={{
        className: "text-foreground",
      }}
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-primary" />}
        </>
      )}
    </Link>
  );
}
