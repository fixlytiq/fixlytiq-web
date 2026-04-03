import type { PaymentEntry, PaymentProcessorSnapshot } from "@/types/payment";

export type OrderStatus =
  | "open"
  | "pending"
  | "partially_paid"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export type OrderCustomerSnapshot = {
  /** Set when linked to Customers module */
  customerId: string | null;
  name: string;
  phone?: string;
  email?: string;
  company?: string | null;
} | null;

/**
 * Order line stored on the Orders domain (local-first).
 * This mirrors POS cart semantics enough to:
 * - resume orders back into register
 * - map lines into completed sale transaction lines later
 */
export type OrderLine = {
  id: string;
  lineKind: "product" | "repair" | "custom";

  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;

  /** POS products: used for inventory tracking and catalog browsing on resume. */
  categoryId?: string | null;
  inventoryItemId?: string | null;

  /** Repairs: set when line is a repair payment line. */
  repairTicketId?: string | null;

  /** Custom: set when line is a temporary custom line. */
  customItemId?: string | null;
  note?: string | null;
  taxable?: boolean;
  categoryLabel?: string | null;
};

export type OrderPaymentSummary = {
  subtotal: number;
  tax: number;
  totalDue: number;
  totalCollected: number;
  remainingBalance: number;
  changeDue: number;
  payments: PaymentEntry[];
  /** Human summary: "Split" or a single payment method label. */
  paymentMethod?: string | null;
};

export type OrderHistoryEntry = {
  id: string;
  at: string;
  type:
    | "created"
    | "status_changed"
    | "lines_updated"
    | "payment_recorded"
    | "cancelled"
    | "note_added"
    | "refunded"
    | "customer_assigned";
  by: PaymentProcessorSnapshot | null;

  fromStatus?: OrderStatus | null;
  toStatus?: OrderStatus | null;

  linkedSaleId?: string | null;
  refundId?: string | null;
  note?: string | null;
};

export type Order = {
  id: string;
  storeId: string;
  stationId: string;

  createdBy: PaymentProcessorSnapshot | null;
  createdAt: string;
  updatedAt: string;

  status: OrderStatus;
  history: OrderHistoryEntry[];

  customer: OrderCustomerSnapshot;
  lines: OrderLine[];

  subtotal: number;
  tax: number;
  total: number;

  /** Payment summary after one or more checkout flows. */
  paymentSummary: OrderPaymentSummary | null;

  /** First repair ticket involved, if any. */
  linkedRepairTicketId: string | null;

  /** Notes/cashier label stored when the order was parked. */
  note: string | null;
  label: string | null;

  /** Sale transactions created when the order is paid. */
  linkedSaleIds: string[];
};

