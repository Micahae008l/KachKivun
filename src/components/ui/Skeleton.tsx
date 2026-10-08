import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", ...props }: Props) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-iron/30 ${className}`}
      aria-hidden
      {...props}
    />
  );
}

type LoadingShellProps = {
  label: string;
  children: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
};

/** Wraps skeleton layouts with accessible busy state. */
export function SkeletonShell({ label, children, className = "", dir }: LoadingShellProps) {
  return (
    <div className={className} dir={dir} role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
