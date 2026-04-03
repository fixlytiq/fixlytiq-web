/** POS / Register domain types — local-first; backend will align later */

import type { CustomerLinkSnapshot } from "@/types/customers";
import type { PaymentEntry } from "@/types/payment";
import type { SaleRepairCheckoutSnapshot } from "@/types/repair-sale-snapshot";

export type Category = {
  id: string;
  label: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  /** Unit price in major currency units (USD) */
  price: number;
  categoryId: string;
  /**
   * When set, ties this sellable SKU to an `InventoryItem` for future stock sync.
   * See `InventoryItem.linkedProductId`.
   */
  inventoryItemId?: string | null;
};

/**
 * One row in the active cart. Product is embedded so the line stays stable
 * if the catalog changes during a session. Repair lines carry the ticket id
 * so checkout can mark the repair paid and tie the sale to RMA workflow.
 */
export type CartItem =
  | {
      kind: "product";
      product: Product;
      quantity: number;
    }
  | {
      kind: "repair";
      /** Always from the repairs module → register flow */
      origin: "repair_ticket";
      ticketId: string;
      /** Receipt / ticket line label */
      description: string;
      /** Labor + parts total (major currency units) */
      unitPrice: number;
      quantity: number;
    }
  | {
      kind: "custom";
      /** Stable id for this cart row (not catalog inventory). */
      customItemId: string;
      name: string;
      note: string | null;
      sku: string;
      unitPrice: number;
      quantity: number;
      /** When false, line subtotal is excluded from tax base. */
      taxable: boolean;
      categoryLabel: string | null;
      createdAt: string;
    };

/** Line stored on a completed sale (audit / receipt) */
export type SaleLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineKind?: "product" | "repair" | "custom";
  /** Present when this line is a repair checkout (POS ↔ repairs bridge). */
  repairTicketId?: string | null;
  /** When `lineKind === "custom"` — matches cart `customItemId`. */
  customItemId?: string | null;
  note?: string | null;
  /** Default true when omitted (legacy lines). */
  taxable?: boolean;
  categoryLabel?: string | null;
};

export type SaleEmployeeRef = {
  employeeId: string;
  name: string;
};

export type Sale = {
  id: string;
  stationId: string;
  storeId: string;
  createdAt: string;
  lines: SaleLine[];
  subtotal: number;
  tax: number;
  /** Invoice total (subtotal + tax) — same as `totalDue` at completion. */
  total: number;
  /** Amount owed for this transaction (tax-inclusive). */
  totalDue: number;
  /** Sum of `payments` (may exceed `totalDue` when change is due). */
  totalCollected: number;
  /** Snapshot at completion; zero when fully settled. */
  remainingBalance: number;
  /** Customer change when total collected exceeds total due (typical for cash). */
  changeDue: number;
  /** Tender lines (split payment supported). */
  payments: PaymentEntry[];
  /**
   * Quick filter: first repair ticket on this sale (same as `repairCheckouts[0]` when present).
   */
  linkedRepairTicketId?: string | null;
  /** Frozen per-ticket snapshots when checkout included repair payment(s). */
  repairCheckouts?: SaleRepairCheckoutSnapshot[];
  processedBy?: SaleEmployeeRef | null;
  /** Human summary: single method label or `"Split"` — mirrors `salePaymentMethodSummary`. */
  paymentMethod?: string | null;
  /** Customers module link when assigned at register. */
  customerId?: string | null;
  /** Denormalized display if customer record is removed later. */
  customerSnapshot?: CustomerLinkSnapshot | null;
};

export type Station = {
  id: string;
  name: string;
  storeId: string;
  label?: string;
};

/** Active walk-in / order customer on the register cart (persisted). */
export type PosCartCustomer = {
  customerId: string;
  snapshot: CustomerLinkSnapshot;
};
