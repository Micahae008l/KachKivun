import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
import { Toaster } from "sonner";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Menu, X } from "lucide-react";
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
import { IDF_BACKDROP_IMAGE_URLS, preloadIdfBackdropImages } from "@/lib/idf-images";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trackError } from "@/lib/analytics";
import { startAttribution } from "@/lib/attribution";

const SITE_URL = "https://kachkivun.com";

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
      {
        name: "keywords",
        content:
          "צבא, צה״ל, גיוס, דפ״ר, מא״ה, יום המאה, פרופיל רפואי, התאמת תפקיד, שירות צבאי, הכנה לשירות",
      },
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
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      ...IDF_BACKDROP_IMAGE_URLS.slice(0, 2).map((href) => ({
        rel: "preload" as const,
        href,
        as: "image" as const,
      })),
    ],
  }),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
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

  useEffect(() => {
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
          <Toaster richColors position="top-center" />
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
]);

function RootLayoutInner() {
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBareShell = pathname === "/post-signup";
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

  useEffect(() => {
    preloadIdfBackdropImages();
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
  if (!authReady && !PUBLIC_PATHS.has(pathname) && !/^\/(roles|blog)\//.test(pathname)) {
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
      <main id={MAIN_CONTENT_ID} className="animate-fade-in" aria-label={ARIA.main} tabIndex={-1}>
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
    ? { to: "/ai-counselor", label: "התוצאות שלי", short: "התוצאות שלי" }
    : { to: "/post-signup", label: "התחילו את השאלון", short: "לשאלון" };
}

const PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-md bg-primary font-bold text-primary-foreground shadow-[0_0_0_1px_oklch(1_0_0/0.06)] transition hover:brightness-110 active:brightness-95";

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
    <motion.header
      aria-label={ARIA.siteHeader}
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
          <Link to={cta.to} className={`${PRIMARY_BTN} h-10 px-5 text-sm`}>
            {cta.label}
          </Link>
        </div>

        {/* Mobile: the primary action stays visible next to the menu button */}
        <div className="flex min-w-0 items-center gap-1 lg:hidden">
          {/* Hidden while the menu is open: the menu repeats it as its first item. */}
          {!mobileOpen && (
            <Link to={cta.to} className={`${PRIMARY_BTN} h-10 px-4 text-sm whitespace-nowrap`}>
              <span className="min-[360px]:hidden">{cta.short}</span>
              <span className="hidden min-[360px]:inline">{cta.label}</span>
            </Link>
          )}
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
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-iron/20 bg-background/98 backdrop-blur-sm lg:hidden"
          >
            <nav
              id={MOBILE_NAV_ID}
              className="mx-auto flex max-w-7xl flex-col px-4 pt-4 pb-5"
              aria-label={ARIA.navMobile}
            >
              <Link to={cta.to} className={`${PRIMARY_BTN} min-h-12 text-base`}>
                {cta.label}
              </Link>
              {!authed && (
                <p className="mt-2 text-center text-xs text-dust">
                  בסוף השאלון: 5 תפקידים שמתאימים לכם, 2 מהם בחינם
                </p>
              )}

              <p className="mt-5 px-2 pb-1 font-mono text-[11px] tracking-wide text-dust/70">
                {FREE_TOOLS_LABEL}
              </p>
              {FREE_TOOLS.map(({ to, label, desc, Icon }) => (
                <MobileNavLink key={to} to={to}>
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
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
          {isActive && (
            <motion.span
              layoutId="nav-indicator"
              className="absolute inset-x-3 bottom-0 h-[2px] bg-primary"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </>
      )}
    </Link>
  );
}
