/**
 * Register payment methods — cash & card for POS checkout (local-first).
 * Legacy persisted sales may carry migrated methods normalized to cash/card.
 */

export type PaymentMethod = "cash" | "card";

export type PaymentProcessorSnapshot = {
  employeeId: string;
  name: string;
};

/**
 * One tender line at checkout. `processedBy` is the associate who recorded the line.
 * (Alias intent: same snapshot as “createdBy” in domain language.)
 */
export type PaymentEntry = {
  id: string;
  method: PaymentMethod;
  amount: number;
  recordedAt: string;
  processedBy: PaymentProcessorSnapshot | null;
  note?: string | null;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
};

export const POS_CHECKOUT_METHODS: readonly {
  id: PaymentMethod;
  label: string;
}[] = [
  { id: "cash", label: PAYMENT_METHOD_LABELS.cash },
  { id: "card", label: PAYMENT_METHOD_LABELS.card },
] as const;

/** @deprecated use POS_CHECKOUT_METHODS */
export const PAYMENT_METHOD_OPTIONS = POS_CHECKOUT_METHODS;

export function isPaymentMethod(v: string): v is PaymentMethod {
  return v === "cash" || v === "card";
}

/** Map legacy / external strings to cash | card for storage & UI. */
export function normalizePaymentMethodLoose(raw: string): PaymentMethod {
  const s = raw.trim().toLowerCase();
  if (s === "cash") return "cash";
  if (s === "card" || s === "credit" || s === "debit") return "card";
  if (s === "tap" || s === "contactless") return "card";
  if (
    s === "gift_card" ||
    s === "store_credit" ||
    s === "check" ||
    s === "other" ||
    s === "recorded"
  ) {
    return "card";
  }
  return "card";
}
