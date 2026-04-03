import { repairPricingSummary } from "@/lib/repair-pricing";
import type {
  RepairPaymentState,
  RepairTicket,
} from "@/types/repairs";

/** Sum of pre-tax principal credited from each linked sale (`RepairPaymentSummary.collectedTotal`). */
export function repairCollectedTotal(ticket: RepairTicket): number {
  const collected = ticket.paymentHistory.reduce(
    (sum, entry) => sum + entry.summary.collectedTotal,
    0,
  );
  const refunded = ticket.refundHistory.reduce(
    (sum, entry) => sum + entry.summary.refundedCollectedTotal,
    0,
  );
  return Math.max(0, collected - refunded);
}

/** Compares pre-tax estimate (labor + parts) to collected pre-tax principal from all transactions. */
export function repairPaymentTotals(ticket: RepairTicket): {
  estimateTotal: number;
  collectedTotal: number;
  remainingBalance: number;
} {
  const { estimatedTotal } = repairPricingSummary(ticket);
  const collectedTotal = repairCollectedTotal(ticket);
  const remaining = Math.max(0, estimatedTotal - collectedTotal);
  return {
    estimateTotal: estimatedTotal,
    collectedTotal,
    remainingBalance: remaining,
  };
}

export function deriveRepairPaymentState(
  ticket: RepairTicket,
): {
  state: RepairPaymentState;
  paidAt: string | null;
} {
  const { estimateTotal, collectedTotal } = repairPaymentTotals(ticket);
  if (collectedTotal <= 0) {
    return { state: "unpaid", paidAt: null };
  }
  if (estimateTotal <= 0) {
    // nothing owed, treat as paid
    const last = ticket.paymentHistory.at(-1);
    return { state: "paid", paidAt: last?.paidAt ?? ticket.paidAt ?? null };
  }

  const epsilon = 0.01;
  if (collectedTotal + epsilon < estimateTotal) {
    return { state: "partially_paid", paidAt: null };
  }
  const last = ticket.paymentHistory.at(-1);
  return { state: "paid", paidAt: last?.paidAt ?? ticket.paidAt ?? null };
}

