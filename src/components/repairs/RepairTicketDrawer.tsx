"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { waiverFullyAcknowledged } from "@/lib/repair-intake-validation";
import { repairTechnicianCandidates } from "@/lib/repair-technician-options";
import {
  refundManagerPinHint,
  refundSignInBlockedMessage,
  roleCanEditRepairLiabilityWaiver,
} from "@/lib/rbac";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { repairPricingSummary } from "@/lib/repair-pricing";
import { paymentMethodLabel } from "@/lib/payment-totals";
import { cartIncludesRepairTicket } from "@/lib/pos-cart";
import { repairPaymentTotals } from "@/lib/repair-payment-math";
import { useInventoryStore } from "@/stores/inventory-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { usePosStore } from "@/stores/pos-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { useSessionStore } from "@/stores/session-store";
import { useTransactionUiStore } from "@/stores/transaction-ui-store";
import { useRefundsStore } from "@/stores/refunds-store";
import { CreateRefundModal } from "@/components/refunds/CreateRefundModal";
import { RefundCreateButton } from "@/components/refunds/RefundCreateButton";
import { CustomerPicker } from "@/components/customers/CustomerPicker";
import {
  DEVICE_TYPE_OPTIONS,
  REPAIR_PAYMENT_STATE_LABELS,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  type RepairStatus,
} from "@/types/repairs";
import {
  DEVICE_CONDITION_OPTIONS,
  YES_NO_UNKNOWN_OPTIONS,
  deviceConditionLabel,
  yesNoUnknownLabel,
  type DeviceConditionOption,
  type LiabilityWaiverAcceptance,
  type PostInspectionChecklist,
  type YesNoUnknown,
} from "@/types/repair-workflow";

function deviceTypeLabel(id: string): string {
  return DEVICE_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

function Row({
  k,
  v,
}: {
  k: string;
  v: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-right text-zinc-200 sm:text-left">{v}</dd>
    </div>
  );
}

export type RepairTicketDrawerProps = {
  ticketId: string | null;
  onClose: () => void;
};

export function RepairTicketDrawer({
  ticketId,
  onClose,
}: RepairTicketDrawerProps) {
  const router = useRouter();
  const tickets = useRepairsStore((s) => s.tickets);
  const updateTicketStatus = useRepairsStore((s) => s.updateTicketStatus);
  const assignTechnician = useRepairsStore((s) => s.assignTechnician);
  const addInternalNote = useRepairsStore((s) => s.addInternalNote);
  const savePostInspection = useRepairsStore((s) => s.savePostInspection);
  const updateLiabilityWaiver = useRepairsStore((s) => s.updateLiabilityWaiver);
  const updateTicketCustomerLink = useRepairsStore(
    (s) => s.updateTicketCustomerLink,
  );
  const setLaborEstimate = useRepairsStore((s) => s.setLaborEstimate);
  const attachRepairPart = useRepairsStore((s) => s.attachRepairPart);
  const updateRepairPartQuantity = useRepairsStore(
    (s) => s.updateRepairPartQuantity,
  );
  const removeRepairPart = useRepairsStore((s) => s.removeRepairPart);
  const addRepairCheckoutLine = usePosStore((s) => s.addRepairCheckoutLine);
  const posCart = usePosStore((s) => s.cart);
  const recentSales = usePosStore((s) => s.recentSales);
  const refunds = useRefundsStore((s) => s.refunds);
  const openTransactionDetail = useTransactionUiStore(
    (s) => s.openTransactionDetail,
  );
  const inventoryItems = useInventoryStore((s) => s.items);
  const roster = useEmployeesStore((s) => s.employees);
  const employee = useSessionStore((s) => s.employee);
  const technicianOptions = useMemo(
    () => repairTechnicianCandidates(roster),
    [roster],
  );

  const ticket = useMemo(
    () => tickets.find((t) => t.id === ticketId) ?? null,
    [tickets, ticketId],
  );

  const [noteDraft, setNoteDraft] = useState("");
  const [postDraft, setPostDraft] = useState<PostInspectionChecklist | null>(
    null,
  );
  const [postSavedMsg, setPostSavedMsg] = useState(false);
  const [addPartId, setAddPartId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [laborAmountStr, setLaborAmountStr] = useState("");
  const [laborNoteStr, setLaborNoteStr] = useState("");
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [partsErr, setPartsErr] = useState<string | null>(null);
  const [posErr, setPosErr] = useState<string | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
  const [waiverEditing, setWaiverEditing] = useState(false);
  const [waiverDraft, setWaiverDraft] =
    useState<LiabilityWaiverAcceptance | null>(null);
  const [waiverErr, setWaiverErr] = useState<string | null>(null);

  const canEditWaiver = Boolean(
    employee && roleCanEditRepairLiabilityWaiver(employee.role),
  );

  const refundSignInBlocked = refundSignInBlockedMessage(employee);
  const refundPinHint = refundManagerPinHint(employee);

  const pricing = useMemo(
    () => (ticket ? repairPricingSummary(ticket) : null),
    [ticket],
  );
  const paymentTotals = useMemo(
    () => (ticket ? repairPaymentTotals(ticket) : null),
    [ticket],
  );
  const repairInRegisterCart = useMemo(
    () =>
      ticket != null && cartIncludesRepairTicket(posCart, ticket.id),
    [ticket, posCart],
  );

  const refundsForTicket = useMemo(() => {
    if (!ticket) return [];
    const saleIds = new Set(ticket.paymentHistory.map((e) => e.saleId));
    return refunds.filter(
      (r) =>
        r.repairTicketId === ticket.id || saleIds.has(r.saleId),
    );
  }, [ticket, refunds]);

  const saleForRefund = useMemo(() => {
    if (!refundSaleId) return null;
    return recentSales.find((s) => s.id === refundSaleId) ?? null;
  }, [refundSaleId, recentSales]);

  const hasProductLineForRefund = useMemo(() => {
    if (!saleForRefund) return false;
    return saleForRefund.lines.some((l) => {
      const kind =
        l.lineKind ??
        (l.repairTicketId ? "repair" : l.customItemId ? "custom" : "product");
      return kind === "product";
    });
  }, [saleForRefund]);

  useEffect(() => {
    setNoteDraft("");
    setPostSavedMsg(false);
    setPartsErr(null);
    setPosErr(null);
    setRefundModalOpen(false);
    setRefundSaleId(null);
    setWaiverEditing(false);
    setWaiverDraft(null);
    setWaiverErr(null);
    setAddPartId("");
    setAddQty("1");
    if (ticket) {
      setPostDraft({ ...ticket.postInspection });
      setLaborAmountStr(String(ticket.laborEstimate.amount));
      setLaborNoteStr(ticket.laborEstimate.note ?? "");
      setRefundSaleId(
        ticket.linkedSaleId ??
          (ticket.paymentHistory[0]?.saleId ?? null),
      );
      const q: Record<string, string> = {};
      ticket.partsUsage.forEach((u) => {
        q[u.id] = String(u.quantity);
      });
      setQtyDraft(q);
    } else {
      setPostDraft(null);
      setLaborAmountStr("");
      setLaborNoteStr("");
      setQtyDraft({});
    }
  }, [ticketId, ticket]);

  useEffect(() => {
    if (!ticketId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ticketId, onClose]);

  const submitNote = useCallback(() => {
    if (!ticket || !employee) return;
    addInternalNote(ticket.id, noteDraft, {
      employeeId: employee.id,
      name: employee.name,
    });
    setNoteDraft("");
  }, [addInternalNote, employee, noteDraft, ticket]);

  const savePost = useCallback(() => {
    if (!ticket || !postDraft) return;
    savePostInspection(ticket.id, postDraft);
    setPostSavedMsg(true);
    window.setTimeout(() => setPostSavedMsg(false), 2500);
  }, [postDraft, savePostInspection, ticket]);

  const saveLabor = useCallback(() => {
    if (!ticket) return;
    const n = Number.parseFloat(laborAmountStr);
    if (!Number.isFinite(n) || n < 0) {
      setPartsErr("Enter a valid labor amount (0 or more).");
      return;
    }
    setPartsErr(null);
    setLaborEstimate(ticket.id, {
      amount: n,
      note: laborNoteStr.trim() || undefined,
    });
  }, [laborAmountStr, laborNoteStr, setLaborEstimate, ticket]);

  const submitAddPart = useCallback(() => {
    if (!ticket || !employee) return;
    setPartsErr(null);
    if (!addPartId) {
      setPartsErr("Select a part from inventory.");
      return;
    }
    const q = Number.parseInt(addQty, 10);
    if (!Number.isFinite(q) || q < 1) {
      setPartsErr("Quantity must be at least 1.");
      return;
    }
    const r = attachRepairPart(ticket.id, addPartId, q, {
      employeeId: employee.id,
      name: employee.name,
    });
    if (!r.ok) {
      setPartsErr(r.error);
      return;
    }
    setAddQty("1");
    setAddPartId("");
  }, [addPartId, addQty, attachRepairPart, employee, ticket]);

  const applyLineQty = useCallback(
    (usageId: string) => {
      if (!ticket || !employee) return;
      setPartsErr(null);
      const q = Number.parseInt(qtyDraft[usageId] ?? "1", 10);
      if (!Number.isFinite(q) || q < 1) {
        setPartsErr("Each line needs quantity ≥ 1 (or remove the line).");
        return;
      }
      const r = updateRepairPartQuantity(ticket.id, usageId, q, {
        employeeId: employee.id,
        name: employee.name,
      });
      if (!r.ok) setPartsErr(r.error);
    },
    [employee, qtyDraft, ticket, updateRepairPartQuantity],
  );

  const removeLine = useCallback(
    (usageId: string) => {
      if (!ticket || !employee) return;
      setPartsErr(null);
      const r = removeRepairPart(ticket.id, usageId, {
        employeeId: employee.id,
        name: employee.name,
      });
      if (!r.ok) setPartsErr(r.error);
    },
    [employee, removeRepairPart, ticket],
  );

  const processRepairPayment = useCallback(() => {
    if (!ticket) return;
    setPosErr(null);
    const r = addRepairCheckoutLine(ticket.id);
    if (!r.ok) {
      setPosErr(r.error);
      return;
    }
    router.push("/pos");
  }, [addRepairCheckoutLine, router, ticket]);

  const viewLinkedTransaction = useCallback(() => {
    if (!ticket?.linkedSaleId) return;
    openTransactionDetail(ticket.linkedSaleId);
  }, [openTransactionDetail, ticket?.linkedSaleId]);

  const sortedInventory = useMemo(
    () =>
      [...inventoryItems].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [inventoryItems],
  );

  const selectedAddPart = useMemo(
    () =>
      addPartId
        ? (sortedInventory.find((i) => i.id === addPartId) ?? null)
        : null,
    [sortedInventory, addPartId],
  );

  if (!ticketId || !ticket || !postDraft) return null;

  const fieldClass =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  const pre = ticket.preInspection;
  const w = ticket.liabilityWaiver;
  const sig = ticket.customerSignature;

  const condSelect = (
    label: string,
    value: DeviceConditionOption,
    onPick: (v: DeviceConditionOption) => void,
  ) => (
    <label className="block text-sm">
      <span className="text-zinc-500">{label}</span>
      <select
        className={fieldClass}
        value={value}
        onChange={(e) => onPick(e.target.value as DeviceConditionOption)}
      >
        {DEVICE_CONDITION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const ynSelect = (
    label: string,
    value: YesNoUnknown,
    onPick: (v: YesNoUnknown) => void,
  ) => (
    <label className="block text-sm">
      <span className="text-zinc-500">{label}</span>
      <select
        className={fieldClass}
        value={value}
        onChange={(e) => onPick(e.target.value as YesNoUnknown)}
      >
        {YES_NO_UNKNOWN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-ticket-id"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <p
              id="drawer-ticket-id"
              className="font-mono text-sm font-semibold text-emerald-400/90"
            >
              {ticket.id}
            </p>
            <p className="mt-1 truncate text-lg font-semibold text-zinc-100">
              {ticket.customerName}
            </p>
            <div className="mt-2">
              <StatusBadge status={ticket.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-pad shrink-0 rounded-xl border border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-400 active:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section className="space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Contact
            </h3>
            <dl className="grid gap-2 text-sm">
              <Row k="Phone" v={ticket.phone || "—"} />
              <Row k="Email" v={ticket.email || "—"} />
            </dl>
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Customer profile
            </h3>
            <p className="text-xs text-zinc-500">
              Link to the customer directory for history across repairs, orders,
              and sales.
            </p>
            <CustomerPicker
              selectedCustomerId={ticket.linkedCustomerId}
              createdBy={
                employee
                  ? { employeeId: employee.id, name: employee.name }
                  : null
              }
              onSelect={(c) =>
                updateTicketCustomerLink(ticket.id, {
                  linkedCustomerId: c.id,
                  customerName: c.fullName,
                  phone: c.phone,
                  email: c.email,
                })
              }
              onClear={() =>
                updateTicketCustomerLink(ticket.id, {
                  linkedCustomerId: null,
                  customerName: ticket.customerName,
                  phone: ticket.phone,
                  email: ticket.email,
                })
              }
            />
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Device & issue
            </h3>
            <dl className="grid gap-2 text-sm">
              <Row k="Type" v={deviceTypeLabel(ticket.deviceType)} />
              <Row k="Brand / model" v={ticket.brandModel} />
              <div>
                <dt className="text-zinc-500">Issue</dt>
                <dd className="text-zinc-300">{ticket.issueDescription}</dd>
              </div>
              <Row k="Intake date" v={ticket.intakeDate} />
            </dl>
          </section>

          <section className="mt-4 space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
              Pricing & parts
            </h3>
            {pricing ? (
              <div className="grid gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 text-sm">
                <div className="flex justify-between font-mono text-zinc-200">
                  <span>Labor estimate</span>
                  <span>${pricing.laborEstimate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-mono text-zinc-200">
                  <span>Parts subtotal</span>
                  <span>${pricing.partsSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-2 font-mono text-base font-semibold text-emerald-400">
                  <span>Estimated total</span>
                  <span>${pricing.estimatedTotal.toFixed(2)}</span>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Labor
              </p>
              <label className="block text-sm">
                <span className="text-zinc-500">Amount (USD)</span>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={laborAmountStr}
                  onChange={(e) => setLaborAmountStr(e.target.value)}
                  disabled={!employee}
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-500">Note</span>
                <input
                  className={fieldClass}
                  value={laborNoteStr}
                  onChange={(e) => setLaborNoteStr(e.target.value)}
                  disabled={!employee}
                  placeholder="Optional"
                />
              </label>
              <button
                type="button"
                disabled={!employee}
                onClick={saveLabor}
                className="touch-pad w-full min-h-10 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-sm font-semibold text-emerald-100 disabled:opacity-40"
              >
                Save labor
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Parts on ticket
              </p>
              {ticket.partsUsage.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No parts yet.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {ticket.partsUsage.map((u) => (
                    <li
                      key={u.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                    >
                      <p className="font-medium text-zinc-100">{u.name}</p>
                      <p className="font-mono text-xs text-zinc-500">
                        {u.sku} · ${u.unitPrice.toFixed(2)} ea
                      </p>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="text-sm">
                          <span className="text-zinc-500">Qty</span>
                          <input
                            className={`${fieldClass} w-20 font-mono`}
                            type="number"
                            min={1}
                            value={qtyDraft[u.id] ?? String(u.quantity)}
                            onChange={(e) =>
                              setQtyDraft((d) => ({
                                ...d,
                                [u.id]: e.target.value,
                              }))
                            }
                            disabled={!employee}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={!employee}
                          onClick={() => applyLineQty(u.id)}
                          className="touch-pad min-h-10 rounded-xl bg-zinc-800 px-3 text-sm font-semibold text-zinc-200 disabled:opacity-40"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          disabled={!employee}
                          onClick={() => removeLine(u.id)}
                          className="touch-pad min-h-10 rounded-xl border border-rose-500/35 px-3 text-sm font-semibold text-rose-300 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-2 font-mono text-sm text-emerald-400/90">
                        Line: ${(u.quantity * u.unitPrice).toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 border-t border-zinc-800/80 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Add from inventory
              </p>
              <label className="block text-sm">
                <span className="text-zinc-500">Part</span>
                <select
                  className={fieldClass}
                  value={addPartId}
                  onChange={(e) => setAddPartId(e.target.value)}
                  disabled={!employee}
                >
                  <option value="">Select SKU…</option>
                  {sortedInventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku}) — {i.quantityOnHand} on hand
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-500">Quantity</span>
                <input
                  className={`${fieldClass} font-mono`}
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  disabled={!employee}
                />
              </label>
              {selectedAddPart ? (
                <p className="text-xs text-zinc-500">
                  <span className="font-mono text-zinc-400">
                    {selectedAddPart.quantityOnHand}
                  </span>{" "}
                  on hand — you cannot attach more than this in one step.
                </p>
              ) : null}
              <button
                type="button"
                disabled={!employee}
                onClick={submitAddPart}
                className="touch-pad w-full min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40"
              >
                Add part
              </button>
              {!employee ? (
                <p className="text-xs text-zinc-500">
                  Sign in to change labor or parts (stock is adjusted).
                </p>
              ) : null}
              {partsErr ? (
                <p className="text-sm text-rose-400" role="alert">
                  {partsErr}
                </p>
              ) : null}
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Payment
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    ticket.repairPaymentState === "paid"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : ticket.repairPaymentState === "partially_paid"
                        ? "bg-sky-500/15 text-sky-200"
                        : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {REPAIR_PAYMENT_STATE_LABELS[ticket.repairPaymentState]}
                </span>
              </div>
              {repairInRegisterCart ? (
                <p className="text-[11px] font-medium text-amber-200/90">
                  This repair is in the register cart — complete or cancel
                  payment on POS.
                </p>
              ) : null}
              {paymentTotals ? (
                <div className="mt-2 grid gap-1 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2 font-mono text-[0.7rem] text-zinc-300">
                  <div className="flex justify-between gap-2">
                    <span>Estimate (pre-tax)</span>
                    <span>
                      ${paymentTotals.estimateTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Collected (pre-tax)</span>
                    <span>
                      ${paymentTotals.collectedTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-zinc-800 pt-1 text-emerald-300">
                    <span>Remaining (pre-tax)</span>
                    <span>
                      ${paymentTotals.remainingBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : null}
              {ticket.repairPaymentState === "paid" && ticket.paidAt ? (
                <div className="space-y-2 text-xs text-zinc-500">
                  <p>
                    Balance paid in full — last payment{" "}
                    {new Date(ticket.paidAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                  {ticket.paymentSummary ? (
                    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono text-[0.7rem] text-zinc-400">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                        Last transaction snapshot
                      </p>
                      <div className="flex justify-between gap-2">
                        <span>Labor</span>
                        <span>
                          ${ticket.paymentSummary.laborSubtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Parts</span>
                        <span>
                          ${ticket.paymentSummary.partsSubtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-t border-zinc-800/80 pt-1 text-zinc-300">
                        <span>Principal (this sale)</span>
                        <span>
                          $
                          {ticket.paymentSummary.collectedTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Use Process payment to add the{" "}
                  <span className="font-medium text-zinc-300">
                    remaining pre-tax balance
                  </span>{" "}
                  as one register line. You can run multiple checkouts until the
                  estimate is covered; each sale is linked below.
                </p>
              )}
              {ticket.paymentHistory.length > 0 &&
              ticket.repairPaymentState !== "paid" ? (
                <p className="text-[11px] text-sky-200/80">
                  {ticket.paymentHistory.length} linked transaction
                  {ticket.paymentHistory.length === 1 ? "" : "s"} — $
                  {paymentTotals?.collectedTotal.toFixed(2) ?? "0.00"} collected
                  toward estimate.
                </p>
              ) : null}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={processRepairPayment}
                  disabled={
                    ticket.repairPaymentState === "paid" ||
                    repairInRegisterCart ||
                    (paymentTotals?.remainingBalance ?? 0) <= 0 ||
                    (ticket.status !== "ready" && ticket.status !== "closed")
                  }
                  className="touch-pad w-full min-h-11 rounded-xl border border-amber-500/40 bg-amber-950/40 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {paymentTotals && paymentTotals.remainingBalance > 0
                    ? `Process payment ($${paymentTotals.remainingBalance.toFixed(2)} remaining)`
                    : "Process payment"}
                </button>
                {ticket.paymentHistory.length > 0 ? (
                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Linked transactions
                    </p>
                    <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs text-zinc-400">
                      {ticket.paymentHistory.map((entry) => {
                        const linkedSale = recentSales.find(
                          (s) => s.id === entry.saleId,
                        );
                        const pays = linkedSale?.payments ?? [];
                        const split = pays.length > 1;
                        return (
                          <li
                            key={entry.saleId}
                            className="space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-mono text-[11px] text-emerald-300">
                                  {entry.saleId.slice(0, 10)}…
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                  {new Date(
                                    entry.paidAt,
                                  ).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-mono text-[11px] text-zinc-200">
                                  ${entry.summary.collectedTotal.toFixed(2)}{" "}
                                  <span className="text-zinc-500">
                                    (pre-tax)
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openTransactionDetail(entry.saleId)
                                  }
                                  className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-800"
                                >
                                  View
                                </button>
                              </div>
                            </div>
                            {pays.length > 0 ? (
                              <div className="border-t border-zinc-800/80 pt-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                  {split
                                    ? `Split · ${pays.length} tenders`
                                    : "Tender"}
                                </p>
                                <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-zinc-400">
                                  {pays.map((p) => (
                                    <li
                                      key={p.id}
                                      className="flex justify-between gap-2"
                                    >
                                      <span>{paymentMethodLabel(p.method)}</span>
                                      <span>${p.amount.toFixed(2)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : linkedSale?.paymentMethod?.trim() ? (
                              <p className="border-t border-zinc-800/80 pt-1.5 text-[10px] text-zinc-500">
                                {linkedSale.paymentMethod}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-3 space-y-2 rounded-xl border border-zinc-800/90 bg-zinc-950/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Refunds
                    </p>
                    <RefundCreateButton
                      compact
                      signInBlockedMessage={refundSignInBlocked}
                      managerPinHint={refundPinHint}
                      prereqMet={Boolean(saleForRefund)}
                      prereqBlockedTitle="No checkout sale on file to refund."
                      onClick={() => setRefundModalOpen(true)}
                    />
                  </div>

                  {refundsForTicket.length === 0 ? (
                    <p className="text-xs text-zinc-500">No refunds yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {refundsForTicket.slice(0, 6).map((r) => (
                        <li
                          key={r.id}
                          className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-[11px] text-zinc-300">
                              {r.id.slice(0, 10)}…
                            </p>
                            <p className="font-mono text-[11px] text-zinc-500">
                              {new Date(r.createdAt).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-zinc-100">
                            ${r.summary.refundedTotal.toFixed(2)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {r.reason.replaceAll("_", " ")}
                            {r.restockedInventory ? " · restocked" : ""}
                            {r.authorizationKind === "manager_pin" &&
                            r.managerPinApproval ? (
                              <>
                                {" "}
                                · PIN: {r.managerPinApproval.managerName}
                              </>
                            ) : null}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {ticket.linkedSaleId ? (
                  <button
                    type="button"
                    onClick={viewLinkedTransaction}
                    className="touch-pad w-full rounded-xl border border-emerald-500/35 bg-emerald-950/30 py-2.5 text-sm font-semibold text-emerald-200"
                  >
                    View latest transaction
                  </button>
                ) : null}
              </div>
              {posErr ? (
                <p className="text-sm text-rose-400" role="alert">
                  {posErr}
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Pre-inspection
            </h3>
            <dl className="grid gap-2 text-sm">
              <Row k="Screen" v={deviceConditionLabel(pre.screenCondition)} />
              <Row k="Frame" v={deviceConditionLabel(pre.frameCondition)} />
              <Row
                k="Back glass"
                v={deviceConditionLabel(pre.backGlassCondition)}
              />
              <Row k="Cameras" v={deviceConditionLabel(pre.cameraCondition)} />
              <Row k="Speakers" v={deviceConditionLabel(pre.speakerCondition)} />
              <Row
                k="Microphone"
                v={deviceConditionLabel(pre.microphoneCondition)}
              />
              <Row
                k="Charging port"
                v={deviceConditionLabel(pre.chargingPortCondition)}
              />
              <Row k="Buttons" v={deviceConditionLabel(pre.buttonsCondition)} />
              <Row
                k="Face / Touch ID"
                v={deviceConditionLabel(pre.biometricsStatus)}
              />
              <Row
                k="Battery / charging"
                v={deviceConditionLabel(pre.batteryChargingStatus)}
              />
              <Row k="Powers on" v={yesNoUnknownLabel(pre.powersOn)} />
              <Row k="Liquid damage" v={yesNoUnknownLabel(pre.liquidDamage)} />
              <Row
                k="Passcode provided"
                v={yesNoUnknownLabel(pre.passcodeProvided)}
              />
              <Row k="SIM present" v={yesNoUnknownLabel(pre.simPresent)} />
              <div>
                <dt className="text-zinc-500">Accessories</dt>
                <dd className="text-zinc-300">
                  {pre.accessoriesReceived.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Visible damage</dt>
                <dd className="text-zinc-300">
                  {pre.visibleDamageNotes.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Tech intake notes</dt>
                <dd className="text-zinc-300">
                  {pre.technicianIntakeNotes.trim() || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Liability waiver
              </h3>
              {canEditWaiver && !waiverEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setWaiverErr(null);
                    setWaiverDraft({ ...w });
                    setWaiverEditing(true);
                  }}
                  className="touch-pad rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-300 active:bg-zinc-800"
                >
                  Edit
                </button>
              ) : null}
              {canEditWaiver && waiverEditing && waiverDraft ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWaiverErr(null);
                      setWaiverEditing(false);
                      setWaiverDraft(null);
                    }}
                    className="touch-pad rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-400 active:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!ticket || !waiverDraft) return;
                      if (!waiverFullyAcknowledged(waiverDraft)) {
                        setWaiverErr(
                          "All waiver items must be checked before saving.",
                        );
                        return;
                      }
                      updateLiabilityWaiver(ticket.id, waiverDraft);
                      setWaiverErr(null);
                      setWaiverEditing(false);
                      setWaiverDraft(null);
                    }}
                    className="touch-pad rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 active:bg-emerald-950/60"
                  >
                    Save
                  </button>
                </div>
              ) : null}
            </div>
            {waiverEditing && waiverDraft ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  Correct the acknowledgement checklist. Saving requires every
                  item to be checked; the accepted timestamp updates for audit.
                </p>
                {(
                  [
                    {
                      key: "dataLossDisclaimer" as const,
                      label: "Data loss",
                      body: "Repair may erase data. I am responsible for backups.",
                    },
                    {
                      key: "preExistingDamageDisclaimer",
                      label: "Pre-existing damage",
                      body: "Pre-existing cosmetic or functional issues are noted on intake.",
                    },
                    {
                      key: "waterproofingDisclaimer",
                      label: "Waterproofing",
                      body: "Water resistance cannot be guaranteed after service.",
                    },
                    {
                      key: "partsDisclaimer",
                      label: "Parts",
                      body: "OEM, aftermarket, or refurbished parts may be used as quoted.",
                    },
                    {
                      key: "warrantyPolicyAck",
                      label: "Warranty & policy",
                      body: "I accept the shop warranty and return policy as explained.",
                    },
                  ] as const
                ).map((row) => (
                  <label
                    key={row.key}
                    className="flex cursor-pointer gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/30"
                      checked={waiverDraft[row.key]}
                      onChange={(e) =>
                        setWaiverDraft((d) =>
                          d
                            ? { ...d, [row.key]: e.target.checked }
                            : d,
                        )
                      }
                    />
                    <span>
                      <span className="font-semibold text-zinc-200">
                        {row.label}
                      </span>
                      <span className="mt-1 block text-sm text-zinc-500">
                        {row.body}
                      </span>
                    </span>
                  </label>
                ))}
                {waiverErr ? (
                  <p className="text-sm text-rose-400">{waiverErr}</p>
                ) : null}
              </div>
            ) : (
              <>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li className="flex items-center gap-2">
                    <span
                      className={
                        w.dataLossDisclaimer
                          ? "text-emerald-400"
                          : "text-zinc-600"
                      }
                    >
                      {w.dataLossDisclaimer ? "✓" : "○"}
                    </span>
                    Data loss / backup
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className={
                        w.preExistingDamageDisclaimer
                          ? "text-emerald-400"
                          : "text-zinc-600"
                      }
                    >
                      {w.preExistingDamageDisclaimer ? "✓" : "○"}
                    </span>
                    Pre-existing damage
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className={
                        w.waterproofingDisclaimer
                          ? "text-emerald-400"
                          : "text-zinc-600"
                      }
                    >
                      {w.waterproofingDisclaimer ? "✓" : "○"}
                    </span>
                    Waterproofing
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className={
                        w.partsDisclaimer
                          ? "text-emerald-400"
                          : "text-zinc-600"
                      }
                    >
                      {w.partsDisclaimer ? "✓" : "○"}
                    </span>
                    Parts
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className={
                        w.warrantyPolicyAck
                          ? "text-emerald-400"
                          : "text-zinc-600"
                      }
                    >
                      {w.warrantyPolicyAck ? "✓" : "○"}
                    </span>
                    Warranty / policy
                  </li>
                </ul>
                <p className="text-xs text-zinc-500">
                  Accepted:{" "}
                  {w.accepted ? (
                    <span className="text-emerald-400">Yes</span>
                  ) : (
                    <span className="text-rose-400">No</span>
                  )}
                  {w.acceptedAt ? (
                    <>
                      {" "}
                      ·{" "}
                      {new Date(w.acceptedAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </>
                  ) : null}
                </p>
              </>
            )}
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Customer signature
            </h3>
            {ticket.signedAt ? (
              <p className="text-xs text-zinc-500">
                Signed{" "}
                {new Date(ticket.signedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            ) : (
              <p className="text-xs text-rose-400">Not on file</p>
            )}
            {sig.mode === "drawn" && sig.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sig.dataUrl}
                alt="Customer signature"
                className="max-h-40 w-full rounded-lg border border-zinc-800 bg-zinc-900 object-contain"
              />
            ) : sig.typedFullName ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 font-serif text-lg text-zinc-200">
                {sig.typedFullName}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">No signature captured.</p>
            )}
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">
              Post-inspection (complete later)
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {ynSelect("Repair completed", postDraft.repairCompleted, (v) =>
                setPostDraft((p) => (p ? { ...p, repairCompleted: v } : p)),
              )}
              {ynSelect("Powers on", postDraft.powersOn, (v) =>
                setPostDraft((p) => (p ? { ...p, powersOn: v } : p)),
              )}
              {ynSelect("Display tested", postDraft.displayTested, (v) =>
                setPostDraft((p) => (p ? { ...p, displayTested: v } : p)),
              )}
              {ynSelect("Touch tested", postDraft.touchTested, (v) =>
                setPostDraft((p) => (p ? { ...p, touchTested: v } : p)),
              )}
              {ynSelect("Cameras tested", postDraft.camerasTested, (v) =>
                setPostDraft((p) => (p ? { ...p, camerasTested: v } : p)),
              )}
              {ynSelect("Speakers tested", postDraft.speakersTested, (v) =>
                setPostDraft((p) => (p ? { ...p, speakersTested: v } : p)),
              )}
              {ynSelect("Microphone tested", postDraft.microphoneTested, (v) =>
                setPostDraft((p) => (p ? { ...p, microphoneTested: v } : p)),
              )}
              {ynSelect("Charging tested", postDraft.chargingTested, (v) =>
                setPostDraft((p) => (p ? { ...p, chargingTested: v } : p)),
              )}
              {ynSelect("Buttons tested", postDraft.buttonsTested, (v) =>
                setPostDraft((p) => (p ? { ...p, buttonsTested: v } : p)),
              )}
              {ynSelect("Biometrics tested", postDraft.biometricsTested, (v) =>
                setPostDraft((p) => (p ? { ...p, biometricsTested: v } : p)),
              )}
              {condSelect(
                "Final cosmetic",
                postDraft.finalCosmeticCondition,
                (v) =>
                  setPostDraft((p) =>
                    p ? { ...p, finalCosmeticCondition: v } : p,
                  ),
              )}
              {ynSelect("Ready for pickup", postDraft.readyForPickup, (v) =>
                setPostDraft((p) => (p ? { ...p, readyForPickup: v } : p)),
              )}
            </div>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-500">Technician final notes</span>
              <textarea
                className={`${fieldClass} min-h-[4rem] resize-y py-2`}
                value={postDraft.technicianFinalNotes}
                onChange={(e) =>
                  setPostDraft((p) =>
                    p ? { ...p, technicianFinalNotes: e.target.value } : p,
                  )
                }
                rows={3}
              />
            </label>
            <button
              type="button"
              onClick={savePost}
              disabled={!employee}
              className="touch-pad w-full min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save post-inspection
            </button>
            {postSavedMsg ? (
              <p className="text-center text-sm text-emerald-400">Saved.</p>
            ) : null}
            {!employee ? (
              <p className="text-xs text-zinc-500">
                Sign in to save post-inspection.
              </p>
            ) : null}
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Update
            </h3>
            <label className="block text-sm">
              <span className="text-zinc-500">Status</span>
              <select
                className={fieldClass}
                value={ticket.status}
                onChange={(e) =>
                  updateTicketStatus(
                    ticket.id,
                    e.target.value as RepairStatus,
                  )
                }
              >
                {REPAIR_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {REPAIR_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Assigned technician</span>
              <select
                className={fieldClass}
                value={ticket.assignment?.technicianId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  assignTechnician(ticket.id, v === "" ? null : v);
                }}
              >
                <option value="">Unassigned</option>
                {technicianOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Internal notes
            </h3>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {ticket.notes.length === 0 ? (
                <li className="text-zinc-500">No notes yet.</li>
              ) : (
                ticket.notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3"
                  >
                    <p className="text-zinc-200">{n.body}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {n.authorName} ·{" "}
                      {new Date(n.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <div>
              <textarea
                className={`${fieldClass} min-h-[4.5rem] resize-y py-2`}
                placeholder={
                  employee
                    ? "Add an internal note…"
                    : "Sign in to add notes"
                }
                value={noteDraft}
                disabled={!employee}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
              />
              <button
                type="button"
                disabled={!employee || !noteDraft.trim()}
                onClick={submitNote}
                className="touch-pad mt-2 w-full min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add note
              </button>
            </div>
          </section>
        </div>

        {saleForRefund ? (
          <CreateRefundModal
            open={refundModalOpen}
            onClose={() => setRefundModalOpen(false)}
            sale={saleForRefund}
            defaultRestockInventory={hasProductLineForRefund}
          />
        ) : null}
      </aside>
    </div>
  );
}
