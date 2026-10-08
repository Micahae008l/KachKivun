import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
import appCss from "../styles.css?url";
import { queryClient } from "@/lib/query-client";
import { KachKivunLogo } from "@/components/KachKivunLogo";
import { SITE_DESCRIPTION, SITE_NAME_HE } from "@/lib/brand";
import { MATCH_TOOL_SHORT } from "@/lib/voice";
import { ARIA, MAIN_CONTENT_ID, MOBILE_NAV_ID } from "@/lib/a11y";
import {
  A11Y_BOOT_SCRIPT,
  A11Y_PREFS_EVENT,
  readA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y-prefs";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
import { IDF_BACKDROP_IMAGE_URLS, preloadIdfBackdropImages } from "@/lib/idf-images";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trackError } from "@/lib/analytics";

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
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_DESCRIPTION },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
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

  if (!authReady) {
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
      {!isBareShell && (
        <footer className="border-t border-iron/30 mt-20" aria-label={ARIA.footer}>
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 text-xs text-dust/60 sm:flex-row sm:justify-between sm:px-6 sm:py-8">
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link to="/" className="transition hover:text-foreground">
                ראשי
              </Link>
              <Link to="/about" className="transition hover:text-foreground">
                אודות
              </Link>
              <Link to="/contact" className="transition hover:text-foreground">
                צור קשר
              </Link>
              <Link to="/role-insights" className="transition hover:text-foreground">
                תובנות
              </Link>
              <Link to="/privacy" className="transition hover:text-foreground">
                פרטיות
              </Link>
              <Link to="/terms" className="transition hover:text-foreground">
                תנאי שימוש
              </Link>
              <Link
                to="/cancellation"
                className="font-semibold text-primary/80 transition hover:text-primary"
              >
                ביטול עסקה והחזרים
              </Link>
              <Link to="/accessibility" className="transition hover:text-foreground">
                נגישות
              </Link>
            </div>
            <span className="text-dust/50">
              &copy; {new Date().getFullYear()} {SITE_NAME_HE}
            </span>
          </div>
        </footer>
      )}
    </>
  );
}

/** Main tools in header — profile lives in ProfileMenu */
type NavItem = { to: string; label: string; exact?: boolean };

const NAV_AUTHED: readonly NavItem[] = [
  { to: "/ai-counselor", label: MATCH_TOOL_SHORT },
  { to: "/role-insights", label: "תובנות תפקידים" },
];

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
  const token = tokenPresent ? getToken() : null;

  useEffect(() => {
    if (session?.role) setStoredRole(session.role);
  }, [session?.role]);

  const isAdmin = session?.role === "admin" || (tokenPresent && isStoredAdmin());

  const NAV_ITEMS = useMemo(() => (authed ? [...NAV_AUTHED] : []), [authed]);

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
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <KachKivunLogo size="md" linked />

        {/* Desktop: nav + single action */}
        <div className="hidden sm:flex items-center gap-3">
          {NAV_ITEMS.length > 0 ? (
            <nav className="flex items-center" aria-label={ARIA.navPrimary}>
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  exact={"exact" in item ? item.exact : undefined}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : null}

          {authed ? (
            <ProfileMenu displayName={profileName} isAdmin={isAdmin} onLogout={onLogout} />
          ) : (
            <Link
              to="/post-signup"
              hash="login"
              className="btn-primary shrink-0 px-4 py-1.5 text-sm"
            >
              התחברו
            </Link>
          )}
        </div>

        {/* Mobile: login (guests) or menu (signed in) */}
        <div className="flex items-center gap-2 sm:hidden">
          {authed ? (
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center text-dust transition hover:text-foreground"
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
          ) : (
            <Link to="/post-signup" hash="login" className="btn-primary px-3 py-1.5 text-xs">
              התחברו
            </Link>
          )}
        </div>
      </div>

      {/* Mobile dropdown (signed-in only) */}
      <AnimatePresence>
        {authed && mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-iron/20 bg-background/98 backdrop-blur-sm sm:hidden"
          >
            <nav
              id={MOBILE_NAV_ID}
              className="mx-auto flex max-w-7xl flex-col px-4 py-3"
              aria-label={ARIA.navMobile}
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={"exact" in item && item.exact ? { exact: true } : undefined}
                  className="px-2 py-2.5 text-sm font-medium transition-colors"
                  inactiveProps={{ className: "text-dust" }}
                  activeProps={{ className: "text-primary" }}
                >
                  {item.label}
                </Link>
              ))}
              {authed ? (
                <ProfileMenu
                  variant="list"
                  displayName={profileName}
                  isAdmin={isAdmin}
                  onLogout={onLogout}
                  onNavigate={() => setMobileOpen(false)}
                />
              ) : (
                <Link
                  to="/post-signup"
                  hash="login"
                  className="px-2 py-2.5 text-sm font-semibold text-primary"
                >
                  התחברו
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
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
      className="relative px-3 py-1.5 text-sm font-medium transition-colors"
      inactiveProps={{
        className: "text-dust hover:text-foreground",
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
              className="absolute inset-x-2 -bottom-[1px] h-[2px] bg-primary"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </>
      )}
    </Link>
  );
}
