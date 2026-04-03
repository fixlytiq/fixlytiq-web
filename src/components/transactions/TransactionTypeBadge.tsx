"use client";

import { transactionKind, type TransactionKind } from "@/lib/transactions-query";
import type { Sale } from "@/types/pos";

export function transactionLabel(kind: TransactionKind): string {
  switch (kind) {
    case "repair_payment":
      return "Repair payment";
    case "product_sale":
    default:
      return "Product sale";
  }
}

export function TransactionTypeBadge({ sale }: { sale: Sale }) {
  const kind = transactionKind(sale);
  const label = transactionLabel(kind);
  const cls =
    kind === "repair_payment"
      ? "bg-amber-500/15 text-amber-200"
      : "bg-zinc-800/80 text-zinc-300";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

