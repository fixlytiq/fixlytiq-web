import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Dense single-line header for device / kiosk screens */
  variant?: "default" | "device";
};

export function PageHeader({
  title,
  description,
  actions,
  className = "",
  variant = "default",
}: PageHeaderProps) {
  if (variant === "device") {
    return (
      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3 ${className}`}
      >
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100 md:text-xl">
          {title}
        </h2>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-4 border-b border-zinc-800/80 pb-6 md:flex-row md:items-end md:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-zinc-400 md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
