import type { Sale } from "@/types/pos";

/** Whether this sale is tied to a repair ticket (snapshot or legacy line shape). */
export function saleIncludesRepairCheckout(sale: Sale): boolean {
  if ((sale.repairCheckouts?.length ?? 0) > 0) return true;
  return sale.lines.some(
    (l) =>
      l.lineKind === "repair" ||
      (l.repairTicketId != null && l.repairTicketId !== ""),
  );
}
