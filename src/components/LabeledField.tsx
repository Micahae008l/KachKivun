import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  /** Use fieldset/legend when the control is a group of buttons or chips. */
  asGroup?: boolean;
  className?: string;
  labelClassName?: string;
};

export function LabeledField({
  label,
  children,
  asGroup = false,
  className = "",
  labelClassName = "text-sm font-medium text-dust",
}: Props) {
  const id = useId();

  if (asGroup) {
    return (
      <fieldset className={`space-y-1.5 border-0 p-0 m-0 text-right ${className}`}>
        <legend className={`${labelClassName} mb-1.5 w-full`}>{label}</legend>
        {children}
      </fieldset>
    );
  }

  const childProps = isValidElement(children)
    ? (children.props as { id?: string })
    : null;
  const control =
    isValidElement(children) && childProps?.id == null
      ? cloneElement(children as ReactElement<{ id?: string }>, { id })
      : children;

  return (
    <div className={`space-y-1.5 text-right ${className}`}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      {control}
    </div>
  );
}
