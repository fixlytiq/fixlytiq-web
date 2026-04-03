import type { RepairPartUsage, RepairPricingSummary } from "@/types/repair-parts";
import type { RepairTicket } from "@/types/repairs";

export function repairPartsSubtotal(usage: RepairPartUsage[]): number {
  return usage.reduce((s, u) => s + u.quantity * u.unitPrice, 0);
}

export function repairPricingSummary(ticket: RepairTicket): RepairPricingSummary {
  const partsSubtotal = repairPartsSubtotal(ticket.partsUsage);
  const laborEstimate = ticket.laborEstimate.amount;
  return {
    laborEstimate,
    partsSubtotal,
    estimatedTotal: laborEstimate + partsSubtotal,
  };
}

/** Keep `estimatedPrice` aligned with labor + attached parts (customer-facing total). */
export function repairTicketWithSyncedEstimate(ticket: RepairTicket): RepairTicket {
  const { estimatedTotal } = repairPricingSummary(ticket);
  return { ...ticket, estimatedPrice: estimatedTotal };
}
