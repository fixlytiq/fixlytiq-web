"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useOrdersStore } from "@/stores/orders-store";
import { useOrderUiStore } from "@/stores/order-ui-store";
import type { OrderStatus } from "@/types/orders";
import type { Order } from "@/types/orders";

const STATUS_TABS: readonly { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "partially_paid", label: "Partial" },
  { id: "paid", label: "Paid" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" },
];

function statusPill(status: OrderStatus): {
  cls: string;
  label: string;
} {
  switch (status) {
    case "open":
      return { cls: "bg-emerald-500/15 text-emerald-200/90", label: "Open" };
    case "pending":
      return { cls: "bg-sky-500/15 text-sky-200/90", label: "Pending" };
    case "partially_paid":
      return { cls: "bg-amber-500/15 text-amber-200/90", label: "Partial" };
    case "paid":
      return { cls: "bg-emerald-500/15 text-emerald-300/90", label: "Paid" };
    case "fulfilled":
      return { cls: "bg-violet-500/15 text-violet-200/90", label: "Fulfilled" };
    case "cancelled":
      return { cls: "bg-rose-500/15 text-rose-200/90", label: "Cancelled" };
    case "refunded":
      return { cls: "bg-cyan-500/15 text-cyan-200/90", label: "Refunded" };
  }
}

function matchesOrderSearch(order: Order, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  if (order.id.toLowerCase().includes(s)) return true;
  if ((order.label ?? "").toLowerCase().includes(s)) return true;
  if ((order.note ?? "").toLowerCase().includes(s)) return true;
  if (order.linkedRepairTicketId?.toLowerCase().includes(s)) return true;
  if (order.customer?.name.toLowerCase().includes(s)) return true;
  if (order.customer?.phone?.toLowerCase().includes(s)) return true;
  if (order.customer?.email?.toLowerCase().includes(s)) return true;
  if (order.customer?.customerId?.toLowerCase().includes(s)) return true;
  return false;
}

export function OrdersWorkspace() {
  const orders = useOrdersStore((s) => s.orders);
  const openOrderDetail = useOrderUiStore((s) => s.openOrderDetail);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const filtered = useMemo(() => {
    return orders
      .filter((o) => (statusFilter === "all" ? true : o.status === statusFilter))
      .filter((o) => matchesOrderSearch(o, search))
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [orders, search, statusFilter]);

  return (
    <div className="space-y-4">
      <PageHeader
        variant="device"
        title="Orders"
        description="Open orders promoted from POS register."
      />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order id, label, customer, or repair…"
            className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((t) => {
            const active = statusFilter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusFilter(t.id)}
                className={`touch-pad shrink-0 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                  active
                    ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-200 ring-1 ring-inset ring-emerald-500/30"
                    : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No orders match your filters.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {filtered.map((o) => {
              const pill = statusPill(o.status);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => openOrderDetail(o.id)}
                    className="w-full px-3 py-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm text-zinc-200">
                          {o.label ?? o.id.slice(0, 8)}… · {o.id.slice(0, 10)}…
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {o.customer?.name ?? "—"}
                          {o.linkedRepairTicketId
                            ? ` · Repair ${o.linkedRepairTicketId}`
                            : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-600">
                          {new Date(o.updatedAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`inline-flex rounded-md px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${pill.cls}`}
                        >
                          {pill.label}
                        </div>
                        <p className="mt-2 font-mono text-sm font-semibold text-zinc-100">
                          ${o.total.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {o.lines.slice(0, 2).map((l) => (
                        <span
                          key={l.id}
                          className="rounded-md border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-300"
                        >
                          {l.name.length > 18
                            ? `${l.name.slice(0, 18)}…`
                            : l.name}
                          {" · "}
                          {l.quantity}x
                        </span>
                      ))}
                      {o.lines.length > 2 ? (
                        <span className="text-xs text-zinc-500">
                          +{o.lines.length - 2} more
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

