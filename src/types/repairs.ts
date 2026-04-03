/** Repairs domain — local-first; backend will align later */

import type {
  RepairLaborEstimate,
  RepairPartUsage,
} from "@/types/repair-parts";
import type { SaleRepairCheckoutSnapshot } from "@/types/repair-sale-snapshot";
import type {
  LiabilityWaiverAcceptance,
  PostInspectionChecklist,
  PreInspectionChecklist,
  SignatureCapture,
} from "@/types/repair-workflow";
import type { RefundAuthorizationKind } from "@/types/refunds";
import type { TicketWaiverSnapshot } from "@/types/waivers";

export type RepairStatus =
  | "intake"
  | "diagnostics"
  | "waiting_parts"
  | "in_repair"
  | "qa"
  | "ready"
  | "closed";

/** POS / register payment lifecycle for the ticket total (labor + parts, pre-tax estimate). */
export type RepairPaymentState = "unpaid" | "partially_paid" | "paid";

/**
 * Per-transaction snapshot when a sale closes against this ticket.
 * `collectedTotal` is pre-tax principal credited (cart repair line subtotal for that checkout).
 * `taxAllocated` is tax from the sale attributed to the repair line (mixed carts).
 */
export type RepairPaymentSummary = {
  laborSubtotal: number;
  partsSubtotal: number;
  repairSubtotalPreTax: number;
  collectedTotal: number;
  taxAllocated: number;
};

/** One completed register transaction applied to this ticket. */
export type RepairPaymentLedgerEntry = {
  saleId: string;
  paidAt: string;
  summary: RepairPaymentSummary;
  snapshot: SaleRepairCheckoutSnapshot;
};

export type RepairRefundLedgerEntry = {
  refundId: string;
  saleId: string;
  refundedAt: string;
  /**
   * Pre-tax principal credited back to this repair ticket.
   * Used to net out `paymentHistory` for payment/refund state.
   */
  summary: {
    refundedCollectedTotal: number;
  };
  /** Mirrors linked `Refund.authorizationKind` for ticket-level audit. */
  refundAuthorizationKind?: RefundAuthorizationKind;
  /** Manager/owner who approved via PIN when `refundAuthorizationKind === "manager_pin"`. */
  refundApprovedByEmployeeId?: string | null;
  refundApprovedByName?: string | null;
  refundManagerPinVerifiedAt?: string | null;
};

export type DeviceType =
  | "phone"
  | "tablet"
  | "laptop"
  | "wearable"
  | "console"
  | "other";

export type RepairNote = {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
  authorEmployeeId: string;
  authorName: string;
};

export type TechnicianAssignment = {
  technicianId: string;
  technicianName: string;
  assignedAt: string;
};

export type RepairTicket = {
  id: string;
  /** Customers module id when linked; intake still stores name/phone/email snapshot. */
  linkedCustomerId: string | null;
  customerName: string;
  phone: string;
  email: string;
  deviceType: DeviceType;
  brandModel: string;
  issueDescription: string;
  /** Local calendar date YYYY-MM-DD */
  intakeDate: string;
  status: RepairStatus;
  assignment: TechnicianAssignment | null;
  estimatedPrice: number;
  /** Labor line item (parts subtotal is computed from `partsUsage`). */
  laborEstimate: RepairLaborEstimate;
  /** Inventory parts consumed on this ticket (stock reduced when attached). */
  partsUsage: RepairPartUsage[];
  notes: RepairNote[];
  createdAt: string;
  updatedAt: string;
  preInspection: PreInspectionChecklist;
  postInspection: PostInspectionChecklist;
  liabilityWaiver: LiabilityWaiverAcceptance;
  /**
   * Frozen store waiver snapshot (template id/version/body + signature) captured during intake.
   * Legal/history purposes: do not reference the live template after acceptance.
   */
  waiverTemplateSnapshot: TicketWaiverSnapshot | null;
  customerSignature: SignatureCapture;
  /** When customer signature / intake authorization was captured */
  signedAt: string | null;
  repairPaymentState: RepairPaymentState;
  /** When marked paid via POS (ISO) */
  paidAt: string | null;
  /** Most recent sale id touching this repair (see `paymentHistory` for all). */
  linkedSaleId: string | null;
  /** Latest ledger entry summary (denormalized). */
  paymentSummary: RepairPaymentSummary | null;
  /** All completed register checkouts applied to this ticket (supports partial / multiple). */
  paymentHistory: RepairPaymentLedgerEntry[];
  /** All refunds recorded against this ticket (supports partial / multiple). */
  refundHistory: RepairRefundLedgerEntry[];
};

export type {
  RepairLaborEstimate,
  RepairPartUsage,
  RepairPricingSummary,
} from "@/types/repair-parts";

export type {
  LiabilityWaiverAcceptance,
  PostInspectionChecklist,
  PreInspectionChecklist,
  SignatureCapture,
} from "@/types/repair-workflow";

export type { TicketWaiverSnapshot } from "@/types/waivers";

export const REPAIR_STATUSES: readonly RepairStatus[] = [
  "intake",
  "diagnostics",
  "waiting_parts",
  "in_repair",
  "qa",
  "ready",
  "closed",
] as const;

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  intake: "Intake",
  diagnostics: "Diagnostics",
  waiting_parts: "Waiting parts",
  in_repair: "In repair",
  qa: "QA",
  ready: "Ready",
  closed: "Closed",
};

export const REPAIR_PAYMENT_STATE_LABELS: Record<RepairPaymentState, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partial",
  paid: "Paid",
};

export const DEVICE_TYPE_OPTIONS: readonly { id: DeviceType; label: string }[] =
  [
    { id: "phone", label: "Phone" },
    { id: "tablet", label: "Tablet" },
    { id: "laptop", label: "Laptop" },
    { id: "wearable", label: "Wearable" },
    { id: "console", label: "Console" },
    { id: "other", label: "Other" },
  ] as const;
