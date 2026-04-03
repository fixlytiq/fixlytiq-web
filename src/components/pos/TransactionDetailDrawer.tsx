"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  paymentMethodLabel,
  paymentTotalsByMethod,
} from "@/lib/payment-totals";
import { saleIncludesRepairCheckout } from "@/lib/sale-repair";
import { usePosStore } from "@/stores/pos-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { useCustomerUiStore } from "@/stores/customer-ui-store";
import { useTransactionUiStore } from "@/stores/transaction-ui-store";
import { useRefundsStore } from "@/stores/refunds-store";
import { CreateRefundModal } from "@/components/refunds/CreateRefundModal";
import { RefundCreateButton } from "@/components/refunds/RefundCreateButton";
import {
  refundManagerPinHint,
  refundSignInBlockedMessage,
} from "@/lib/rbac";
import { useSessionStore } from "@/stores/session-store";
import type { Sale } from "@/types/pos";
import type { SaleRepairCheckoutSnapshot } from "@/types/repair-sale-snapshot";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-right font-mono text-sm text-zinc-200 sm:text-left">
        {v}
      </dd>
    </div>
  );
}

function RepairSnapshotSection({ snap }: { snap: SaleRepairCheckoutSnapshot }) {
  return (
    <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">
        Linked repair · {snap.repairTicketNumber}
      </h3>
      <p className="text-sm text-zinc-400">{snap.deviceLabel}</p>
      <dl className="grid gap-2 text-sm">
        <Row k="Labor (snapshot)" v={`$${snap.pricing.laborSubtotal.toFixed(2)}`} />
        <Row k="Parts (snapshot)" v={`$${snap.pricing.partsSubtotal.toFixed(2)}`} />
        <Row
          k="Repair subtotal (pre-tax)"
          v={`$${snap.pricing.repairSubtotalPreTax.toFixed(2)}`}
        />
      </dl>
      {snap.pricing.laborNote ? (
        <p className="text-xs text-zinc-500">Labor note: {snap.pricing.laborNote}</p>
      ) : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Customer (snapshot)
        </p>
        <p className="mt-1 text-sm text-zinc-300">{snap.customer.name}</p>
        <p className="font-mono text-xs text-zinc-500">
          {snap.customer.phone || "—"} · {snap.customer.email || "—"}
        </p>
      </div>
      {snap.technician ? (
        <p className="text-xs text-zinc-500">
          Tech (snapshot):{" "}
          <span className="text-zinc-300">{snap.technician.technicianName}</span>
        </p>
      ) : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Parts used (snapshot)
        </p>
        {snap.partsUsed.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">None on file.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {snap.partsUsed.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2 text-sm"
              >
                <span className="font-medium text-zinc-200">{p.name}</span>
                <span className="ml-2 font-mono text-xs text-zinc-500">
                  {p.sku} ×{p.quantity} @ ${p.unitPrice.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function saleById(recentSales: Sale[], id: string): Sale | null {
  return recentSales.find((s) => s.id === id) ?? null;
}

export function TransactionDetailDrawer() {
  const router = useRouter();
  const detailSaleId = useTransactionUiStore((s) => s.detailSaleId);
  const closeTransactionDetail = useTransactionUiStore(
    (s) => s.closeTransactionDetail,
  );
  const recentSales = usePosStore((s) => s.recentSales);
  const setSelectedTicketId = useRepairsStore((s) => s.setSelectedTicketId);
  const refunds = useRefundsStore((s) => s.refunds);
  const sessionEmployee = useSessionStore((s) => s.employee);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const refundSignInBlocked = refundSignInBlockedMessage(sessionEmployee);
  const refundPinHint = refundManagerPinHint(sessionEmployee);

  const refundsForSale = useMemo(() => {
    if (!detailSaleId) return [];
    return refunds.filter((r) => r.saleId === detailSaleId);
  }, [detailSaleId, refunds]);

  const sale = useMemo(
    () => (detailSaleId ? saleById(recentSales, detailSaleId) : null),
    [detailSaleId, recentSales],
  );

  useEffect(() => {
    if (!detailSaleId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTransactionDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailSaleId, closeTransactionDetail]);

  if (!detailSaleId || !sale) return null;

  const hasProductLine = sale.lines.some((l) => {
    const kind =
      l.lineKind ??
      (l.repairTicketId
        ? "repair"
        : l.customItemId
          ? "custom"
          : "product");
    return kind === "product";
  });

  const byMethod = paymentTotalsByMethod(sale.payments);
  const repairSnaps = sale.repairCheckouts ?? [];
  const legacyRepair =
    repairSnaps.length === 0 && saleIncludesRepairCheckout(sale);
  const lineTicketId = sale.lines.find(
    (l) => l.repairTicketId != null && l.repairTicketId !== "",
  )?.repairTicketId;
  const firstTicketId =
    repairSnaps[0]?.linkedRepairTicketId ??
    sale.linkedRepairTicketId ??
    lineTicketId ??
    null;

  const openLinkedRepair = () => {
    if (!firstTicketId) return;
    closeTransactionDetail();
    setSelectedTicketId(firstTicketId);
    router.push("/repairs");
  };

  const displayCustomerName =
    sale.customerSnapshot?.fullName?.trim() ||
    (sale.customerId ? "Linked customer" : null);

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close transaction panel"
        onClick={closeTransactionDetail}
      />
      <aside
        className="relative flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="txn-detail-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <h2
              id="txn-detail-title"
              className="font-mono text-sm font-semibold text-emerald-400/90"
            >
              Transaction
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-zinc-500">
              {sale.id}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {new Date(sale.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={closeTransactionDetail}
            className="touch-pad shrink-0 rounded-xl border border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-400 active:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {displayCustomerName ? (
            <section className="space-y-2 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Customer
              </h3>
              <p className="text-sm font-medium text-zinc-200">
                {displayCustomerName}
              </p>
              {sale.customerSnapshot?.phone ? (
                <p className="font-mono text-xs text-zinc-500">
                  {sale.customerSnapshot.phone}
                </p>
              ) : null}
              {sale.customerId ? (
                <button
                  type="button"
                  onClick={() => {
                    useCustomerUiStore.getState().openCustomerDetail(sale.customerId!);
                    closeTransactionDetail();
                    router.push("/customers");
                  }}
                  className="touch-pad text-xs font-semibold text-emerald-400/90 underline"
                >
                  View profile & history
                </button>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-2 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Totals
            </h3>
            <dl className="grid gap-2 text-sm">
              <Row k="Subtotal" v={`$${sale.subtotal.toFixed(2)}`} />
              <Row k="Tax" v={`$${sale.tax.toFixed(2)}`} />
              <Row k="Total due" v={`$${sale.totalDue.toFixed(2)}`} />
            </dl>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Payment
            </h3>
            <dl className="grid gap-2 text-sm">
              <Row
                k="Collected"
                v={`$${sale.totalCollected.toFixed(2)}`}
              />
              <Row
                k="Remaining (at close)"
                v={`$${sale.remainingBalance.toFixed(2)}`}
              />
              {sale.changeDue > 0 ? (
                <Row k="Change due" v={`$${sale.changeDue.toFixed(2)}`} />
              ) : null}
              <Row
                k="Cash total"
                v={`$${byMethod.cash.toFixed(2)}`}
              />
              <Row
                k="Card total"
                v={`$${byMethod.card.toFixed(2)}`}
              />
              <Row
                k="Summary"
                v={sale.paymentMethod?.trim() ? sale.paymentMethod : "—"}
              />
              <Row k="Processed by" v={sale.processedBy?.name ?? "—"} />
            </dl>
            {sale.payments.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Tender lines
                </p>
                <ul className="mt-2 space-y-2">
                  {sale.payments.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2 text-sm"
                    >
                      <div className="flex justify-between gap-2 font-medium text-zinc-200">
                        <span>{paymentMethodLabel(p.method)}</span>
                        <span className="font-mono">
                          ${p.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                        {new Date(p.recordedAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {p.processedBy?.name
                          ? ` · ${p.processedBy.name}`
                          : ""}
                      </p>
                      {p.note ? (
                        <p className="mt-1 text-xs text-zinc-400">{p.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                No tender lines stored (legacy sale).
              </p>
            )}
          </section>

          {repairSnaps.map((snap) => (
            <RepairSnapshotSection key={snap.linkedRepairTicketId} snap={snap} />
          ))}

          {legacyRepair && repairSnaps.length === 0 ? (
            <section className="rounded-xl border border-zinc-700/80 bg-zinc-900/20 p-4 text-sm text-zinc-500">
              This sale predates repair snapshots. Line items may still show a
              repair SKU; open the ticket from the list using the repair id on
              the receipt line.
            </section>
          ) : null}

          {firstTicketId ? (
            <button
              type="button"
              onClick={openLinkedRepair}
              className="touch-pad w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-3 text-sm font-semibold text-emerald-100"
            >
              Open repair ticket
            </button>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Line items
            </h3>
            <ul className="space-y-2">
              {sale.lines.map((line, i) => (
                <li
                  key={`${line.productId}-${i}`}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-200">{line.name}</span>
                    {line.lineKind === "custom" ? (
                      <span className="shrink-0 rounded-md bg-cyan-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-cyan-200/90">
                        Custom
                      </span>
                    ) : line.lineKind === "repair" || line.repairTicketId ? (
                      <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-amber-200/90">
                        Repair
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {line.sku} · {line.quantity} × ${line.unitPrice.toFixed(2)}
                    {line.lineKind === "custom" && line.taxable === false
                      ? " · tax-exempt"
                      : ""}
                  </p>
                  {line.lineKind === "custom" && line.note ? (
                    <p className="mt-1 text-xs text-zinc-500">{line.note}</p>
                  ) : null}
                  {line.lineKind === "custom" && line.categoryLabel ? (
                    <p className="text-[0.65rem] text-zinc-600">
                      {line.categoryLabel}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-4 space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Refunds
              </h3>
              <RefundCreateButton
                signInBlockedMessage={refundSignInBlocked}
                managerPinHint={refundPinHint}
                prereqMet
                onClick={() => setRefundModalOpen(true)}
              />
            </div>

            {refundsForSale.length === 0 ? (
              <p className="text-sm text-zinc-500">No refunds yet.</p>
            ) : (
              <ul className="space-y-2">
                {refundsForSale.slice(0, 10).map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3"
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
                    <p className="mt-1 text-xs text-zinc-500">
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
          </section>
        </div>

        <CreateRefundModal
          open={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          sale={sale}
          defaultRestockInventory={hasProductLine}
        />
      </aside>
    </div>
  );
}
