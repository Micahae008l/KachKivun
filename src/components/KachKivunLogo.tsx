import { Link } from "@tanstack/react-router";
import { SITE_NAME_HE } from "@/lib/brand";

type Size = "sm" | "md" | "lg";

const markClass: Record<Size, string> = {
  sm: "h-5 w-5 sm:h-6 sm:w-6",
  md: "h-6 w-6 sm:h-7 sm:w-7",
  lg: "h-9 w-9 sm:h-11 sm:w-11",
};

/** Brand mark: three chevrons climbing upward (same artwork as the favicon). */
export function ChevronMark({ className = "" }: { className?: string }) {
  const chevron = "M100 0 L170 66 L140 66 L100 28 L60 66 L30 66 Z";
  return (
    <svg viewBox="0 20 200 186" className={className} aria-hidden="true" focusable="false">
      <path d={chevron} fill="#c9de9f" transform="translate(0 30)" />
      <path d={chevron} fill="var(--primary)" opacity="0.85" transform="translate(0 80)" />
      <path d={chevron} fill="#6f8a45" opacity="0.55" transform="translate(0 130)" />
    </svg>
  );
}

const textClass: Record<Size, string> = {
  sm: "text-lg font-black tracking-tight sm:text-xl",
  md: "text-xl font-black tracking-tight sm:text-2xl",
  lg: "text-3xl font-black tracking-tight sm:text-4xl",
};

type Props = {
  size?: Size;
  className?: string;
  /** Wrap in link to home */
  linked?: boolean;
  /** Destination when `linked` (default `/`) */
  linkTo?: string;
};

export function KachKivunLogo({ size = "md", className = "", linked = false, linkTo = "/" }: Props) {
  const inner = (
    <span className={`inline-flex items-center gap-2 text-primary ${textClass[size]} ${className}`}>
      <ChevronMark className={markClass[size]} />
      {SITE_NAME_HE}
    </span>
  );

  if (linked) {
    return (
      <Link
        to={linkTo}
        className="rounded-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={linkTo === "/dashboard" ? `${SITE_NAME_HE}, דשבורד` : `${SITE_NAME_HE}, דף הבית`}
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
