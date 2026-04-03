import { customItemIdFromSaleProductId } from "@/lib/custom-pos-item";
import { REPAIR_SALE_SKU } from "@/lib/pos-cart";
import {
  computeCheckoutPaymentState,
  roundCurrency,
  salePaymentMethodSummary,
  sumPaymentAmounts,
} from "@/lib/payment-totals";
import type { Sale, SaleEmployeeRef, SaleLine } from "@/types/pos";
import {
  normalizePaymentMethodLoose,
  type PaymentEntry,
} from "@/types/payment";
import type { SaleRepairCheckoutSnapshot } from "@/types/repair-sale-snapshot";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSaleLine(raw: unknown): SaleLine | null {
  if (!isRecord(raw)) return null;
  const o = raw;
  if (
    typeof o.productId !== "string" ||
    typeof o.name !== "string" ||
    typeof o.sku !== "string" ||
    typeof o.unitPrice !== "number" ||
    typeof o.quantity !== "number"
  ) {
    return null;
  }
  const repairTicketId =
    o.repairTicketId === null || o.repairTicketId === undefined
      ? null
      : String(o.repairTicketId);
  const productIdStr = String(o.productId ?? "");
  const parsedCustomId = customItemIdFromSaleProductId(productIdStr);

  let lineKind: SaleLine["lineKind"];
  if (o.lineKind === "custom" || parsedCustomId) {
    lineKind = "custom";
  } else if (o.lineKind === "product" || o.lineKind === "repair") {
    lineKind = o.lineKind;
  } else if (repairTicketId) {
    lineKind = "repair";
  } else {
    lineKind = o.sku === REPAIR_SALE_SKU ? "repair" : "product";
  }

  const note =
    o.note === null || o.note === undefined
      ? null
      : String(o.note).trim() || null;
  let taxable = true;
  if (o.taxable === false || o.taxable === true) {
    taxable = o.taxable;
  }
  const categoryLabel =
    o.categoryLabel === null || o.categoryLabel === undefined
      ? null
      : String(o.categoryLabel).trim() || null;

  const base = {
    productId: o.productId,
    name: o.name,
    sku: o.sku,
    unitPrice: o.unitPrice,
    quantity: Math.max(1, Math.floor(o.quantity)),
    lineKind,
    repairTicketId: lineKind === "repair" ? repairTicketId : null,
    note,
    taxable,
    categoryLabel,
  };

  if (lineKind === "custom") {
    return {
      ...base,
      customItemId: parsedCustomId ?? String(o.customItemId ?? ""),
      repairTicketId: null,
    };
  }

  return {
    ...base,
    customItemId: null,
  };
}

/** Shared parser for persisted repair snapshots (sales + repair payment history). */
export function parseSaleRepairCheckoutSnapshot(
  raw: unknown,
): SaleRepairCheckoutSnapshot | null {
  if (!isRecord(raw)) return null;
  const row = raw;
  const pricing = row.pricing;
  if (!isRecord(pricing)) return null;
  const laborSubtotal = Number(pricing.laborSubtotal);
  const partsSubtotal = Number(pricing.partsSubtotal);
  const repairSubtotalPreTax = Number(pricing.repairSubtotalPreTax);
  if (
    !Number.isFinite(laborSubtotal) ||
    !Number.isFinite(partsSubtotal) ||
    !Number.isFinite(repairSubtotalPreTax)
  ) {
    return null;
  }
  const ticketId = String(row.linkedRepairTicketId ?? "");
  if (!ticketId) return null;
  const partsUsed: SaleRepairCheckoutSnapshot["partsUsed"] = [];
  if (Array.isArray(row.partsUsed)) {
    for (const p of row.partsUsed) {
      if (!isRecord(p)) continue;
      if (
        typeof p.id === "string" &&
        typeof p.inventoryItemId === "string" &&
        typeof p.sku === "string" &&
        typeof p.name === "string" &&
        typeof p.unitPrice === "number" &&
        typeof p.unitCost === "number" &&
        typeof p.quantity === "number" &&
        typeof p.attachedAt === "string"
      ) {
        partsUsed.push({
          id: p.id,
          inventoryItemId: p.inventoryItemId,
          sku: p.sku,
          name: p.name,
          unitPrice: p.unitPrice,
          unitCost: p.unitCost,
          quantity: Math.max(0, Math.floor(p.quantity)),
          attachedAt: p.attachedAt,
        });
      }
    }
  }
  const customer = row.customer;
  const cust =
    isRecord(customer) &&
    typeof customer.name === "string" &&
    typeof customer.phone === "string" &&
    typeof customer.email === "string"
      ? {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        }
      : { name: "", phone: "", email: "" };
  let technician: SaleRepairCheckoutSnapshot["technician"] = null;
  const tech = row.technician;
  if (
    isRecord(tech) &&
    typeof tech.technicianId === "string" &&
    typeof tech.technicianName === "string"
  ) {
    technician = {
      technicianId: tech.technicianId,
      technicianName: tech.technicianName,
    };
  }
  return {
    linkedRepairTicketId: ticketId,
    repairTicketNumber: String(row.repairTicketNumber ?? ticketId),
    pricing: {
      laborSubtotal,
      partsSubtotal,
      repairSubtotalPreTax,
      laborNote:
        typeof pricing.laborNote === "string" && pricing.laborNote.trim()
          ? pricing.laborNote.trim()
          : undefined,
    },
    partsUsed,
    customer: cust,
    technician,
    deviceLabel: String(row.deviceLabel ?? ""),
  };
}

function parseRepairCheckouts(raw: unknown): SaleRepairCheckoutSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => parseSaleRepairCheckoutSnapshot(row))
    .filter((x): x is SaleRepairCheckoutSnapshot => x !== null);
}

function parseProcessor(
  raw: unknown,
): PaymentEntry["processedBy"] {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.employeeId === "string" &&
    typeof raw.name === "string"
  ) {
    return { employeeId: raw.employeeId, name: raw.name };
  }
  return null;
}

function parsePaymentEntry(
  raw: unknown,
  fallbackAt: string,
  idFallback?: string,
): PaymentEntry | null {
  if (!isRecord(raw)) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id
      : (idFallback ?? crypto.randomUUID());
  const methodRaw = typeof raw.method === "string" ? raw.method : "card";
  const method = normalizePaymentMethodLoose(methodRaw);
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const recordedAt =
    typeof raw.recordedAt === "string" ? raw.recordedAt : fallbackAt;
  const note =
    raw.note === null || raw.note === undefined
      ? null
      : String(raw.note);
  const noteTrimmed = note?.trim() ?? "";
  return {
    id,
    method,
    amount: roundCurrency(amount),
    recordedAt,
    processedBy: parseProcessor(raw.processedBy),
    note: noteTrimmed ? noteTrimmed : null,
  };
}

function buildPaymentsForSale(
  o: Record<string, unknown>,
  totalDue: number,
  createdAt: string,
  processedBy: SaleEmployeeRef | null,
): PaymentEntry[] {
  const rawPayments = o.payments;
  if (Array.isArray(rawPayments) && rawPayments.length > 0) {
    const out: PaymentEntry[] = [];
    for (let i = 0; i < rawPayments.length; i++) {
      const row = rawPayments[i];
      const p = parsePaymentEntry(
        row,
        createdAt,
        `pay-${String(o.id)}-${i}`,
      );
      if (p) out.push(p);
    }
    if (out.length > 0) return out;
  }

  const legacyMethod = normalizePaymentMethodLoose(
    o.paymentMethod != null ? String(o.paymentMethod) : "card",
  );
  return [
    {
      id: `legacy-pay-${String(o.id ?? "sale")}`,
      method: legacyMethod,
      amount: roundCurrency(totalDue),
      recordedAt: createdAt,
      processedBy: processedBy,
      note: null,
    },
  ];
}

/** Normalize sales loaded from persisted JSON (legacy rows without repair metadata). */
export function migrateSale(raw: unknown): Sale | null {
  if (!isRecord(raw)) return null;
  const o = raw;
  if (
    typeof o.id !== "string" ||
    typeof o.stationId !== "string" ||
    typeof o.storeId !== "string" ||
    typeof o.createdAt !== "string" ||
    typeof o.subtotal !== "number" ||
    typeof o.tax !== "number" ||
    typeof o.total !== "number"
  ) {
    return null;
  }
  const rawLines = o.lines;
  const lines: SaleLine[] = [];
  if (Array.isArray(rawLines)) {
    for (const line of rawLines) {
      const parsed = parseSaleLine(line);
      if (parsed) lines.push(parsed);
    }
  }
  const repairCheckouts = parseRepairCheckouts(o.repairCheckouts);
  const linkedRepairTicketIdRaw = o.linkedRepairTicketId;
  const linkedRepairTicketId =
    linkedRepairTicketIdRaw === null || linkedRepairTicketIdRaw === undefined
      ? repairCheckouts[0]?.linkedRepairTicketId ?? null
      : String(linkedRepairTicketIdRaw);

  let processedBy: Sale["processedBy"];
  const pb = o.processedBy;
  if (
    isRecord(pb) &&
    typeof pb.employeeId === "string" &&
    typeof pb.name === "string"
  ) {
    processedBy = { employeeId: pb.employeeId, name: pb.name };
  } else {
    processedBy = null;
  }

  const totalDue = o.total;
  const payments = buildPaymentsForSale(o, totalDue, o.createdAt, processedBy);
  const totalCollected = sumPaymentAmounts(payments);
  const { remainingBalance, changeDue } = computeCheckoutPaymentState(
    totalDue,
    payments,
  );
  const paymentMethod = salePaymentMethodSummary(payments);

  const customerId =
    o.customerId === null || o.customerId === undefined
      ? null
      : String(o.customerId);
  const snapRaw = o.customerSnapshot;
  let customerSnapshot: Sale["customerSnapshot"] = null;
  if (
    isRecord(snapRaw) &&
    typeof snapRaw.customerId === "string" &&
    typeof snapRaw.fullName === "string"
  ) {
    customerSnapshot = {
      customerId: snapRaw.customerId,
      fullName: snapRaw.fullName,
      phone: String(snapRaw.phone ?? ""),
      email: String(snapRaw.email ?? ""),
      company:
        snapRaw.company === null || snapRaw.company === undefined
          ? null
          : String(snapRaw.company),
    };
  }

  const sale: Sale = {
    id: o.id,
    stationId: o.stationId,
    storeId: o.storeId,
    createdAt: o.createdAt,
    lines,
    subtotal: o.subtotal,
    tax: o.tax,
    total: o.total,
    totalDue,
    totalCollected,
    remainingBalance,
    changeDue,
    payments,
    linkedRepairTicketId,
    repairCheckouts: repairCheckouts.length > 0 ? repairCheckouts : undefined,
    processedBy,
    paymentMethod,
    customerId: customerId || null,
    customerSnapshot,
  };
  return sale;
}
