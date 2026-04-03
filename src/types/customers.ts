/** Customers domain — local-first; sync later */

import type { PaymentProcessorSnapshot } from "@/types/payment";

/** Secondary contact rows (e.g. alternate phone) — optional on `Customer`. */
export type CustomerContactMethodKind = "phone" | "email" | "other";

export type CustomerContactMethod = {
  id: string;
  kind: CustomerContactMethodKind;
  label?: string | null;
  value: string;
  isPrimary?: boolean;
};

export type CustomerAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type CustomerTag = {
  id: string;
  label: string;
};

/** Timeline note (operational), distinct from free-form `Customer.notes`. */
export type CustomerNote = {
  id: string;
  customerId: string;
  body: string;
  createdAt: string;
  createdBy: PaymentProcessorSnapshot | null;
};

/** Denormalized link payload stored on sales / POS cart for offline display. */
export type CustomerLinkSnapshot = {
  customerId: string;
  fullName: string;
  phone: string;
  email: string;
  company?: string | null;
};

/** Lightweight pointer for cross-module joins or future graph APIs. */
export type CustomerLinkRef = {
  kind: "repair_ticket" | "order" | "sale" | "refund";
  id: string;
};

/** Derived in selectors — not persisted on `Customer`. */
export type CustomerSummaryMetrics = {
  repairTicketCount: number;
  orderCount: number;
  saleCount: number;
  refundCount: number;
  /** Sum of linked order `total` (open + closed). */
  ordersTotal: number;
  /** Sum of linked sale `totalDue`. */
  salesTotal: number;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  /** Denormalized for search + receipts; kept in sync on write. */
  fullName: string;
  phone: string;
  email: string;
  company: string | null;
  address: CustomerAddress | null;
  /** Short profile / intake context */
  notes: string;
  /** Structured timeline */
  customerNotes: CustomerNote[];
  tags: CustomerTag[];
  contactMethods: CustomerContactMethod[];
  marketingOptIn: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: PaymentProcessorSnapshot | null;
  active: boolean;
};
