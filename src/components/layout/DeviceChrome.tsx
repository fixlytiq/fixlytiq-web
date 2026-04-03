"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SHELL_HEADER_HEIGHT } from "@/components/layout/shell-layout";
import { formatEmployeeRole } from "@/lib/format-role";
import { usePosStore } from "@/stores/pos-store";
import { useSessionStore } from "@/stores/session-store";

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/pos": "Register",
  "/repairs": "Repairs",
  "/inventory": "Stock",
  "/shifts": "Shifts",
  "/employees": "Team",
  "/settings": "Settings",
};

export function DeviceChrome() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Fixlytiq";
  const [time, setTime] = useState<string>("");
  const employee = useSessionStore((s) => s.employee);
  const station = usePosStore((s) => s.station);

  useEffect(() => {
    const tick = () => {
      setTime(
        new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(new Date()),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header
      className={`relative z-20 flex shrink-0 items-center gap-3 border-b border-zinc-800/90 bg-zinc-950 px-3 pl-2 md:px-4 ${SHELL_HEADER_HEIGHT}`}
    >
      <div className="min-w-0 flex-1 md:flex md:items-baseline md:gap-3">
        <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-100 md:text-xl">
          {title}
        </h1>
        <span className="hidden text-xs text-zinc-600 md:inline">Terminal</span>
        {employee ? (
          <span className="hidden truncate text-xs text-zinc-400 lg:inline">
            {employee.name} · {formatEmployeeRole(employee.role)}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 font-mono text-xs tabular-nums text-zinc-300 md:text-sm"
          suppressHydrationWarning
        >
          {time || "—"}
        </span>
        <span
          className="hidden rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400/90 sm:inline"
          title="Local-first — sync when agent connects"
        >
          Local
        </span>
        <span
          className="max-w-[10rem] truncate rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-400 md:max-w-[14rem] md:text-sm"
          title={station.label ?? station.name}
        >
          {station.label ?? station.name}
        </span>
      </div>
    </header>
  );
}
