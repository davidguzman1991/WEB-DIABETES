import { cn } from "../../lib/cn";

export default function EmptyState({
  title,
  description,
  action,
  className,
  ...rest
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-center",
        className
      )}
      {...rest}
    >
      {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
      {description && (
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
