import {
  PAYMENT_METHOD_LABELS,
  type PaymentEntry,
  type PaymentMethod,
} from "@/types/payment";

export function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumPaymentAmounts(payments: PaymentEntry[]): number {
  return roundCurrency(payments.reduce((s, p) => s + p.amount, 0));
}

export function sumPaymentsByMethod(
  payments: PaymentEntry[],
  method: PaymentMethod,
): number {
  return roundCurrency(
    payments.filter((p) => p.method === method).reduce((s, p) => s + p.amount, 0),
  );
}

export type CheckoutPaymentTotals = {
  totalCollected: number;
  remainingBalance: number;
  /** Same as change when completion rules pass; see `changeDue`. */
  overpayment: number;
  /** Customer cash back when total collected exceeds total due (card total must not exceed due). */
  changeDue: number;
  cashTotal: number;
  cardTotal: number;
};

export function computeCheckoutPaymentState(
  totalDue: number,
  payments: PaymentEntry[],
): CheckoutPaymentTotals {
  const totalCollected = sumPaymentAmounts(payments);
  const cashTotal = sumPaymentsByMethod(payments, "cash");
  const cardTotal = sumPaymentsByMethod(payments, "card");
  const remainingBalance = roundCurrency(Math.max(0, totalDue - totalCollected));
  const overpayment = roundCurrency(Math.max(0, totalCollected - totalDue));
  const changeDue = overpayment;
  return {
    totalCollected,
    remainingBalance,
    overpayment,
    changeDue,
    cashTotal,
    cardTotal,
  };
}

const COVER_EPSILON = 0.005;
const CARD_EPSILON = 0.005;

/** Card tenders cannot exceed sale total; overpay only via cash. */
export function validateCardTotalAgainstDue(
  totalDue: number,
  payments: PaymentEntry[],
): { ok: true } | { ok: false; error: string } {
  const cardTotal = sumPaymentsByMethod(payments, "card");
  if (cardTotal > totalDue + CARD_EPSILON) {
    return {
      ok: false,
      error: `Card cannot exceed amount due ($${totalDue.toFixed(2)}). Reduce card or use cash for overage.`,
    };
  }
  return { ok: true };
}

/** Max amount the next (or adjusted) card line can be, given other rows. */
export function maxCardAmountAllowed(
  totalDue: number,
  payments: PaymentEntry[],
  excludePaymentId?: string,
): number {
  const cardSum = payments
    .filter((p) => p.method === "card" && p.id !== excludePaymentId)
    .reduce((s, p) => s + p.amount, 0);
  return roundCurrency(Math.max(0, totalDue - cardSum));
}

export function paymentsCoverTotalDue(
  totalDue: number,
  payments: PaymentEntry[],
): boolean {
  const v = validateCardTotalAgainstDue(totalDue, payments);
  if (!v.ok) return false;
  const { totalCollected } = computeCheckoutPaymentState(totalDue, payments);
  return totalCollected + COVER_EPSILON >= totalDue;
}

export function canCompleteCheckout(
  totalDue: number,
  payments: PaymentEntry[],
): boolean {
  return paymentsCoverTotalDue(totalDue, payments);
}

/** Summary label for filters / receipt (Cash, Card, Split). */
export function salePaymentMethodSummary(payments: PaymentEntry[]): string {
  if (payments.length === 0) return "—";
  const hasCash = payments.some((p) => p.method === "cash");
  const hasCard = payments.some((p) => p.method === "card");
  if (hasCash && hasCard) return "Split";
  if (hasCash) return payments.length > 1 ? "Cash (split)" : "Cash";
  return payments.length > 1 ? "Card (split)" : "Card";
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

export function paymentTotalsByMethod(payments: PaymentEntry[]): {
  cash: number;
  card: number;
} {
  return {
    cash: sumPaymentsByMethod(payments, "cash"),
    card: sumPaymentsByMethod(payments, "card"),
  };
}
