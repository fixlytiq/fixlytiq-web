"use client";

import { useMemo, useState } from "react";
import { usePosStore } from "@/stores/pos-store";
import { useOrdersStore } from "@/stores/orders-store";

export function OpenOrdersPanel() {
  const resumeOpenOrder = usePosStore((s) => s.resumeOpenOrder);
  const cancelOpenOrder = usePosStore((s) => s.cancelOpenOrder);
  const cart = usePosStore((s) => s.cart);
  const paymentSession = usePosStore((s) => s.paymentSession);
  const storeId = usePosStore((s) => s.station.storeId);

  const [msg, setMsg] = useState<string | null>(null);

  // Keep the store selector referentially stable to avoid Next/Turbopack
  // "getSnapshot should be cached" warnings.
  const orders = useOrdersStore((s) => s.orders);
  const openOrders = useMemo(() => {
    return orders.filter((o) => o.storeId === storeId && o.status === "open");
  }, [orders, storeId]);

  if (openOrders.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-950/15 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-200/90">
          Open orders ({openOrders.length})
        </h3>
      </div>
      {msg ? (
        <p className="mt-2 text-sm text-rose-400" role="alert">
          {msg}
        </p>
      ) : null}
      <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
        {openOrders.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-amber-200/80">
                {o.label || o.id.slice(0, 8)}…
              </p>
              <p className="font-mono text-sm font-semibold text-zinc-100">
                ${o.total.toFixed(2)}
              </p>
              <p className="text-[11px] text-zinc-500">
                {new Date(o.updatedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                {o.linkedRepairTicketId ? " · Repair" : ""}
                {o.customer?.name ? ` · ${o.customer.name}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMsg(null);
                  if (paymentSession) {
                    setMsg("Finish or cancel checkout first.");
                    return;
                  }
                  if (cart.length > 0) {
                    setMsg("Clear or check out the current cart before resuming.");
                    return;
                  }
                  const r = resumeOpenOrder(o.id);
                  if (!r.ok) setMsg(r.error);
                }}
                className="touch-pad rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => cancelOpenOrder(o.id)}
                className="touch-pad rounded-lg border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-400"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
