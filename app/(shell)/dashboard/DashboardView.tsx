"use client";

import Link from "next/link";
import { useMemo } from "react";
import { StatCard } from "@/components/ui/StatCard";
import {
  aggregateSales,
  endOfLocalDay,
  salesInRange,
  startOfLocalDay,
} from "@/lib/dashboard-stats";
import { formatEmployeeRole } from "@/lib/format-role";
import { usePosStore } from "@/stores/pos-store";
import { useSessionStore } from "@/stores/session-store";

export function DashboardView() {
  const recentSales = usePosStore((s) => s.recentSales);
  const station = usePosStore((s) => s.station);
  const employee = useSessionStore((s) => s.employee);

  const now = useMemo(() => new Date(), []);

  const todaySalesList = useMemo(
    () =>
      salesInRange(recentSales, startOfLocalDay(now), endOfLocalDay(now)),
    [recentSales, now],
  );

  const todayStats = useMemo(
    () => aggregateSales(todaySalesList),
    [todaySalesList],
  );

  const taxToday = useMemo(
    () => todaySalesList.reduce((s, x) => s + x.tax, 0),
    [todaySalesList],
  );

  const allTime = useMemo(
    () => aggregateSales(recentSales),
    [recentSales],
  );

  const latest = recentSales.slice(0, 6);

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
        <span className="text-zinc-500">Station </span>
        <span className="font-medium text-zinc-200">
          {station.label ?? station.name}
        </span>
        {employee ? (
          <>
            <span className="mx-2 text-zinc-600">·</span>
            <span className="text-zinc-500">Signed in </span>
            <span className="font-medium text-zinc-200">{employee.name}</span>
            <span className="text-zinc-600"> ({formatEmployeeRole(employee.role)})</span>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-4">
        <StatCard
          size="device"
          label="Sales today"
          value={`$${todayStats.revenue.toFixed(2)}`}
          hint={`${todayStats.count} transactions`}
          icon={<span>$</span>}
        />
        <StatCard
          size="device"
          label="All-time (local)"
          value={`$${allTime.revenue.toFixed(2)}`}
          hint={`${allTime.count} sales stored`}
          icon={<span>Σ</span>}
        />
        <StatCard
          size="device"
          label="Tax today"
          value={`$${taxToday.toFixed(2)}`}
          hint="From persisted tickets"
          icon={<span>%</span>}
        />
        <StatCard
          size="device"
          label="Avg. ticket today"
          value={
            todayStats.count > 0
              ? `$${(todayStats.revenue / todayStats.count).toFixed(2)}`
              : "—"
          }
          hint={todayStats.count === 0 ? "No sales yet today" : undefined}
          icon={<span>◇</span>}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-5 lg:gap-5">
        <section className="flex min-h-[220px] flex-col rounded-2xl border border-zinc-800 bg-zinc-900/35 lg:col-span-3">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-200">
              Recent sales (local)
            </h3>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {latest.length === 0 ? (
              <p className="text-sm text-zinc-500">No sales in memory yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {latest.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-b border-zinc-800/80 py-2 font-mono text-xs text-zinc-400 last:border-0"
                  >
                    <span className="truncate text-zinc-500">
                      {new Date(s.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="shrink-0 text-zinc-200">
                      ${s.total.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3 lg:col-span-2">
          <Link
            href="/pos"
            className="touch-pad flex flex-1 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white active:bg-emerald-500"
          >
            Register
          </Link>
          <Link
            href="/repairs"
            className="touch-pad flex flex-1 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900/60 text-lg font-semibold text-zinc-100 active:bg-zinc-800"
          >
            New repair
          </Link>
          <Link
            href="/inventory"
            className="touch-pad flex flex-1 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900/60 text-lg font-semibold text-zinc-100 active:bg-zinc-800"
          >
            Receive stock
          </Link>
        </section>
      </div>
    </div>
  );
}
