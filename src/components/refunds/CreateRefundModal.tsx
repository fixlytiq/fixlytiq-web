"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  REFUND_MANAGER_APPROVAL_REQUIRED_MESSAGE,
  canIssueRefund,
  refundSignInBlockedMessage,
} from "@/lib/rbac";
import {
  verifyManagerApprovalPinForRefund,
} from "@/lib/refund-manager-pin";
import { useRefundsStore, type CreateRefundInput } from "@/stores/refunds-store";
import { useSessionStore } from "@/stores/session-store";
import type { EmployeeRole } from "@/types/employee";
import type { RefundReason } from "@/types/refunds";
import type { Sale, SaleLine } from "@/types/pos";

const REASON_OPTIONS: readonly { value: RefundReason; label: string }[] = [
  { value: "customer_request", label: "Customer request" },
  { value: "incorrect_item", label: "Incorrect item" },
  { value: "pricing_error", label: "Pricing error" },
  { value: "damaged_item", label: "Damaged item" },
  { value: "other", label: "Other" },
];

function lineKindLabel(line: SaleLine): string {
  if (line.lineKind === "repair") return "Repair";
  if (line.lineKind === "custom") return "Custom";
  if (line.repairTicketId) return "Repair";
  if (line.customItemId) return "Custom";
  return "Product";
}

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  const i = Math.floor(v);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

export type CreateRefundModalProps = {
  open: boolean;
  onClose: () => void;
  sale: Sale;
  defaultRestockInventory?: boolean;
  onCreated?: (refundId: string) => void;
};

type VerifiedApproval = {
  managerName: string;
  managerRole: EmployeeRole;
  managerEmployeeId: string;
  verifiedAt: string;
};

export function CreateRefundModal({
  open,
  onClose,
  sale,
  defaultRestockInventory,
  onCreated,
}: CreateRefundModalProps) {
  const createRefund = useRefundsStore((s) => s.createRefund);
  const sessionEmployee = useSessionStore((s) => s.employee);

  const signInBlocked = refundSignInBlockedMessage(sessionEmployee);
  const sessionOk = signInBlocked === null;
  const needsManagerPin =
    sessionOk &&
    sessionEmployee !== null &&
    !canIssueRefund(sessionEmployee.role);

  const [reason, setReason] = useState<RefundReason>("customer_request");
  const [restockInventory, setRestockInventory] = useState<boolean>(
    defaultRestockInventory ?? false,
  );
  const [note, setNote] = useState<string>("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lineQty, setLineQty] = useState<Record<number, number>>({});

  const [managerPinInput, setManagerPinInput] = useState("");
  const [verifyPinError, setVerifyPinError] = useState<string | null>(null);
  const [verifiedApproval, setVerifiedApproval] =
    useState<VerifiedApproval | null>(null);
  const pinRef = useRef("");
  const prevSelectionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setReason("customer_request");
    setRestockInventory(defaultRestockInventory ?? false);
    setNote("");
    setConfirmChecked(false);
    setManagerPinInput("");
    setVerifyPinError(null);
    setVerifiedApproval(null);
    pinRef.current = "";
    prevSelectionKeyRef.current = null;
    const initial: Record<number, number> = {};
    sale.lines.forEach((l, i) => {
      initial[i] = l.quantity;
    });
    setLineQty(initial);
  }, [open, sale, defaultRestockInventory]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const refundSelections = useMemo(() => {
    return sale.lines
      .map((l, i) => {
        const q = lineQty[i] ?? 0;
        if (!Number.isFinite(q) || q <= 0) return null;
        if (q > l.quantity) return { i, q: l.quantity };
        return { i, q: Math.floor(q) };
      })
      .filter((x): x is { i: number; q: number } => x !== null);
  }, [sale.lines, lineQty]);

  const selectionKey = useMemo(
    () =>
      JSON.stringify(
        [...refundSelections]
          .sort((a, b) => a.i - b.i)
          .map((s) => [s.i, s.q]),
      ),
    [refundSelections],
  );

  useEffect(() => {
    if (!open || !needsManagerPin) return;
    if (prevSelectionKeyRef.current === null) {
      prevSelectionKeyRef.current = selectionKey;
      return;
    }
    if (prevSelectionKeyRef.current !== selectionKey) {
      setVerifiedApproval(null);
      pinRef.current = "";
      setManagerPinInput("");
      setVerifyPinError(null);
      prevSelectionKeyRef.current = selectionKey;
    }
  }, [open, needsManagerPin, selectionKey]);

  const totalRefundedEstimated = useMemo(() => {
    const subtotal = refundSelections.reduce((sum, s) => {
      const line = sale.lines[s.i]!;
      return sum + line.unitPrice * s.q;
    }, 0);
    return subtotal + sale.tax * (subtotal / Math.max(0.00001, sale.subtotal));
  }, [refundSelections, sale.subtotal, sale.tax, sale.lines]);

  if (!open) return null;

  const overrideReady =
    !needsManagerPin ||
    (verifiedApproval !== null && pinRef.current.length > 0);

  const canSubmit =
    sessionOk &&
    overrideReady &&
    confirmChecked &&
    refundSelections.length > 0 &&
    !Number.isNaN(totalRefundedEstimated);

  const verifyManagerPin = () => {
    setVerifyPinError(null);
    setErr(null);
    if (!sessionEmployee) return;
    const r = verifyManagerApprovalPinForRefund({
      pinRaw: managerPinInput,
      sessionEmployee,
    });
    if (!r.ok) {
      setVerifyPinError(r.error);
      setManagerPinInput("");
      pinRef.current = "";
      setVerifiedApproval(null);
      return;
    }
    pinRef.current = managerPinInput.trim();
    setManagerPinInput("");
    setVerifiedApproval({
      managerName: r.approver.name,
      managerRole: r.approver.role,
      managerEmployeeId: r.approver.id,
      verifiedAt: new Date().toISOString(),
    });
  };

  const onPinInputChange = (value: string) => {
    setManagerPinInput(value);
    if (verifiedApproval !== null || pinRef.current) {
      setVerifiedApproval(null);
      pinRef.current = "";
      setVerifyPinError(null);
    }
  };

  const submit = () => {
    setErr(null);
    if (!sessionOk) {
      setErr(signInBlocked ?? "Sign in to issue refunds.");
      return;
    }
    if (needsManagerPin) {
      if (!pinRef.current) {
        setErr(REFUND_MANAGER_APPROVAL_REQUIRED_MESSAGE);
        return;
      }
    }
    if (!canSubmit) {
      setErr("Select refund lines, confirm, and complete manager approval if required.");
      return;
    }

    const lines: CreateRefundInput["lines"] = refundSelections.map((s) => ({
      saleLineIndex: s.i,
      quantity: s.q,
    }));

    const r = createRefund({
      saleId: sale.id,
      reason,
      note: note.trim() || null,
      lines,
      restockInventory,
      managerApprovalPin: needsManagerPin ? pinRef.current : undefined,
    });

    pinRef.current = "";
    setManagerPinInput("");
    setVerifiedApproval(null);

    if (!r.ok) {
      setErr(r.error);
      return;
    }

    onCreated?.(r.refundId);
    onClose();
  };

  const roleLabel = (role: EmployeeRole) =>
    role === "owner" ? "Owner" : role === "manager" ? "Manager" : role;

  return (
    <div className="fixed inset-0 z-[110] flex justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close refund modal"
        onClick={onClose}
      />
      <div
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-semibold text-emerald-400/90">
              Create refund
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-zinc-500">
              Sale {sale.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-pad shrink-0 rounded-xl border border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-400 active:bg-zinc-900"
          >
            Close
          </button>
        </div>

        {!sessionOk ? (
          <div className="shrink-0 border-b border-amber-500/25 bg-amber-950/30 px-4 py-3">
            <p className="text-sm text-amber-100/90" role="status">
              {signInBlocked}
            </p>
          </div>
        ) : needsManagerPin ? (
          <div className="shrink-0 border-b border-sky-500/20 bg-sky-950/25 px-4 py-3">
            <p className="text-sm text-sky-100/90" role="status">
              Your role cannot issue refunds directly. A manager or owner must
              approve with their PIN below before you can confirm.
            </p>
          </div>
        ) : null}

        <div
          className={`min-h-0 flex-1 overflow-y-auto p-4 ${
            !sessionOk ? "pointer-events-none opacity-45" : ""
          }`}
        >
          {needsManagerPin && sessionOk ? (
            <section className="mb-4 space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
                Manager approval
              </h3>
              {verifyPinError ? (
                <p className="text-sm text-rose-400" role="alert">
                  {verifyPinError}
                </p>
              ) : null}
              <label className="block text-sm">
                <span className="text-zinc-500">Manager or owner PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={managerPinInput}
                  onChange={(e) => onPinInputChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Enter PIN"
                />
              </label>
              <button
                type="button"
                onClick={verifyManagerPin}
                disabled={!managerPinInput.trim()}
                className="touch-pad w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Verify approval
              </button>
              {verifiedApproval ? (
                <div
                  className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100/95"
                  role="status"
                >
                  <p className="font-semibold">Approval confirmed</p>
                  <p className="mt-1 text-emerald-200/90">
                    Approved by {verifiedApproval.managerName} (
                    {roleLabel(verifiedApproval.managerRole)})
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-emerald-500/80">
                    {new Date(verifiedApproval.verifiedAt).toLocaleString()}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Refund details
            </h3>

            {err ? (
              <p className="text-sm text-rose-400" role="alert">
                {err}
              </p>
            ) : null}

            <label className="block text-sm">
              <span className="text-zinc-500">Reason *</span>
              <select
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={reason}
                onChange={(e) => setReason(e.target.value as RefundReason)}
                disabled={!sessionOk}
              >
                {REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2">
                <input
                  type="checkbox"
                  checked={restockInventory}
                  onChange={(e) => setRestockInventory(e.target.checked)}
                  disabled={!sessionOk}
                  className="h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600 focus:ring-emerald-500/30"
                />
                <span className="text-sm text-zinc-200">
                  Restock inventory (product lines only)
                </span>
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-zinc-500">Note (optional)</span>
              <textarea
                className="mt-1 w-full min-h-[7rem] resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!sessionOk}
                placeholder="Internal reason / customer notes"
              />
            </label>
          </section>

          <section className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Lines to refund
            </h3>
            <ul className="space-y-2">
              {sale.lines.map((l, idx) => {
                const q = lineQty[idx] ?? 0;
                return (
                  <li
                    key={`${l.sku}-${idx}`}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {l.name}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {lineKindLabel(l)} · {l.sku}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm text-zinc-200">
                          ${l.unitPrice.toFixed(2)}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Qty max {l.quantity}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label className="flex-1">
                        <span className="sr-only">Refund quantity</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={l.quantity}
                          value={q}
                          disabled={!sessionOk}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value || "0", 10);
                            setLineQty((prev) => ({
                              ...prev,
                              [idx]: clampInt(v, 0, l.quantity),
                            }));
                          }}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                        />
                      </label>
                      <span className="shrink-0 text-xs text-zinc-500">
                        Refunds: {l.unitPrice.toFixed(2)} × {q}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-zinc-500">
              Estimated refund principal (store recalculates exact tax/total): $
              {totalRefundedEstimated.toFixed(2)}
            </p>
          </section>

          <section className="mt-4 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                disabled={!sessionOk}
                className="h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600 focus:ring-emerald-500/30"
              />
              <span className="text-sm text-zinc-200">
                I confirm this refund will be recorded and applied immediately.
              </span>
            </label>
          </section>
        </div>

        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950/40 p-4">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            title={
              needsManagerPin && !overrideReady
                ? REFUND_MANAGER_APPROVAL_REQUIRED_MESSAGE
                : !sessionOk
                  ? (signInBlocked ?? undefined)
                  : undefined
            }
            className="touch-pad w-full min-h-12 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm refund
          </button>
        </div>
      </div>
    </div>
  );
}
