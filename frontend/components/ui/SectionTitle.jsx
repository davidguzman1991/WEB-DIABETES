import { cn } from "../../lib/cn";

export default function SectionTitle({ title, subtitle, rightSlot, className }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        {title && (
          <div className="text-sm uppercase tracking-wide text-slate-500">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-base font-semibold text-slate-900">{subtitle}</div>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
