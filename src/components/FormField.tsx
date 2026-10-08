import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, error, children, className = "" }: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  const childProps = isValidElement(children)
    ? (children.props as { id?: string; className?: string })
    : null;
  const control =
    isValidElement(children) && childProps?.id == null
      ? cloneElement(
          children as ReactElement<{
            id?: string;
            className?: string;
            "aria-invalid"?: boolean;
            "aria-describedby"?: string;
          }>,
          {
            id,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": error ? errorId : undefined,
            className: [childProps?.className, error ? "input-field--invalid" : ""]
              .filter(Boolean)
              .join(" "),
          },
        )
      : children;

  return (
    <div className={`space-y-2 text-right ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        <span className="mb-2 block">{label}</span>
        {control}
      </label>
      {error ? (
        <p id={errorId} role="alert" className="flex items-center justify-end gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export function FieldError({ message, className = "" }: { message: string; className?: string }) {
  return (
    <p role="alert" className={`flex items-center justify-end gap-1.5 text-sm text-destructive ${className}`}>
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
