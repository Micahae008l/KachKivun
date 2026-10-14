import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { KachKivunLogo } from "@/components/KachKivunLogo";
import { FREE_TOOLS, FREE_TOOLS_LABEL } from "@/components/NavToolsMenu";
import { SITE_NAME_HE } from "@/lib/brand";
import { ARIA } from "@/lib/a11y";

const LINK = "inline-flex min-h-10 items-center transition hover:text-foreground sm:min-h-8";

function FooterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-2 text-xs font-bold text-foreground/90">{title}</h2>
      <ul className="flex flex-col text-sm text-dust">{children}</ul>
    </nav>
  );
}

export function SiteFooter({ authed }: { authed: boolean }) {
  return (
    <footer className="mt-20 border-t border-iron/30" aria-label={ARIA.footer}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <KachKivunLogo size="md" linked />
            <p className="mt-3 max-w-xs text-sm text-dust">
              {authed
                ? "ההתאמות שלכם מחכות בעמוד התוצאות."
                : "שאלון אישי אחד, 5 תפקידים בצה״ל שמתאימים לכם. מקומות 5 ו־4 בחינם."}
            </p>
            <Link
              to={authed ? "/ai-counselor" : "/post-signup"}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
            >
              {authed ? "התוצאות שלי" : "התחילו את השאלון"}
            </Link>
          </div>

          <FooterGroup title="המוצר">
            <li>
              <Link to="/" className={LINK}>
                דף הבית
              </Link>
            </li>
            {authed ? (
              <>
                <li>
                  <Link to="/ai-counselor" className={LINK}>
                    התוצאות שלי
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className={LINK}>
                    דשבורד
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/post-signup" className={LINK}>
                    השאלון האישי
                  </Link>
                </li>
                <li>
                  <Link to="/post-signup" hash="login" className={LINK}>
                    התחברות
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link to="/about" className={LINK}>
                אודות
              </Link>
            </li>
          </FooterGroup>

          <FooterGroup title={FREE_TOOLS_LABEL}>
            {FREE_TOOLS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className={LINK}>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/blog" className={LINK}>
                מדריכים לגיוס
              </Link>
            </li>
          </FooterGroup>

          <FooterGroup title="מידע ומדיניות">
            <li>
              <Link to="/contact" className={LINK}>
                צור קשר
              </Link>
            </li>
            <li>
              <Link to="/cancellation" className={`${LINK} font-semibold text-foreground/80`}>
                ביטול עסקה והחזרים
              </Link>
            </li>
            <li>
              <Link to="/privacy" className={LINK}>
                פרטיות
              </Link>
            </li>
            <li>
              <Link to="/terms" className={LINK}>
                תנאי שימוש
              </Link>
            </li>
            <li>
              <Link to="/accessibility" className={LINK}>
                נגישות
              </Link>
            </li>
            <li>
              <Link to="/about" hash="photo-credits" className={LINK}>
                קרדיט צילומים
              </Link>
            </li>
          </FooterGroup>
        </div>

        <p className="mt-10 border-t border-iron/20 pt-6 text-xs text-dust/60">
          &copy; {new Date().getFullYear()} {SITE_NAME_HE}
        </p>
      </div>
    </footer>
  );
}
