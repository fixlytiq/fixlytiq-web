import type { ReactNode } from "react";

export type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: { text: string; positive?: boolean };
  icon?: ReactNode;
  className?: string;
  /** Larger type + padding for register / overview tiles */
  size?: "default" | "device";
};

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  className = "",
  size = "default",
}: StatCardProps) {
  const isDevice = size === "device";
  return (
    <div
      className={`rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-sm shadow-black/20 backdrop-blur-sm ${
        isDevice ? "p-4 md:p-5" : "p-4 shadow-sm md:p-5"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`font-medium uppercase tracking-wider text-zinc-500 ${
              isDevice ? "text-[11px] md:text-xs" : "text-xs"
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-1 font-mono font-semibold tracking-tight text-zinc-50 ${
              isDevice
                ? "text-3xl leading-none md:text-4xl"
                : "text-2xl md:text-3xl"
            }`}
          >
            {value}
          </p>
          {hint ? (
            <p
              className={`mt-1 text-zinc-500 ${
                isDevice ? "text-xs md:text-sm" : "text-sm"
              }`}
            >
              {hint}
            </p>
          ) : null}
          {trend ? (
            <p
              className={`mt-2 font-medium ${
                isDevice ? "text-xs" : "text-xs"
              } ${
                trend.positive === false
                  ? "text-rose-400"
                  : "text-emerald-400/90"
              }`}
            >
              {trend.text}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/80 text-emerald-400 ${
              isDevice ? "h-12 w-12 text-xl md:h-14 md:w-14 md:text-2xl" : "h-11 w-11"
            }`}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
