import { cn } from "../../lib/cn";

const variantStyles = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

export default function Badge({ variant = "default", className, children, ...rest }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
