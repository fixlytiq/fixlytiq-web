import { paymentMethodLabel } from "@/lib/payment-totals";
import { saleIncludesRepairCheckout } from "@/lib/sale-repair";
import { isPaymentMethod } from "@/types/payment";
import type { Sale } from "@/types/pos";

export type TransactionKind = "product_sale" | "repair_payment";

export type TransactionTypeFilter = "all" | "product_sale" | "repair_payment";

export type TransactionFilters = {
  search: string;
  type: TransactionTypeFilter;
  employeeId: string | "all";
  dateFrom: string | null; // YYYY-MM-DD local
  dateTo: string | null; // YYYY-MM-DD local
  paymentMethod: string | "all";
};

export type TransactionSummary = {
  count: number;
  totalRevenue: number;
  repairRevenue: number;
  averageTicket: number;
  repairCount: number;
};

export function transactionKind(sale: Sale): TransactionKind {
  return saleIncludesRepairCheckout(sale) ? "repair_payment" : "product_sale";
}

function matchesSearch(sale: Sale, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();

  // transaction id
  if (sale.id.toLowerCase().includes(s)) return true;

  if (sale.customerId?.toLowerCase().includes(s)) return true;
  const cs = sale.customerSnapshot;
  if (cs) {
    if (cs.fullName.toLowerCase().includes(s)) return true;
    if (cs.phone.toLowerCase().includes(s)) return true;
    if (cs.email.toLowerCase().includes(s)) return true;
  }

  // repair ticket number or id
  for (const snap of sale.repairCheckouts ?? []) {
    if (
      snap.repairTicketNumber.toLowerCase().includes(s) ||
      snap.linkedRepairTicketId.toLowerCase().includes(s)
    ) {
      return true;
    }
    if (snap.customer.name.toLowerCase().includes(s)) return true;
  }

  return false;
}

function matchesType(sale: Sale, type: TransactionTypeFilter): boolean {
  if (type === "all") return true;
  return transactionKind(sale) === type;
}

function matchesEmployee(sale: Sale, employeeId: string | "all"): boolean {
  if (employeeId === "all") return true;
  return sale.processedBy?.employeeId === employeeId;
}

function dateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchesDateRange(
  sale: Sale,
  from: string | null,
  to: string | null,
): boolean {
  if (!from && !to) return true;
  const d = dateOnly(new Date(sale.createdAt));
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesPaymentMethod(sale: Sale, method: string | "all"): boolean {
  if (method === "all") return true;
  const want = method.trim().toLowerCase();
  const summary = (sale.paymentMethod ?? "").trim().toLowerCase();
  if (summary === want) return true;
  if (want === "split") {
    const pays = sale.payments ?? [];
    const hasCash = pays.some((p) => p.method === "cash");
    const hasCard = pays.some((p) => p.method === "card");
    return hasCash && hasCard;
  }
  for (const p of sale.payments ?? []) {
    if (isPaymentMethod(want) && p.method === want) return true;
    if (paymentMethodLabel(p.method).toLowerCase() === want) return true;
  }
  return false;
}

export function filterTransactions(
  sales: Sale[],
  filters: TransactionFilters,
): Sale[] {
  const { search, type, employeeId, dateFrom, dateTo, paymentMethod } =
    filters;
  const out: Sale[] = [];
  for (const sale of sales) {
    if (!matchesSearch(sale, search)) continue;
    if (!matchesType(sale, type)) continue;
    if (!matchesEmployee(sale, employeeId)) continue;
    if (!matchesDateRange(sale, dateFrom, dateTo)) continue;
    if (!matchesPaymentMethod(sale, paymentMethod)) continue;
    out.push(sale);
  }
  // reverse chronological
  return out.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function summarizeForDay(
  sales: Sale[],
  day: Date,
): TransactionSummary {
  const target = dateOnly(day);
  let count = 0;
  let totalRevenue = 0;
  let repairRevenue = 0;
  let repairCount = 0;

  for (const sale of sales) {
    if (dateOnly(new Date(sale.createdAt)) !== target) continue;
    count += 1;
    totalRevenue += sale.total;
    if (saleIncludesRepairCheckout(sale)) {
      repairCount += 1;
      // prefer snapshot-based total when present; fall back to sale.total
      const snapTotal =
        sale.repairCheckouts?.reduce(
          (s, snap) => s + snap.pricing.repairSubtotalPreTax,
          0,
        ) ?? 0;
      repairRevenue += snapTotal > 0 ? snapTotal : sale.total;
    }
  }

  const averageTicket = count === 0 ? 0 : totalRevenue / count;

  return {
    count,
    totalRevenue,
    repairRevenue,
    averageTicket,
    repairCount,
  };
}

