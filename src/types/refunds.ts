import type { EmployeeRole } from "@/types/employee";
import type { PaymentProcessorSnapshot } from "@/types/payment";
import type { SignatureCapture } from "@/types/repair-workflow";

export type RefundApprovalMethod = "pin";

/**
 * Persisted after cashier/technician refund with manager PIN (PIN itself is never stored).
 */
export type ManagerPinRefundOverride = {
  managerEmployeeId: string;
  managerName: string;
  managerRole: EmployeeRole;
  verifiedAt: string;
  approvalMethod: RefundApprovalMethod;
  /** Session employee who initiated the refund (cashier / technician). */
  initiatedByEmployeeId: string;
  initiatedByName: string;
  /** Session employee id at verification time (same as initiator for PIN flow; explicit for audit). */
  approvedBySessionEmployeeId: string;
};

export type RefundAuthorizationKind = "direct" | "manager_pin";

export type RefundReason =
  | "customer_request"
  | "incorrect_item"
  | "pricing_error"
  | "damaged_item"
  | "other";

export type RefundScopeLineSelection = {
  /** Index into `Sale.lines` for the original transaction. */
  saleLineIndex: number;
  /** How many units to refund for that line. */
  quantity: number;
};

export type RefundSummary = {
  refundedSubtotal: number; // pre-tax principal
  refundedTax: number;
  refundedTotal: number; // subtotal + tax
};

export type RefundLine = {
  id: string;
  /** Which line in the original sale was refunded. */
  saleLineIndex: number;

  lineKind: "product" | "repair" | "custom";
  productId: string;
  sku: string;
  name: string;

  unitPrice: number;
  quantity: number;

  refundSubtotal: number;
  refundTax: number;
  refundTotal: number;

  /**
   * When a line is `custom`, we persist taxable to keep receipts and audit consistent.
   * For product/repair lines, this is implicitly taxable.
   */
  taxable?: boolean;
};

export type Refund = {
  id: string;
  createdAt: string;
  updatedAt: string;

  /**
   * Original transaction this refund is based on.
   * We never delete or mutate the sale itself.
   */
  saleId: string;

  /** Optional order association for UI convenience. */
  orderId: string | null;
  /** Optional repair ticket association for UI convenience. */
  repairTicketId: string | null;

  reason: RefundReason;
  note: string | null;

  /**
   * Inventory restock performed for inventory-backed product lines only.
   * (Custom and repair lines never affect inventory.)
   */
  restockedInventory: boolean;

  createdBy: PaymentProcessorSnapshot | null;

  /**
   * `direct` — session was owner/manager at creation.
   * `manager_pin` — session needed manager PIN; see `managerPinApproval`.
   */
  authorizationKind: RefundAuthorizationKind;
  /** Set when `authorizationKind === "manager_pin"`. */
  managerPinApproval: ManagerPinRefundOverride | null;

  refundLines: RefundLine[];
  summary: RefundSummary;
};

/** Legacy: some flows may capture a customer signature for refund acceptance later. */
export type RefundAcceptanceSignature = SignatureCapture;

