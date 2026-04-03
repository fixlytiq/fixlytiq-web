import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ManagerPinRefundOverride,
  Refund,
  RefundAuthorizationKind,
  RefundLine,
  RefundReason,
  RefundScopeLineSelection,
  RefundSummary,
} from "@/types/refunds";
import type { PaymentProcessorSnapshot } from "@/types/payment";
import type { Sale, SaleLine } from "@/types/pos";
import { usePosStore } from "@/stores/pos-store";
import { useInventoryStore } from "@/stores/inventory-store";
import { useOrdersStore } from "@/stores/orders-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { useSessionStore } from "@/stores/session-store";
import type { InventoryEmployeeRef } from "@/stores/inventory-store";
import type { InventoryItem } from "@/types/inventory";
import { roundCurrency } from "@/lib/payment-totals";
import {
  REFUND_MANAGER_APPROVAL_REQUIRED_MESSAGE,
  canIssueRefund,
} from "@/lib/rbac";
import {
  buildManagerPinRefundOverride,
  refundOrderHistoryAuditNote,
  verifyManagerApprovalPinForRefund,
} from "@/lib/refund-manager-pin";

const STORAGE_KEY = "fixlytiq-refunds";

export type RefundsStoreState = {
  refunds: Refund[];
};

export type CreateRefundInput = {
  saleId: string;
  reason: RefundReason;
  note?: string | null;
  /**
   * Item-level selections into the original sale lines.
   * - For full refund, pass every line with its full quantity (UI can do that).
   * - For partial refund, pass only the lines/quantities you want to refund.
   */
  lines: RefundScopeLineSelection[];
  /**
   * When true, we restore inventory for inventory-backed product lines only.
   * (Custom + repair lines never affect inventory.)
   */
  restockInventory?: boolean;
  /**
   * Cashier/technician path: validated in store against employees (never persisted).
   */
  managerApprovalPin?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function lineIsTaxable(line: SaleLine): boolean {
  return line.taxable !== false;
}

function getLineKind(line: SaleLine): "product" | "repair" | "custom" {
  if (line.lineKind === "product" || line.lineKind === "repair" || line.lineKind === "custom") {
    return line.lineKind;
  }
  if (line.repairTicketId) return "repair";
  if (line.customItemId) return "custom";
  return "product";
}

function migrateSaleLineKindAndIds(line: SaleLine): {
  kind: "product" | "repair" | "custom";
  refundProductId: string;
} {
  const kind = getLineKind(line);
  if (kind === "product") return { kind, refundProductId: line.productId };
  if (kind === "repair") return { kind, refundProductId: `repair:${line.repairTicketId ?? line.productId}` };
  return { kind, refundProductId: `custom:${line.customItemId ?? line.productId}` };
}

function makeInventoryEmployeeRef(): InventoryEmployeeRef | null {
  const emp = useSessionStore.getState().employee;
  if (!emp) return null;
  return { employeeId: emp.id, name: emp.name };
}

function findOrderIdForSale(saleId: string): string | null {
  const orders = useOrdersStore.getState().orders;
  for (const o of orders) {
    if (o.linkedSaleIds.includes(saleId)) return o.id;
  }
  return null;
}

function findRefundableSaleLine(sale: Sale, saleLineIndex: number): SaleLine | null {
  const line = sale.lines[saleLineIndex];
  return line ? line : null;
}

function migrateRefundAuthorizationKind(
  raw: unknown,
): RefundAuthorizationKind {
  return raw === "manager_pin" ? "manager_pin" : "direct";
}

function migrateManagerPinApproval(
  raw: unknown,
): ManagerPinRefundOverride | null {
  if (!isRecord(raw)) return null;
  const managerRole = raw.managerRole;
  const roles = ["owner", "manager", "technician", "cashier"] as const;
  const roleOk =
    typeof managerRole === "string" &&
    (roles as readonly string[]).includes(managerRole);
  if (
    typeof raw.managerEmployeeId !== "string" ||
    typeof raw.managerName !== "string" ||
    !roleOk ||
    typeof raw.verifiedAt !== "string" ||
    raw.approvalMethod !== "pin" ||
    typeof raw.initiatedByEmployeeId !== "string" ||
    typeof raw.initiatedByName !== "string"
  ) {
    return null;
  }
  const approvedBySessionEmployeeId =
    typeof raw.approvedBySessionEmployeeId === "string"
      ? raw.approvedBySessionEmployeeId
      : raw.initiatedByEmployeeId;
  return {
    managerEmployeeId: raw.managerEmployeeId,
    managerName: raw.managerName,
    managerRole: managerRole as import("@/types/employee").EmployeeRole,
    verifiedAt: raw.verifiedAt,
    approvalMethod: "pin",
    initiatedByEmployeeId: raw.initiatedByEmployeeId,
    initiatedByName: raw.initiatedByName,
    approvedBySessionEmployeeId,
  };
}

/** Normalize persisted refunds (legacy rows without authorization fields). */
export function migrateRefund(raw: unknown): Refund | null {
  if (!isRecord(raw)) return null;
  const o = raw;
  if (typeof o.id !== "string" || typeof o.saleId !== "string") return null;
  const createdAt =
    typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString();
  const updatedAt =
    typeof o.updatedAt === "string" ? o.updatedAt : createdAt;
  const reason = o.reason as RefundReason;
  const allowed: readonly RefundReason[] = [
    "customer_request",
    "incorrect_item",
    "pricing_error",
    "damaged_item",
    "other",
  ];
  if (!allowed.includes(reason)) return null;

  const linesRaw = o.refundLines;
  if (!Array.isArray(linesRaw)) return null;
  const refundLines: RefundLine[] = [];
  for (const row of linesRaw) {
    if (!isRecord(row)) continue;
    if (
      typeof row.id !== "string" ||
      typeof row.saleLineIndex !== "number" ||
      typeof row.productId !== "string" ||
      typeof row.sku !== "string" ||
      typeof row.name !== "string" ||
      typeof row.unitPrice !== "number" ||
      typeof row.quantity !== "number" ||
      typeof row.refundSubtotal !== "number" ||
      typeof row.refundTax !== "number" ||
      typeof row.refundTotal !== "number"
    ) {
      continue;
    }
    const lk = row.lineKind;
    if (lk !== "product" && lk !== "repair" && lk !== "custom") continue;
    refundLines.push({
      id: row.id,
      saleLineIndex: row.saleLineIndex,
      lineKind: lk,
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      refundSubtotal: row.refundSubtotal,
      refundTax: row.refundTax,
      refundTotal: row.refundTotal,
      taxable: row.taxable === false ? false : undefined,
    });
  }
  if (refundLines.length === 0) return null;

  const summary = o.summary;
  if (!isRecord(summary)) return null;
  const refundedSubtotal = Number(summary.refundedSubtotal);
  const refundedTax = Number(summary.refundedTax);
  const refundedTotal = Number(summary.refundedTotal);
  if (
    !Number.isFinite(refundedSubtotal) ||
    !Number.isFinite(refundedTax) ||
    !Number.isFinite(refundedTotal)
  ) {
    return null;
  }

  let createdBy: PaymentProcessorSnapshot | null = null;
  const cb = o.createdBy;
  if (
    isRecord(cb) &&
    typeof cb.employeeId === "string" &&
    typeof cb.name === "string"
  ) {
    createdBy = { employeeId: cb.employeeId, name: cb.name };
  }

  const authorizationKind = migrateRefundAuthorizationKind(o.authorizationKind);
  let managerPinApproval = migrateManagerPinApproval(o.managerPinApproval);
  if (authorizationKind === "manager_pin" && !managerPinApproval) {
    managerPinApproval = null;
  }
  if (authorizationKind === "direct") {
    managerPinApproval = null;
  }

  return {
    id: o.id,
    createdAt,
    updatedAt,
    saleId: o.saleId,
    orderId:
      o.orderId === null || o.orderId === undefined
        ? null
        : String(o.orderId),
    repairTicketId:
      o.repairTicketId === null || o.repairTicketId === undefined
        ? null
        : String(o.repairTicketId),
    reason,
    note:
      o.note === null || o.note === undefined
        ? null
        : String(o.note).trim() || null,
    restockedInventory: o.restockedInventory === true,
    createdBy,
    authorizationKind:
      o.authorizationKind === undefined && o.managerPinApproval === undefined
        ? "direct"
        : authorizationKind,
    managerPinApproval:
      o.authorizationKind === undefined && o.managerPinApproval === undefined
        ? null
        : managerPinApproval,
    refundLines,
    summary: {
      refundedSubtotal,
      refundedTax,
      refundedTotal,
    },
  };
}

function computeRefundTotals(args: {
  sale: Sale;
  refundSelections: Array<{ line: SaleLine; quantity: number; saleLineIndex: number }>;
}): { refundLines: RefundLine[]; summary: RefundSummary } {
  const { sale, refundSelections } = args;

  const allTaxableSubtotal = sale.lines.reduce((sum, l) => {
    if (!lineIsTaxable(l)) return sum;
    return sum + l.unitPrice * l.quantity;
  }, 0);

  const selectedTaxableSubtotal = refundSelections.reduce((sum, s) => {
    if (!lineIsTaxable(s.line)) return sum;
    return sum + s.line.unitPrice * s.quantity;
  }, 0);

  const summaryTax = (() => {
    if (selectedTaxableSubtotal <= 0 || allTaxableSubtotal <= 0) return 0;
    const ratio = selectedTaxableSubtotal / allTaxableSubtotal;
    return roundCurrency(sale.tax * ratio);
  })();

  const refundLines: RefundLine[] = [];
  let remainingTax = summaryTax;

  // Allocate line taxes to keep receipts consistent; last taxable line gets the rounding remainder.
  const taxableSelections = refundSelections.filter((s) => lineIsTaxable(s.line));
  const taxableSelectionsCount = taxableSelections.length;
  let taxableIndex = 0;

  for (const sel of refundSelections) {
    const { kind, refundProductId } = migrateSaleLineKindAndIds(sel.line);

    const refundSubtotal = roundCurrency(sel.line.unitPrice * sel.quantity);
    let refundTax = 0;

    if (lineIsTaxable(sel.line)) {
      taxableIndex += 1;
      const taxableSubtotal = sel.line.unitPrice * sel.quantity;
      if (taxableIndex < taxableSelectionsCount) {
        const lineRatio =
          selectedTaxableSubtotal <= 0 ? 0 : taxableSubtotal / selectedTaxableSubtotal;
        refundTax = roundCurrency(summaryTax * lineRatio);
        remainingTax = roundCurrency(remainingTax - refundTax);
      } else {
        // Last taxable line receives remainder to make sums exact.
        refundTax = remainingTax;
      }
    }

    const refundTotal = roundCurrency(refundSubtotal + refundTax);

    refundLines.push({
      id: crypto.randomUUID(),
      saleLineIndex: sel.saleLineIndex,
      lineKind: kind,
      productId: refundProductId,
      sku: sel.line.sku,
      name: sel.line.name,
      unitPrice: sel.line.unitPrice,
      quantity: sel.quantity,
      refundSubtotal,
      refundTax,
      refundTotal,
      taxable: lineIsTaxable(sel.line) ? true : undefined,
    });
  }

  const summarySubtotal = refundLines.reduce((sum, l) => sum + l.refundSubtotal, 0);
  const summaryTaxCheck = refundLines.reduce((sum, l) => sum + l.refundTax, 0);
  const summaryTotal = roundCurrency(summarySubtotal + summaryTaxCheck);

  return {
    refundLines,
    summary: {
      refundedSubtotal: roundCurrency(summarySubtotal),
      refundedTax: roundCurrency(summaryTaxCheck),
      refundedTotal: summaryTotal,
    },
  };
}

export type RefundsStoreActions = {
  createRefund: (input: CreateRefundInput) => { ok: true; refundId: string } | { ok: false; error: string };
};

export type RefundsStore = RefundsStoreState & RefundsStoreActions;

export const useRefundsStore = create<RefundsStore>()(
  persist(
    (set, get) => ({
      refunds: [],

      createRefund: (input) => {
        const saleId = input.saleId.trim();
        if (!saleId) return { ok: false, error: "saleId is required." };

        const emp = useSessionStore.getState().employee;
        if (!emp) {
          return { ok: false, error: "Sign in to issue refunds." };
        }

        let authorizationKind: RefundAuthorizationKind = "direct";
        let managerPinApproval: ManagerPinRefundOverride | null = null;

        if (canIssueRefund(emp.role)) {
          authorizationKind = "direct";
          managerPinApproval = null;
        } else {
          const pin = input.managerApprovalPin?.trim() ?? "";
          if (!pin) {
            return { ok: false, error: REFUND_MANAGER_APPROVAL_REQUIRED_MESSAGE };
          }
          const v = verifyManagerApprovalPinForRefund({
            pinRaw: pin,
            sessionEmployee: emp,
          });
          if (!v.ok) {
            return { ok: false, error: v.error };
          }
          authorizationKind = "manager_pin";
          managerPinApproval = buildManagerPinRefundOverride({
            approver: v.approver,
            sessionEmployee: emp,
            verifiedAt: new Date().toISOString(),
          });
        }

        const sale = usePosStore.getState().recentSales.find((s) => s.id === saleId) ?? null;
        if (!sale) return { ok: false, error: "Original sale not found in local history." };

        if (!Array.isArray(input.lines) || input.lines.length === 0) {
          return { ok: false, error: "Refund lines are required." };
        }

        const refundSelections = [];
        for (const sel of input.lines) {
          if (!Number.isFinite(sel.quantity) || sel.quantity <= 0) {
            return { ok: false, error: "Refund quantity must be positive." };
          }
          const qty = Math.floor(sel.quantity);
          const line = findRefundableSaleLine(sale, sel.saleLineIndex);
          if (!line) return { ok: false, error: "Invalid saleLineIndex." };
          if (!Number.isFinite(line.quantity) || qty > line.quantity) {
            return { ok: false, error: "Refund quantity exceeds original line quantity." };
          }
          refundSelections.push({
            line,
            quantity: qty,
            saleLineIndex: sel.saleLineIndex,
          });
        }

        const { refundLines, summary } = computeRefundTotals({
          sale,
          refundSelections,
        });

        const createdBy: PaymentProcessorSnapshot | null = {
          employeeId: emp.id,
          name: emp.name,
        };

        const orderId = findOrderIdForSale(saleId);
        const repairTicketId = sale.linkedRepairTicketId ?? null;

        const restockInventory = input.restockInventory === true;
        if (restockInventory) {
          const inv = useInventoryStore.getState();
          const by = makeInventoryEmployeeRef();
          if (!by) {
            return { ok: false, error: "Sign in to restore inventory." };
          }

          // Restore inventory only for product lines.
          for (const rl of refundLines) {
            if (rl.lineKind !== "product") continue;
            const inventoryItem = inv.items.find(
              (i) => i.linkedProductId === rl.productId,
            );
            if (!inventoryItem) continue;
            const r = inv.recordStockAdd(
              inventoryItem.id,
              rl.quantity,
              "Refund restock",
              `Refund · ${saleId} · ${rl.sku}`,
              by,
            );
            if (!r.ok) return r;
          }
        }

        const now = new Date().toISOString();
        const refund: Refund = {
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          saleId,
          orderId,
          repairTicketId,
          reason: input.reason,
          note: input.note?.trim() ? input.note.trim() : null,
          restockedInventory: input.restockInventory === true,
          createdBy,
          authorizationKind,
          managerPinApproval,
          refundLines,
          summary,
        };

        set((s) => ({ refunds: [refund, ...s.refunds] }));

        // Repair side effects: record a refund ledger entry against the linked repair
        // so payment/refund state netting stays accurate.
        if (repairTicketId) {
          const repairRefundedCollectedTotal = refundLines.reduce(
            (sum, rl) => (rl.lineKind === "repair" ? sum + rl.refundSubtotal : sum),
            0,
          );
          if (repairRefundedCollectedTotal > 0) {
            const repairs = useRepairsStore.getState();
            repairs.recordRepairRefundFromSale(repairTicketId, {
              refundId: refund.id,
              saleId,
              refundedAt: now,
              refundSummary: {
                refundedCollectedTotal: repairRefundedCollectedTotal,
              },
              refundAuthorizationKind: authorizationKind,
              refundApprovedByEmployeeId:
                managerPinApproval?.managerEmployeeId ?? null,
              refundApprovedByName: managerPinApproval?.managerName ?? null,
              refundManagerPinVerifiedAt:
                managerPinApproval?.verifiedAt ?? null,
            });
          }
        }

        // Best-effort: update order payment state (optional; UI will also read refunds).
        if (orderId) {
          const orders = useOrdersStore.getState();
          const by = createdBy;
          void orders.recordRefundForOrder(
            orderId,
            {
              refundId: refund.id,
              summary,
              historyNote: refundOrderHistoryAuditNote(
                authorizationKind,
                managerPinApproval,
              ),
            },
            by,
          );
        }

        return { ok: true, refundId: refund.id };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ refunds: state.refunds }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<RefundsStoreState> | undefined;
        const raw = p?.refunds;
        const refunds = Array.isArray(raw)
          ? raw.map(migrateRefund).filter((r): r is Refund => r !== null)
          : current.refunds;
        return { ...current, refunds };
      },
    },
  ),
);

