/**
 * Frozen repair context stored on completed sales (POS) and repair payment ledger.
 * Local-first — survives ticket edits after checkout.
 */

export type RepairPartUsageSnapshot = {
  id: string;
  inventoryItemId: string;
  sku: string;
  name: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  attachedAt: string;
};

export type RepairCustomerSnapshot = {
  name: string;
  phone: string;
  email: string;
};

export type RepairTechnicianSnapshot = {
  technicianId: string;
  technicianName: string;
} | null;

/** Labor + parts subtotals as charged on the repair line (pre–sales-tax). */
export type RepairPricingSnapshot = {
  laborSubtotal: number;
  partsSubtotal: number;
  repairSubtotalPreTax: number;
  laborNote?: string;
};

/**
 * One repair ticket’s frozen snapshot at checkout time.
 * `repairTicketNumber` is the customer-facing id (same as ticket id today, e.g. RQ-…).
 */
export type SaleRepairCheckoutSnapshot = {
  linkedRepairTicketId: string;
  repairTicketNumber: string;
  pricing: RepairPricingSnapshot;
  partsUsed: RepairPartUsageSnapshot[];
  customer: RepairCustomerSnapshot;
  technician: RepairTechnicianSnapshot;
  deviceLabel: string;
};
