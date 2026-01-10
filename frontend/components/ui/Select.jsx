import { cn } from "../../lib/cn";

const baseSelect =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 disabled:bg-slate-50 disabled:text-slate-700";

export default function Select({ label, hint, error, className, children, ...rest }) {
  const selectClasses = cn(
    baseSelect,
    error ? "border-red-300 focus-visible:ring-red-200" : null,
    className
  );

  if (label) {
    return (
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        <span>{label}</span>
        <select className={selectClasses} {...rest}>
          {children}
        </select>
        {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </label>
    );
  }

  return (
    <div className="grid gap-1">
      <select className={selectClasses} {...rest}>
        {children}
      </select>
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
