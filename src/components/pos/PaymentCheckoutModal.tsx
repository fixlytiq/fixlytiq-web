"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canCompleteCheckout,
  computeCheckoutPaymentState,
  maxCardAmountAllowed,
  paymentMethodLabel,
} from "@/lib/payment-totals";
import { usePosStore } from "@/stores/pos-store";
import type { PaymentEntry, PaymentMethod } from "@/types/payment";

type PaymentCheckoutModalProps = {
  onClose: () => void;
};

/** Fixed top of modal: title + rules — stays visible, never scrolls. */
function CheckoutStickyHeader() {
  return (
    <header className="shrink-0 border-b border-zinc-800/90 bg-zinc-950 px-3 py-2 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="pay-modal-title"
          className="text-sm font-bold tracking-tight text-zinc-100 sm:text-base"
        >
          Take payment
        </h2>
        <p className="max-w-[11rem] text-right text-[0.6rem] leading-snug text-zinc-500 sm:max-w-none">
          Card ≤ due · cash for change
        </p>
      </div>
    </header>
  );
}

/** Dense totals — minimal height, strong scan hierarchy. */
function CheckoutSummaryCompact({
  subtotal,
  tax,
  totalDue,
  totalCollected,
  remainingBalance,
  changeDue,
  cashTotal,
  cardTotal,
}: {
  subtotal: number;
  tax: number;
  totalDue: number;
  totalCollected: number;
  remainingBalance: number;
  changeDue: number;
  cashTotal: number;
  cardTotal: number;
}) {
  return (
    <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-900/60 px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
            Due
          </p>
          <p className="font-mono text-[1.35rem] font-black leading-none tabular-nums text-emerald-300 sm:text-2xl">
            ${totalDue.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
            In
          </p>
          <p className="font-mono text-lg font-bold tabular-nums text-zinc-100 sm:text-xl">
            ${totalCollected.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
            Remaining
          </p>
          <p
            className={`font-mono text-lg font-bold tabular-nums sm:text-xl ${
              remainingBalance > 0 ? "text-amber-300" : "text-zinc-500"
            }`}
          >
            ${remainingBalance.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
            Change
          </p>
          <p
            className={`font-mono text-lg font-bold tabular-nums sm:text-xl ${
              changeDue > 0 ? "text-sky-300" : "text-zinc-600"
            }`}
          >
            ${changeDue.toFixed(2)}
          </p>
        </div>
      </div>
      <p className="mt-1.5 font-mono text-[0.65rem] tabular-nums text-zinc-500">
        Sub ${subtotal.toFixed(2)} + tax ${tax.toFixed(2)} · cash $
        {cashTotal.toFixed(2)} · card ${cardTotal.toFixed(2)}
      </p>
    </div>
  );
}

function TenderPad({
  disabledCash,
  disabledCard,
  onCash,
  onCard,
}: {
  disabledCash: boolean;
  disabledCard: boolean;
  onCash: () => void;
  onCard: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950 px-3 py-2 sm:px-4">
      <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
        Tender
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCash}
          disabled={disabledCash}
          className="touch-pad flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-emerald-400/50 bg-emerald-500/10 py-2 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span className="text-base font-black tracking-wide text-emerald-100">
            CASH
          </span>
          <span className="text-[0.6rem] text-emerald-200/65">balance</span>
        </button>
        <button
          type="button"
          onClick={onCard}
          disabled={disabledCard}
          className="touch-pad flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-violet-400/45 bg-violet-500/10 py-2 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span className="text-base font-black tracking-wide text-violet-100">
            CARD
          </span>
          <span className="text-[0.6rem] text-violet-200/65">to due</span>
        </button>
      </div>
    </div>
  );
}

function PaymentLinesList({
  payments,
  amountDrafts,
  onDraftChange,
  onBlurCommit,
  onRemove,
}: {
  payments: PaymentEntry[];
  amountDrafts: Record<string, string>;
  onDraftChange: (id: string, value: string) => void;
  onBlurCommit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (payments.length === 0) {
    return (
      <p className="py-2 text-center text-[0.7rem] text-zinc-600">
        No split lines yet — use CASH or CARD, or add both.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
        Split lines
      </p>
      <ul className="space-y-1">
        {payments.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800/90 bg-zinc-900/40 py-1 pl-1.5 pr-1"
          >
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase ${
                p.method === "cash"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-violet-500/20 text-violet-200"
              }`}
            >
              {paymentMethodLabel(p.method)}
            </span>
            <input
              aria-label={`Amount ${paymentMethodLabel(p.method)}`}
              className="min-h-9 min-w-0 flex-1 rounded-md border border-zinc-700/90 bg-zinc-950 px-2 font-mono text-sm font-semibold text-zinc-100"
              inputMode="decimal"
              value={amountDrafts[p.id] ?? p.amount.toFixed(2)}
              onChange={(e) => onDraftChange(p.id, e.target.value)}
              onBlur={() => onBlurCommit(p.id)}
            />
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              className="touch-pad shrink-0 rounded-md px-2 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpenOrderDisclosure({
  openOrderLabel,
  openOrderNote,
  onLabelChange,
  onNoteChange,
  openOrderErr,
}: {
  openOrderLabel: string;
  openOrderNote: string;
  onLabelChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  openOrderErr: string | null;
}) {
  const inputCls =
    "w-full rounded-md border border-zinc-800 bg-zinc-950/90 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/35 focus:outline-none focus:ring-1 focus:ring-amber-500/20";

  return (
    <details className="group rounded-lg border border-zinc-800/70 bg-zinc-950/30">
      <summary className="cursor-pointer list-none px-2.5 py-1.5 text-xs font-semibold text-zinc-500 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span className="text-amber-200/75">Open order (optional)</span>
          <span className="font-normal text-zinc-600 group-open:hidden">▼</span>
          <span className="hidden font-normal text-zinc-600 group-open:inline">
            ▲
          </span>
        </span>
      </summary>
      <div className="space-y-1.5 border-t border-zinc-800/50 px-2.5 pb-2.5 pt-1.5">
        <p className="text-[0.6rem] leading-snug text-zinc-600">
          Parks cart; tenders not saved. Use{" "}
          <span className="text-zinc-500">Save open order</span> below.
        </p>
        <input
          className={inputCls}
          placeholder="Label"
          value={openOrderLabel}
          onChange={(e) => onLabelChange(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Note"
          value={openOrderNote}
          onChange={(e) => onNoteChange(e.target.value)}
        />
        {openOrderErr ? (
          <p className="text-xs text-rose-400" role="alert">
            {openOrderErr}
          </p>
        ) : null}
      </div>
    </details>
  );
}

/** Always visible — primary Charge + secondary row. Safe-area padding. */
function CheckoutStickyFooter({
  canComplete,
  paymentFlowBusy,
  onCancel,
  onSaveOpenOrder,
  onComplete,
}: {
  canComplete: boolean;
  paymentFlowBusy: boolean;
  onCancel: () => void;
  onSaveOpenOrder: () => void;
  onComplete: () => void;
}) {
  return (
    <footer className="shrink-0 border-t border-zinc-700 bg-zinc-950 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] sm:px-4">
      <button
        type="button"
        disabled={!canComplete}
        onClick={onComplete}
        className="touch-pad mb-2 w-full min-h-[3rem] rounded-xl bg-emerald-500 py-3 text-lg font-black uppercase tracking-wider text-zinc-950 shadow-md shadow-emerald-950/30 transition hover:bg-emerald-400 active:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none"
      >
        {paymentFlowBusy ? "Wait…" : "Charge"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="touch-pad min-h-10 rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-xs font-semibold text-zinc-400"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onSaveOpenOrder}
          className="touch-pad min-h-10 rounded-lg border border-amber-500/35 bg-amber-950/35 py-2 text-xs font-semibold text-amber-200/90"
        >
          Save open order
        </button>
      </div>
    </footer>
  );
}

export function PaymentCheckoutModal({ onClose }: PaymentCheckoutModalProps) {
  const session = usePosStore((s) => s.paymentSession);
  const paymentFlowBusy = usePosStore((s) => s.paymentFlowBusy);
  const addPaymentToSession = usePosStore((s) => s.addPaymentToSession);
  const updatePaymentAmountInSession = usePosStore(
    (s) => s.updatePaymentAmountInSession,
  );
  const removePaymentFromSession = usePosStore(
    (s) => s.removePaymentFromSession,
  );
  const finalizePaymentSession = usePosStore((s) => s.finalizePaymentSession);
  const saveOpenOrderFromSession = usePosStore(
    (s) => s.saveOpenOrderFromSession,
  );

  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [openOrderNote, setOpenOrderNote] = useState("");
  const [openOrderLabel, setOpenOrderLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finalizeErr, setFinalizeErr] = useState<string | null>(null);
  const [openOrderErr, setOpenOrderErr] = useState<string | null>(null);

  const totalDue = session?.totalDue ?? 0;
  const subtotal = session?.subtotal ?? 0;
  const tax = session?.tax ?? 0;
  const payments = session?.payments ?? [];

  const totals = useMemo(
    () => computeCheckoutPaymentState(totalDue, payments),
    [totalDue, payments],
  );

  const {
    totalCollected,
    remainingBalance,
    changeDue,
    cashTotal,
    cardTotal,
  } = totals;

  const canComplete =
    canCompleteCheckout(totalDue, payments) && !paymentFlowBusy;

  const syncDraftsFromPayments = useCallback(() => {
    if (!session) return;
    const next: Record<string, string> = {};
    for (const p of session.payments) {
      next[p.id] = p.amount.toFixed(2);
    }
    setAmountDrafts(next);
  }, [session]);

  useEffect(() => {
    syncDraftsFromPayments();
  }, [syncDraftsFromPayments, payments.length, session?.totalDue]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addQuickPayment = (method: PaymentMethod) => {
    setError(null);
    if (!session) return;
    if (totalCollected + 1e-9 >= totalDue) {
      setError("Total due is already covered.");
      return;
    }
    const rem = Math.max(0, totalDue - totalCollected);
    if (method === "card") {
      const maxAdd = maxCardAmountAllowed(totalDue, session.payments);
      const amt = Math.min(rem, maxAdd);
      if (amt <= 0) {
        setError("No room left for card on this sale.");
        return;
      }
      const r = addPaymentToSession({ method, amount: amt });
      if (!r.ok) setError(r.error);
      return;
    }
    const r = addPaymentToSession({ method: "cash", amount: rem });
    if (!r.ok) setError(r.error);
  };

  const commitAmount = (paymentId: string) => {
    setError(null);
    const raw = amountDrafts[paymentId] ?? "";
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }
    const r = updatePaymentAmountInSession(paymentId, n);
    if (!r.ok) {
      setError(r.error);
      syncDraftsFromPayments();
    }
  };

  const complete = () => {
    setFinalizeErr(null);
    const r = finalizePaymentSession();
    if (!r.ok) setFinalizeErr(r.error);
  };

  const saveOpen = () => {
    setOpenOrderErr(null);
    const r = saveOpenOrderFromSession({
      note: openOrderNote || undefined,
      label: openOrderLabel || undefined,
    });
    if (!r.ok) setOpenOrderErr(r.error);
    else {
      setOpenOrderNote("");
      setOpenOrderLabel("");
    }
  };

  if (!session) return null;

  const disabledCash = totalCollected + 1e-9 >= totalDue;
  const disabledCard =
    totalCollected + 1e-9 >= totalDue ||
    maxCardAmountAllowed(totalDue, payments) <= 0.005;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 p-1.5 pb-0 sm:items-center sm:p-4 sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
    >
      {/* Bounded height so flex-1 scroll works; footer always in view inside this box */}
      <div
        className="flex h-[min(92dvh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-600/80 border-b-0 bg-zinc-950 shadow-2xl sm:h-[min(86dvh,40rem)] sm:max-w-2xl sm:rounded-2xl sm:border-b"
      >
        <CheckoutStickyHeader />

        <CheckoutSummaryCompact
          subtotal={subtotal}
          tax={tax}
          totalDue={totalDue}
          totalCollected={totalCollected}
          remainingBalance={remainingBalance}
          changeDue={changeDue}
          cashTotal={cashTotal}
          cardTotal={cardTotal}
        />

        <TenderPad
          disabledCash={disabledCash}
          disabledCard={disabledCard}
          onCash={() => addQuickPayment("cash")}
          onCard={() => addQuickPayment("card")}
        />

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
          <div className="space-y-2">
            <PaymentLinesList
              payments={payments}
              amountDrafts={amountDrafts}
              onDraftChange={(id, value) =>
                setAmountDrafts((d) => ({ ...d, [id]: value }))
              }
              onBlurCommit={commitAmount}
              onRemove={(id) => removePaymentFromSession(id)}
            />

            {error ? (
              <p className="text-xs text-rose-400" role="alert">
                {error}
              </p>
            ) : null}
            {finalizeErr ? (
              <p className="text-xs text-rose-400" role="alert">
                {finalizeErr}
              </p>
            ) : null}

            <OpenOrderDisclosure
              openOrderLabel={openOrderLabel}
              openOrderNote={openOrderNote}
              onLabelChange={setOpenOrderLabel}
              onNoteChange={setOpenOrderNote}
              openOrderErr={openOrderErr}
            />
          </div>
        </div>

        <CheckoutStickyFooter
          canComplete={canComplete}
          paymentFlowBusy={paymentFlowBusy}
          onCancel={onClose}
          onSaveOpenOrder={saveOpen}
          onComplete={complete}
        />
      </div>
    </div>
  );
}
