import { deriveRepairPaymentState } from "@/lib/repair-payment-math";
import { repairPartsSubtotal } from "@/lib/repair-pricing";
import { parseSaleRepairCheckoutSnapshot } from "@/lib/sale-migrate";
import {
  emptyLiabilityWaiver,
  emptyPostInspection,
  emptyPreInspection,
  emptySignatureCapture,
} from "@/lib/repair-workflow-defaults";
import type {
  RepairLaborEstimate,
  RepairPartUsage,
} from "@/types/repair-parts";
import type {
  RepairNote,
  RepairPaymentLedgerEntry,
  RepairRefundLedgerEntry,
  RepairPaymentState,
  RepairPaymentSummary,
  RepairTicket,
  TechnicianAssignment,
} from "@/types/repairs";
import type {
  LiabilityWaiverAcceptance,
  PostInspectionChecklist,
  PreInspectionChecklist,
  SignatureCapture,
} from "@/types/repair-workflow";
import type { TicketWaiverSnapshot } from "@/types/waivers";
import { getSeedRepairWaiverTemplate } from "@/stores/waivers-store";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseNotes(raw: unknown): RepairNote[] {
  if (!Array.isArray(raw)) return [];
  const out: RepairNote[] = [];
  for (const n of raw) {
    if (!isRecord(n)) continue;
    if (
      typeof n.id === "string" &&
      typeof n.ticketId === "string" &&
      typeof n.body === "string" &&
      typeof n.createdAt === "string" &&
      typeof n.authorEmployeeId === "string" &&
      typeof n.authorName === "string"
    ) {
      out.push({
        id: n.id,
        ticketId: n.ticketId,
        body: n.body,
        createdAt: n.createdAt,
        authorEmployeeId: n.authorEmployeeId,
        authorName: n.authorName,
      });
    }
  }
  return out;
}

function parseRefundHistory(raw: unknown): RepairRefundLedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RepairRefundLedgerEntry[] = [];
  for (const r of raw) {
    if (!isRecord(r)) continue;
    if (
      typeof r.refundId === "string" &&
      typeof r.saleId === "string" &&
      typeof r.refundedAt === "string"
    ) {
      const summaryRaw = r.summary;
      const total = Number(
        isRecord(summaryRaw) ? summaryRaw.refundedCollectedTotal : NaN,
      );
      if (Number.isFinite(total)) {
        const ak = r.refundAuthorizationKind;
        const authKindOk = ak === "direct" || ak === "manager_pin";
        out.push({
          refundId: r.refundId,
          saleId: r.saleId,
          refundedAt: r.refundedAt,
          summary: { refundedCollectedTotal: Math.max(0, total) },
          ...(authKindOk ? { refundAuthorizationKind: ak } : {}),
          ...(typeof r.refundApprovedByEmployeeId === "string"
            ? { refundApprovedByEmployeeId: r.refundApprovedByEmployeeId }
            : {}),
          ...(typeof r.refundApprovedByName === "string"
            ? { refundApprovedByName: r.refundApprovedByName }
            : {}),
          ...(typeof r.refundManagerPinVerifiedAt === "string"
            ? { refundManagerPinVerifiedAt: r.refundManagerPinVerifiedAt }
            : {}),
        });
      }
    }
  }
  return out;
}

function parseAssignment(raw: unknown): TechnicianAssignment | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const a = raw;
  if (
    typeof a.technicianId === "string" &&
    typeof a.technicianName === "string" &&
    typeof a.assignedAt === "string"
  ) {
    return {
      technicianId: a.technicianId,
      technicianName: a.technicianName,
      assignedAt: a.assignedAt,
    };
  }
  return null;
}

function mergePre(raw: unknown): PreInspectionChecklist {
  const d = emptyPreInspection();
  if (!isRecord(raw)) return d;
  return { ...d, ...(raw as Partial<PreInspectionChecklist>) };
}

function mergePost(raw: unknown): PostInspectionChecklist {
  const d = emptyPostInspection();
  if (!isRecord(raw)) return d;
  return { ...d, ...(raw as Partial<PostInspectionChecklist>) };
}

function mergeWaiver(raw: unknown): LiabilityWaiverAcceptance {
  const d = emptyLiabilityWaiver();
  if (!isRecord(raw)) return d;
  return { ...d, ...(raw as Partial<LiabilityWaiverAcceptance>) };
}

function mergeSignature(raw: unknown): SignatureCapture {
  const d = emptySignatureCapture();
  if (!isRecord(raw)) return d;
  return { ...d, ...(raw as Partial<SignatureCapture>) };
}

function parseWaiverTemplateSnapshot(
  raw: unknown,
): TicketWaiverSnapshot | null {
  if (!isRecord(raw)) return null;
  const o = raw;
  if (typeof o.templateId !== "string") return null;
  if (typeof o.title !== "string") return null;
  if (typeof o.body !== "string") return null;
  if (typeof o.acceptedAt !== "string") return null;

  const category = o.category;
  if (
    category !== "repair" &&
    category !== "diagnostics" &&
    category !== "water_damage" &&
    category !== "data_loss" &&
    category !== "storage_policy" &&
    category !== "custom"
  ) {
    return null;
  }

  const version = Number(o.templateVersion);
  if (!Number.isFinite(version) || version < 0) return null;

  return {
    templateId: o.templateId,
    templateVersion: Math.floor(version),
    title: o.title,
    category,
    body: o.body,
    acceptedAt: o.acceptedAt,
    signature: mergeSignature(o.signature),
  };
}

function mergeLabor(
  raw: unknown,
  fallbackLaborAmount: number,
): RepairLaborEstimate {
  if (
    isRecord(raw) &&
    typeof raw.amount === "number" &&
    Number.isFinite(raw.amount)
  ) {
    return {
      amount: Math.max(0, raw.amount),
      note:
        typeof raw.note === "string" && raw.note.trim()
          ? raw.note.trim()
          : undefined,
    };
  }
  return { amount: Math.max(0, fallbackLaborAmount), note: "" };
}

function parseRepairPaymentState(raw: unknown): RepairPaymentState {
  if (raw === "paid" || raw === "partially_paid" || raw === "unpaid") {
    return raw;
  }
  if (raw === "ready_for_payment") return "unpaid";
  return "unpaid";
}

function parsePaymentSummary(raw: unknown): RepairPaymentSummary | null {
  if (!isRecord(raw)) return null;
  const laborSubtotal = Number(raw.laborSubtotal);
  const partsSubtotal = Number(raw.partsSubtotal);
  const repairSubtotalPreTax = Number(raw.repairSubtotalPreTax);
  const collectedTotal = Number(raw.collectedTotal);
  const taxAllocated = Number(raw.taxAllocated);
  if (
    !Number.isFinite(laborSubtotal) ||
    !Number.isFinite(partsSubtotal) ||
    !Number.isFinite(repairSubtotalPreTax) ||
    !Number.isFinite(collectedTotal) ||
    !Number.isFinite(taxAllocated)
  ) {
    return null;
  }
  return {
    laborSubtotal,
    partsSubtotal,
    repairSubtotalPreTax,
    collectedTotal,
    taxAllocated,
  };
}

function parsePaymentHistory(raw: unknown): RepairPaymentLedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RepairPaymentLedgerEntry[] = [];
  for (const row of raw) {
    if (!isRecord(row)) continue;
    if (
      typeof row.saleId !== "string" ||
      typeof row.paidAt !== "string"
    ) {
      continue;
    }
    const summary = parsePaymentSummary(row.summary);
    const snapshot = parseSaleRepairCheckoutSnapshot(row.snapshot);
    if (!summary || !snapshot) continue;
    out.push({
      saleId: row.saleId,
      paidAt: row.paidAt,
      summary,
      snapshot,
    });
  }
  return out;
}

function mergeParts(raw: unknown): RepairPartUsage[] {
  if (!Array.isArray(raw)) return [];
  const out: RepairPartUsage[] = [];
  for (const p of raw) {
    if (!isRecord(p)) continue;
    if (
      typeof p.id === "string" &&
      typeof p.ticketId === "string" &&
      typeof p.inventoryItemId === "string" &&
      typeof p.sku === "string" &&
      typeof p.name === "string" &&
      typeof p.unitPrice === "number" &&
      typeof p.unitCost === "number" &&
      typeof p.quantity === "number" &&
      typeof p.attachedAt === "string"
    ) {
      out.push({
        id: p.id,
        ticketId: p.ticketId,
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
  return out;
}

/** Normalize tickets loaded from persisted JSON (handles legacy shapes). */
export function migrateRepairTicket(raw: unknown): RepairTicket | null {
  if (!isRecord(raw)) return null;

  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "");
  if (!id) return null;

  const legacyEstimate = Number(o.estimatedPrice ?? 0);
  const partsUsage = mergeParts(o.partsUsage);
  const laborEstimate = mergeLabor(o.laborEstimate, legacyEstimate);
  const partsSub = repairPartsSubtotal(partsUsage);
  const estimatedPrice = laborEstimate.amount + partsSub;

  const repairPaymentState = parseRepairPaymentState(o.repairPaymentState);

  const paidAt =
    o.paidAt === null || o.paidAt === undefined
      ? null
      : String(o.paidAt);
  const linkedSaleId =
    o.linkedSaleId === null || o.linkedSaleId === undefined
      ? null
      : String(o.linkedSaleId);

  const paymentSummary = parsePaymentSummary(o.paymentSummary);
  const paymentHistory = parsePaymentHistory(o.paymentHistory);

  const linkedCustomerId =
    o.linkedCustomerId === null || o.linkedCustomerId === undefined
      ? null
      : String(o.linkedCustomerId);

  let ticket: RepairTicket = {
    id,
    linkedCustomerId,
    customerName: String(o.customerName ?? ""),
    phone: String(o.phone ?? ""),
    email: String(o.email ?? ""),
    deviceType: (o.deviceType ?? "phone") as RepairTicket["deviceType"],
    brandModel: String(o.brandModel ?? ""),
    issueDescription: String(o.issueDescription ?? ""),
    intakeDate: String(o.intakeDate ?? ""),
    status: (o.status ?? "intake") as RepairTicket["status"],
    assignment: parseAssignment(o.assignment),
    estimatedPrice,
    laborEstimate,
    partsUsage,
    notes: parseNotes(o.notes),
    createdAt: String(o.createdAt ?? new Date().toISOString()),
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
    preInspection: mergePre(o.preInspection),
    postInspection: mergePost(o.postInspection),
    liabilityWaiver: mergeWaiver(o.liabilityWaiver),
    waiverTemplateSnapshot: parseWaiverTemplateSnapshot(
      o.waiverTemplateSnapshot,
    ),
    customerSignature: mergeSignature(o.customerSignature),
    signedAt:
      o.signedAt === null || o.signedAt === undefined
        ? null
        : String(o.signedAt),
    repairPaymentState,
    paidAt,
    linkedSaleId,
    paymentSummary,
    paymentHistory,
    refundHistory: parseRefundHistory(o.refundHistory),
  };

  if (ticket.paymentHistory.length === 0) {
    ticket = {
      ...ticket,
      linkedSaleId: null,
      paymentSummary: null,
    };
  } else {
    const last = ticket.paymentHistory[ticket.paymentHistory.length - 1]!;
    ticket = {
      ...ticket,
      linkedSaleId: last.saleId,
      paymentSummary: last.summary,
    };
  }

  const { state, paidAt: derivedPaidAt } = deriveRepairPaymentState(ticket);

  // Legacy/seed tickets do not store template snapshots yet. For legal continuity,
  // populate a snapshot using the currently seeded default repair waiver.
  if (!ticket.waiverTemplateSnapshot) {
    const acceptedAt = ticket.liabilityWaiver.acceptedAt ?? ticket.signedAt;
    if (acceptedAt) {
      const seed = getSeedRepairWaiverTemplate();
      ticket = {
        ...ticket,
        waiverTemplateSnapshot: {
          templateId: seed.id,
          templateVersion: seed.version,
          title: seed.title,
          category: seed.category,
          body: seed.body,
          acceptedAt,
          signature: ticket.customerSignature,
        },
      };
    }
  }
  return {
    ...ticket,
    repairPaymentState: state,
    paidAt: state === "paid" ? (derivedPaidAt ?? ticket.paidAt) : null,
  };
}
