/**
 * Repair ↔ inventory parts usage — local-first; backend will align later.
 *
 * - `RepairPartUsage` rows are persisted on `RepairTicket.partsUsage`.
 * - Stock is decremented via `inventory-store.recordStockRemove` when parts attach
 *   (see `repairs-store` + `REPAIR_PART_USAGE_STOCK_REASON` in `repair-parts-inventory`).
 */

/** One inventory line consumed on a repair ticket (quantities + pricing snapshot). */
export type RepairPartUsage = {
  id: string;
  ticketId: string;
  inventoryItemId: string;
  sku: string;
  name: string;
  /** Sale / charge price per unit at attach time (USD) */
  unitPrice: number;
  /** Cost per unit snapshot (USD) */
  unitCost: number;
  quantity: number;
  attachedAt: string;
};

/** Labor portion of the repair quote (separate from parts subtotal). */
export type RepairLaborEstimate = {
  amount: number;
  /** Optional memo shown on the ticket */
  note?: string;
};

/** Derived pricing breakdown for UI / reporting. */
export type RepairPricingSummary = {
  laborEstimate: number;
  partsSubtotal: number;
  estimatedTotal: number;
};
