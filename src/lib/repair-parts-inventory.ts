/**
 * Copy + constants for repair ↔ inventory stock adjustments.
 * All repair part attach/remove/qty changes use the same `reason` so the
 * adjustment log is easy to filter; `note` carries ticket id, SKU, and name.
 */

export const REPAIR_PART_USAGE_STOCK_REASON = "Repair part usage" as const;

export type RepairPartStockAction =
  | "attach"
  | "remove_from_ticket"
  | "increase_qty"
  | "decrease_qty";

/**
 * Human-readable note on `StockAdjustment` rows (shown in inventory history).
 */
export function repairPartUsageAdjustmentNote(input: {
  ticketId: string;
  sku: string;
  name: string;
  action: RepairPartStockAction;
  /** Units removed from inventory (attach / increase) or returned (remove / decrease). */
  quantity: number;
}): string {
  const { ticketId, sku, name, action, quantity } = input;
  const head = `Ticket ${ticketId} · ${sku} · ${name}`;
  switch (action) {
    case "attach":
      return `${head} — attached, consumed ×${quantity}`;
    case "remove_from_ticket":
      return `${head} — removed from ticket, returned ×${quantity}`;
    case "increase_qty":
      return `${head} — quantity increased, additional consumption ×${quantity}`;
    case "decrease_qty":
      return `${head} — quantity decreased, returned ×${quantity}`;
  }
}
