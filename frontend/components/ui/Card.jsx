import { cn } from "../../lib/cn";

export default function Card({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
