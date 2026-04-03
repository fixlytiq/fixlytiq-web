import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { seedRepairTickets } from "@/data/seed-repair-tickets";
import { repairTicketWithSyncedEstimate } from "@/lib/repair-pricing";
import { deriveRepairPaymentState } from "@/lib/repair-payment-math";
import { waiverFullyAcknowledged } from "@/lib/repair-intake-validation";
import { migrateRepairTicket } from "@/lib/repair-ticket-migrate";
import { emptyPostInspection } from "@/lib/repair-workflow-defaults";
import { newRepairTicketId } from "@/lib/repair-ticket-id";
import {
  REPAIR_PART_USAGE_STOCK_REASON,
  repairPartUsageAdjustmentNote,
} from "@/lib/repair-parts-inventory";
import { useEmployeesStore } from "@/stores/employees-store";
import { useInventoryStore } from "@/stores/inventory-store";
import type { RepairLaborEstimate, RepairPartUsage } from "@/types/repair-parts";
import type {
  DeviceType,
  PostInspectionChecklist,
  RepairNote,
  RepairPaymentLedgerEntry,
  RepairRefundLedgerEntry,
  RepairPaymentState,
  RepairPaymentSummary,
  RepairStatus,
  RepairTicket,
  TechnicianAssignment,
} from "@/types/repairs";
import type { RefundAuthorizationKind } from "@/types/refunds";
import type { SaleRepairCheckoutSnapshot } from "@/types/repair-sale-snapshot";
import type {
  LiabilityWaiverAcceptance,
  PreInspectionChecklist,
  SignatureCapture,
} from "@/types/repair-workflow";
import type { TicketWaiverSnapshot } from "@/types/waivers";

export type CreateRepairTicketInput = {
  linkedCustomerId?: string | null;
  customerName: string;
  phone: string;
  email: string;
  deviceType: DeviceType;
  brandModel: string;
  issueDescription: string;
  intakeDate: string;
  status: RepairStatus;
  assignment: TechnicianAssignment | null;
  estimatedPrice: number;
  preInspection: PreInspectionChecklist;
  liabilityWaiver: LiabilityWaiverAcceptance;
  waiverTemplateSnapshot: TicketWaiverSnapshot;
  customerSignature: SignatureCapture;
  signedAt: string;
};

export type RepairPartsEmployeeRef = {
  employeeId: string;
  name: string;
};

export type PartsActionResult = { ok: true } | { ok: false; error: string };

export type RepairsStoreState = {
  tickets: RepairTicket[];
  selectedTicketId: string | null;
};

export type RepairPosPrepResult =
  | { ok: true }
  | { ok: false; error: string };

export type RepairsStoreActions = {
  setSelectedTicketId: (id: string | null) => void;
  createTicket: (input: CreateRepairTicketInput) => string;
  updateTicketStatus: (ticketId: string, status: RepairStatus) => void;
  assignTechnician: (
    ticketId: string,
    technicianId: string | null,
  ) => void;
  addInternalNote: (
    ticketId: string,
    body: string,
    author: { employeeId: string; name: string },
  ) => void;
  savePostInspection: (
    ticketId: string,
    post: PostInspectionChecklist,
  ) => void;
  /** Update intake waiver acknowledgements (all must be true to mark accepted). */
  updateLiabilityWaiver: (
    ticketId: string,
    waiver: LiabilityWaiverAcceptance,
  ) => void;
  setLaborEstimate: (
    ticketId: string,
    labor: RepairLaborEstimate,
  ) => void;
  attachRepairPart: (
    ticketId: string,
    inventoryItemId: string,
    quantity: number,
    by: RepairPartsEmployeeRef,
  ) => PartsActionResult;
  updateRepairPartQuantity: (
    ticketId: string,
    usageId: string,
    newQuantity: number,
    by: RepairPartsEmployeeRef,
  ) => PartsActionResult;
  removeRepairPart: (
    ticketId: string,
    usageId: string,
    by: RepairPartsEmployeeRef,
  ) => PartsActionResult;
  /** Validates ticket before adding a repair line to the POS cart. */
  prepareRepairForPosCheckout: (ticketId: string) => RepairPosPrepResult;
  /** After POS Charge: mark ticket paid, link sale, append ledger + snapshot. */
  markRepairPaidFromPosSale: (
    ticketId: string,
    payload: {
      saleId: string;
      paidAt: string;
      snapshot: SaleRepairCheckoutSnapshot;
      paymentSummary: RepairPaymentSummary;
    },
  ) => void;
  /** Manual override (e.g. correction) — prefer POS flow for normal collection. */
  setRepairPaymentState: (
    ticketId: string,
    state: RepairPaymentState,
  ) => void;
  /**
   * Record a refund against a POS sale line that was tied to this repair ticket.
   * Updates `refundHistory` and net payment/refund state via `deriveRepairPaymentState`.
   */
  recordRepairRefundFromSale: (
    ticketId: string,
    payload: {
      refundId: string;
      saleId: string;
      refundedAt: string;
      refundSummary: {
        refundedCollectedTotal: number;
      };
      refundAuthorizationKind?: RefundAuthorizationKind;
      refundApprovedByEmployeeId?: string | null;
      refundApprovedByName?: string | null;
      refundManagerPinVerifiedAt?: string | null;
    },
  ) => void;
  /** Link ticket to Customers module and refresh intake name/phone/email snapshot. */
  updateTicketCustomerLink: (
    ticketId: string,
    payload: {
      linkedCustomerId: string | null;
      customerName: string;
      phone: string;
      email: string;
    },
  ) => void;
};

export type RepairsStore = RepairsStoreState & RepairsStoreActions;

function touchTicket(t: RepairTicket): RepairTicket {
  return { ...t, updatedAt: new Date().toISOString() };
}

function performUpdateRepairPartQuantity(
  allTickets: RepairTicket[],
  ticketId: string,
  usageId: string,
  newQuantity: number,
  by: RepairPartsEmployeeRef,
): { ok: true; tickets: RepairTicket[] } | { ok: false; error: string } {
  const n = Math.floor(newQuantity);
  if (n < 1) {
    return { ok: false, error: "Use Remove to delete a part line." };
  }
  const ticket = allTickets.find((t) => t.id === ticketId);
  if (!ticket) return { ok: false, error: "Ticket not found." };
  const line = ticket.partsUsage.find((u) => u.id === usageId);
  if (!line) return { ok: false, error: "Part line not found." };
  const delta = n - line.quantity;
  if (delta === 0) return { ok: true, tickets: allTickets };

  const inv = useInventoryStore
    .getState()
    .items.find((i) => i.id === line.inventoryItemId);
  if (!inv) return { ok: false, error: "Inventory item missing." };

  const invActions = useInventoryStore.getState();
  if (delta > 0) {
    if (delta > inv.quantityOnHand) {
      return {
        ok: false,
        error: `Only ${inv.quantityOnHand} more on hand.`,
      };
    }
    const r = invActions.recordStockRemove(
      line.inventoryItemId,
      delta,
      REPAIR_PART_USAGE_STOCK_REASON,
      repairPartUsageAdjustmentNote({
        ticketId,
        sku: line.sku,
        name: line.name,
        action: "increase_qty",
        quantity: delta,
      }),
      by,
    );
    if (!r.ok) return r;
  } else {
    const back = -delta;
    const r = invActions.recordStockAdd(
      line.inventoryItemId,
      back,
      REPAIR_PART_USAGE_STOCK_REASON,
      repairPartUsageAdjustmentNote({
        ticketId,
        sku: line.sku,
        name: line.name,
        action: "decrease_qty",
        quantity: back,
      }),
      by,
    );
    if (!r.ok) return r;
  }

  const tickets = allTickets.map((t) => {
    if (t.id !== ticketId) return t;
    const partsUsage = t.partsUsage.map((u) =>
      u.id === usageId ? { ...u, quantity: n } : u,
    );
    return touchTicket(
      repairTicketWithSyncedEstimate({ ...t, partsUsage }),
    );
  });
  return { ok: true, tickets };
}

export const useRepairsStore = create<RepairsStore>()(
  persist(
    (set, get) => ({
      tickets: seedRepairTickets.map((t) => ({ ...t })),
      selectedTicketId: null,

      setSelectedTicketId: (id) => set({ selectedTicketId: id }),

      createTicket: (input) => {
        const id = newRepairTicketId();
        const created = new Date().toISOString();
        const signed = input.signedAt;
        const labor: RepairLaborEstimate = {
          amount: input.estimatedPrice,
          note: "",
        };
        const base: RepairTicket = {
          id,
          linkedCustomerId: input.linkedCustomerId ?? null,
          customerName: input.customerName.trim(),
          phone: input.phone.trim(),
          email: input.email.trim(),
          deviceType: input.deviceType,
          brandModel: input.brandModel.trim(),
          issueDescription: input.issueDescription.trim(),
          intakeDate: input.intakeDate,
          status: input.status,
          assignment: input.assignment,
          estimatedPrice: input.estimatedPrice,
          laborEstimate: labor,
          partsUsage: [],
          notes: [],
          createdAt: created,
          updatedAt: created,
          preInspection: input.preInspection,
          postInspection: emptyPostInspection(),
          liabilityWaiver: {
            ...input.liabilityWaiver,
            accepted: true,
            acceptedAt: signed,
          },
          waiverTemplateSnapshot: input.waiverTemplateSnapshot,
          customerSignature: input.customerSignature,
          signedAt: signed,
          repairPaymentState: "unpaid",
          paidAt: null,
          linkedSaleId: null,
          paymentSummary: null,
          paymentHistory: [],
          refundHistory: [],
        };
        const ticket = repairTicketWithSyncedEstimate(base);
        set((s) => ({ tickets: [ticket, ...s.tickets] }));
        return id;
      },

      updateTicketStatus: (ticketId, status) => {
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId ? touchTicket({ ...t, status }) : t,
          ),
        }));
      },

      assignTechnician: (ticketId, technicianId) => {
        const assignedAt = new Date().toISOString();
        set((s) => ({
          tickets: s.tickets.map((t) => {
            if (t.id !== ticketId) return t;
            if (technicianId === null) {
              return touchTicket({ ...t, assignment: null });
            }
            const tech = useEmployeesStore
              .getState()
              .employees.find((e) => e.id === technicianId && e.active);
            if (!tech) return t;
            const assignment: TechnicianAssignment = {
              technicianId: tech.id,
              technicianName: tech.name,
              assignedAt,
            };
            return touchTicket({ ...t, assignment });
          }),
        }));
      },

      addInternalNote: (ticketId, body, author) => {
        const trimmed = body.trim();
        if (!trimmed) return;
        const note: RepairNote = {
          id: crypto.randomUUID(),
          ticketId,
          body: trimmed,
          createdAt: new Date().toISOString(),
          authorEmployeeId: author.employeeId,
          authorName: author.name,
        };
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? touchTicket({ ...t, notes: [...t.notes, note] })
              : t,
          ),
        }));
      },

      savePostInspection: (ticketId, post) => {
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId ? touchTicket({ ...t, postInspection: post }) : t,
          ),
        }));
      },

      updateLiabilityWaiver: (ticketId, waiver) => {
        const full = waiverFullyAcknowledged(waiver);
        const normalized: LiabilityWaiverAcceptance = {
          dataLossDisclaimer: waiver.dataLossDisclaimer,
          preExistingDamageDisclaimer: waiver.preExistingDamageDisclaimer,
          waterproofingDisclaimer: waiver.waterproofingDisclaimer,
          partsDisclaimer: waiver.partsDisclaimer,
          warrantyPolicyAck: waiver.warrantyPolicyAck,
          accepted: full,
          acceptedAt: full ? new Date().toISOString() : null,
        };
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? touchTicket({ ...t, liabilityWaiver: normalized })
              : t,
          ),
        }));
      },

      setLaborEstimate: (ticketId, labor) => {
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? touchTicket(
                  repairTicketWithSyncedEstimate({
                    ...t,
                    laborEstimate: {
                      amount: Math.max(0, labor.amount),
                      note: labor.note?.trim() || undefined,
                    },
                  }),
                )
              : t,
          ),
        }));
      },

      updateRepairPartQuantity: (ticketId, usageId, newQuantity, by) => {
        const r = performUpdateRepairPartQuantity(
          get().tickets,
          ticketId,
          usageId,
          newQuantity,
          by,
        );
        if (!r.ok) return r;
        set({ tickets: r.tickets });
        return { ok: true };
      },

      removeRepairPart: (ticketId, usageId, by) => {
        const ticket = get().tickets.find((t) => t.id === ticketId);
        if (!ticket) return { ok: false, error: "Ticket not found." };
        const line = ticket.partsUsage.find((u) => u.id === usageId);
        if (!line) return { ok: false, error: "Part line not found." };

        const r = useInventoryStore.getState().recordStockAdd(
          line.inventoryItemId,
          line.quantity,
          REPAIR_PART_USAGE_STOCK_REASON,
          repairPartUsageAdjustmentNote({
            ticketId,
            sku: line.sku,
            name: line.name,
            action: "remove_from_ticket",
            quantity: line.quantity,
          }),
          by,
        );
        if (!r.ok) return r;

        set((s) => ({
          tickets: s.tickets.map((t) => {
            if (t.id !== ticketId) return t;
            const partsUsage = t.partsUsage.filter((u) => u.id !== usageId);
            return touchTicket(
              repairTicketWithSyncedEstimate({ ...t, partsUsage }),
            );
          }),
        }));
        return { ok: true };
      },

      attachRepairPart: (ticketId, inventoryItemId, quantity, by) => {
        const q = Math.floor(quantity);
        if (q < 1) {
          return { ok: false, error: "Quantity must be at least 1." };
        }
        const ticket = get().tickets.find((t) => t.id === ticketId);
        if (!ticket) return { ok: false, error: "Ticket not found." };

        const inv = useInventoryStore
          .getState()
          .items.find((i) => i.id === inventoryItemId);
        if (!inv) return { ok: false, error: "Part not found in inventory." };

        const existing = ticket.partsUsage.find(
          (p) => p.inventoryItemId === inventoryItemId,
        );
        if (existing) {
          const r = performUpdateRepairPartQuantity(
            get().tickets,
            ticketId,
            existing.id,
            existing.quantity + q,
            by,
          );
          if (!r.ok) return r;
          set({ tickets: r.tickets });
          return { ok: true };
        }

        if (q > inv.quantityOnHand) {
          return {
            ok: false,
            error: `Only ${inv.quantityOnHand} on hand for ${inv.sku}.`,
          };
        }

        const stock = useInventoryStore.getState().recordStockRemove(
          inventoryItemId,
          q,
          REPAIR_PART_USAGE_STOCK_REASON,
          repairPartUsageAdjustmentNote({
            ticketId,
            sku: inv.sku,
            name: inv.name,
            action: "attach",
            quantity: q,
          }),
          by,
        );
        if (!stock.ok) return stock;

        const line: RepairPartUsage = {
          id: crypto.randomUUID(),
          ticketId,
          inventoryItemId,
          sku: inv.sku,
          name: inv.name,
          unitPrice: inv.salePrice,
          unitCost: inv.costPrice,
          quantity: q,
          attachedAt: new Date().toISOString(),
        };

        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? touchTicket(
                  repairTicketWithSyncedEstimate({
                    ...t,
                    partsUsage: [...t.partsUsage, line],
                  }),
                )
              : t,
          ),
        }));
        return { ok: true };
      },

      prepareRepairForPosCheckout: (ticketId) => {
        const ticket = get().tickets.find((t) => t.id === ticketId);
        if (!ticket) return { ok: false, error: "Ticket not found." };
        if (ticket.repairPaymentState === "paid") {
          return { ok: false, error: "This repair is already paid." };
        }
        if (ticket.status !== "ready" && ticket.status !== "closed") {
          return {
            ok: false,
            error: "Set status to Ready or Closed before checkout.",
          };
        }
        return { ok: true };
      },

      markRepairPaidFromPosSale: (ticketId, payload) => {
        const entry: RepairPaymentLedgerEntry = {
          saleId: payload.saleId,
          paidAt: payload.paidAt,
          summary: payload.paymentSummary,
          snapshot: payload.snapshot,
        };
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? (() => {
                  const history = [...t.paymentHistory, entry];
                  const next: RepairTicket = {
                    ...t,
                    linkedSaleId: payload.saleId,
                    paymentSummary: payload.paymentSummary,
                    paymentHistory: history,
                  };
                  const { state, paidAt } = deriveRepairPaymentState(next);
                  return touchTicket({
                    ...next,
                    repairPaymentState: state,
                    paidAt,
                  });
                })()
              : t,
          ),
        }));
      },

      recordRepairRefundFromSale: (ticketId, payload) => {
        const entry: RepairRefundLedgerEntry = {
          refundId: payload.refundId,
          saleId: payload.saleId,
          refundedAt: payload.refundedAt,
          summary: {
            refundedCollectedTotal: Math.max(
              0,
              payload.refundSummary.refundedCollectedTotal,
            ),
          },
          refundAuthorizationKind: payload.refundAuthorizationKind,
          refundApprovedByEmployeeId: payload.refundApprovedByEmployeeId,
          refundApprovedByName: payload.refundApprovedByName,
          refundManagerPinVerifiedAt: payload.refundManagerPinVerifiedAt,
        };

        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? (() => {
                  const next: RepairTicket = {
                    ...t,
                    refundHistory: [...t.refundHistory, entry],
                  };
                  const { state, paidAt } = deriveRepairPaymentState(next);
                  return touchTicket({
                    ...next,
                    repairPaymentState: state,
                    paidAt,
                  });
                })()
              : t,
          ),
        }));
      },

      updateTicketCustomerLink: (ticketId, payload) => {
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? touchTicket({
                  ...t,
                  linkedCustomerId: payload.linkedCustomerId,
                  customerName: payload.customerName.trim(),
                  phone: payload.phone.trim(),
                  email: payload.email.trim(),
                })
              : t,
          ),
        }));
      },

      setRepairPaymentState: (ticketId, state) => {
        set((s) => ({
          tickets: s.tickets.map((t) => {
            if (t.id !== ticketId) return t;
            switch (state) {
              case "paid":
                return touchTicket({
                  ...t,
                  repairPaymentState: "paid",
                  paidAt: t.paidAt ?? new Date().toISOString(),
                });
              case "partially_paid":
                return touchTicket({
                  ...t,
                  repairPaymentState: "partially_paid",
                  paidAt: null,
                });
              case "unpaid":
                return touchTicket({
                  ...t,
                  repairPaymentState: "unpaid",
                  paidAt: null,
                  linkedSaleId: null,
                  paymentSummary: null,
                  paymentHistory: [],
                  refundHistory: [],
                });
              default: {
                const _exhaustive: never = state;
                void _exhaustive;
                return t;
              }
            }
          }),
        }));
      },
    }),
    {
      name: "fixlytiq-repairs",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tickets: state.tickets }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<RepairsStoreState> | undefined;
        const raw = p?.tickets;
        const tickets = Array.isArray(raw)
          ? raw
              .map((t) => migrateRepairTicket(t))
              .filter((t): t is RepairTicket => t !== null)
          : current.tickets;
        return { ...current, tickets };
      },
    },
  ),
);
