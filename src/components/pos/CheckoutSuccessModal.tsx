"use client";

import { useEffect } from "react";
import { paymentMethodLabel } from "@/lib/payment-totals";
import type { Sale } from "@/types/pos";

type CheckoutSuccessModalProps = {
  open: boolean;
  sale: Sale | null;
  onDismiss: () => void;
  onViewTransaction?: () => void;
};

export function CheckoutSuccessModal({
  open,
  sale,
  onDismiss,
  onViewTransaction,
}: CheckoutSuccessModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open || !sale) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-success-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-zinc-900 p-6 shadow-2xl shadow-emerald-950/40">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-400">
            ✓
          </div>
          <h2
            id="checkout-success-title"
            className="mt-4 text-xl font-semibold text-zinc-50"
          >
            Payment recorded
          </h2>
          <p className="mt-1 font-mono text-sm text-zinc-500">
            {sale.id.slice(0, 8)}… ·{" "}
            {new Date(sale.createdAt).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
          <p className="mt-6 font-mono text-4xl font-bold tabular-nums text-emerald-400">
            ${sale.totalCollected.toFixed(2)}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Total due ${sale.totalDue.toFixed(2)} · Subtotal $
            {sale.subtotal.toFixed(2)} · Tax ${sale.tax.toFixed(2)}
          </p>
          {sale.changeDue > 0 ? (
            <p className="mt-2 font-mono text-lg text-sky-300">
              Change ${sale.changeDue.toFixed(2)}
            </p>
          ) : null}
          {sale.payments.length > 0 ? (
            <ul className="mt-4 space-y-1 text-left text-sm text-zinc-400">
              {sale.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between gap-2 font-mono text-xs"
                >
                  <span>{paymentMethodLabel(p.method)}</span>
                  <span>${p.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : sale.paymentMethod?.trim() ? (
            <p className="mt-4 text-sm text-zinc-500">{sale.paymentMethod}</p>
          ) : null}
        </div>
        <div className="mt-8 grid gap-3">
          {onViewTransaction ? (
            <button
              type="button"
              onClick={() => {
                onViewTransaction();
                onDismiss();
              }}
              className="touch-pad w-full rounded-xl border border-zinc-600 bg-zinc-800/80 text-lg font-semibold text-zinc-100 active:bg-zinc-800"
            >
              View transaction
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="touch-pad w-full rounded-xl bg-emerald-600 text-lg font-semibold text-white active:bg-emerald-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
