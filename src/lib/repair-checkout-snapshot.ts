import { repairPricingSummary } from "@/lib/repair-pricing";
import type { RepairPartUsage } from "@/types/repair-parts";
import type {
  RepairPartUsageSnapshot,
  SaleRepairCheckoutSnapshot,
} from "@/types/repair-sale-snapshot";
import type { RepairTicket } from "@/types/repairs";

export function snapshotRepairParts(
  usage: RepairPartUsage[],
): RepairPartUsageSnapshot[] {
  return usage.map((u) => ({
    id: u.id,
    inventoryItemId: u.inventoryItemId,
    sku: u.sku,
    name: u.name,
    unitPrice: u.unitPrice,
    unitCost: u.unitCost,
    quantity: u.quantity,
    attachedAt: u.attachedAt,
  }));
}

export function buildSaleRepairCheckoutSnapshot(
  ticket: RepairTicket,
): SaleRepairCheckoutSnapshot {
  const pricing = repairPricingSummary(ticket);
  return {
    linkedRepairTicketId: ticket.id,
    repairTicketNumber: ticket.id,
    pricing: {
      laborSubtotal: pricing.laborEstimate,
      partsSubtotal: pricing.partsSubtotal,
      repairSubtotalPreTax: pricing.estimatedTotal,
      laborNote: ticket.laborEstimate.note,
    },
    partsUsed: snapshotRepairParts(ticket.partsUsage),
    customer: {
      name: ticket.customerName,
      phone: ticket.phone,
      email: ticket.email,
    },
    technician: ticket.assignment
      ? {
          technicianId: ticket.assignment.technicianId,
          technicianName: ticket.assignment.technicianName,
        }
      : null,
    deviceLabel: ticket.brandModel,
  };
}

/**
 * How much of this sale counts toward the repair ticket balance.
 * `collectedTotal` is the **pre-tax** repair line subtotal from the cart (partial payments use the
 * remaining line amount). `taxAllocated` is this sale’s tax × (repair line subtotal ÷ sale subtotal).
 */
export function allocateRepairPaymentFromSale(
  repairCartLineSubtotal: number,
  sale: { subtotal: number; tax: number },
): { collectedTotal: number; taxAllocated: number } {
  const line = Math.max(0, Math.round(repairCartLineSubtotal * 100) / 100);
  if (sale.subtotal <= 0 || line <= 0) {
    return { collectedTotal: 0, taxAllocated: 0 };
  }
  const ratio = Math.min(1, line / sale.subtotal);
  return {
    collectedTotal: line,
    taxAllocated: Math.round(sale.tax * ratio * 100) / 100,
  };
}
