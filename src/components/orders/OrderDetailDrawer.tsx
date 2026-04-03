"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerUiStore } from "@/stores/customer-ui-store";
import { useOrdersStore } from "@/stores/orders-store";
import { useOrderUiStore } from "@/stores/order-ui-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { usePosStore } from "@/stores/pos-store";
import { useRefundsStore } from "@/stores/refunds-store";
import type { OrderStatus } from "@/types/orders";
import type { OrderLine } from "@/types/orders";
import { paymentMethodLabel } from "@/lib/payment-totals";
import { CreateRefundModal } from "@/components/refunds/CreateRefundModal";
import { RefundCreateButton } from "@/components/refunds/RefundCreateButton";
import { CustomerPicker } from "@/components/customers/CustomerPicker";
import { orderCustomerSnapshotFromCustomer } from "@/lib/customer-helpers";
import {
  refundManagerPinHint,
  refundSignInBlockedMessage,
} from "@/lib/rbac";
import { useSessionStore } from "@/stores/session-store";

function statusPill(status: OrderStatus): string {
  switch (status) {
    case "open":
      return "bg-emerald-500/15 text-emerald-200/90";
    case "pending":
      return "bg-sky-500/15 text-sky-200/90";
    case "partially_paid":
      return "bg-amber-500/15 text-amber-200/90";
    case "paid":
      return "bg-emerald-500/15 text-emerald-300/90";
    case "fulfilled":
      return "bg-violet-500/15 text-violet-200/90";
    case "cancelled":
      return "bg-rose-500/15 text-rose-200/90";
    case "refunded":
      return "bg-cyan-500/15 text-cyan-200/90";
  }
}

function RepairOrCustomPill({ line }: { line: OrderLine }) {
  if (line.lineKind === "custom") {
    const exempt = line.taxable === false;
    return (
      <span
        className={`shrink-0 rounded-md bg-cyan-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-200/90 ${
          exempt ? "opacity-90" : ""
        }`}
      >
        Custom{exempt ? " · tax-exempt" : ""}
      </span>
    );
  }
  if (line.lineKind === "repair") {
    return (
      <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-200/90">
        Repair
      </span>
    );
  }
  return null;
}

function LineRow({ line }: { line: OrderLine }) {
  return (
    <li className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-200">{line.name}</span>
        <RepairOrCustomPill line={line} />
      </div>
      <p className="mt-1 font-mono text-xs text-zinc-500">
        {line.sku} · {line.quantity} × ${line.unitPrice.toFixed(2)}
      </p>
      {line.lineKind === "custom" && line.note ? (
        <p className="mt-1 text-xs text-zinc-500">{line.note}</p>
      ) : null}
      {line.lineKind === "custom" && line.categoryLabel ? (
        <p className="mt-1 text-[0.65rem] text-zinc-600">
          {line.categoryLabel}
        </p>
      ) : null}
    </li>
  );
}

export function OrderDetailDrawer() {
  const router = useRouter();
  const detailOrderId = useOrderUiStore((s) => s.detailOrderId);
  const closeOrderDetail = useOrderUiStore((s) => s.closeOrderDetail);
  const orders = useOrdersStore((s) => s.orders);
  const recentSales = usePosStore((s) => s.recentSales);
  const setSelectedTicketId = useRepairsStore((s) => s.setSelectedTicketId);
  const refunds = useRefundsStore((s) => s.refunds);
  const sessionEmployee = useSessionStore((s) => s.employee);
  const setOrderCustomer = useOrdersStore((s) => s.setOrderCustomer);

  const order = useMemo(() => {
    if (!detailOrderId) return null;
    return orders.find((o) => o.id === detailOrderId) ?? null;
  }, [detailOrderId, orders]);

  const refundsForOrder = useMemo(() => {
    if (!order) return [];
    return refunds.filter((r) => order.linkedSaleIds.includes(r.saleId));
  }, [order, refunds]);

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSaleId, setRefundSaleId] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setRefundModalOpen(false);
    setRefundSaleId(order.linkedSaleIds[0] ?? null);
  }, [order]);

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

  const refundSignInBlocked = refundSignInBlockedMessage(sessionEmployee);
  const refundPinHint = refundManagerPinHint(sessionEmployee);

  useEffect(() => {
    if (!detailOrderId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOrderDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOrderId, closeOrderDetail]);

  if (!detailOrderId || !order) return null;

  const orderBy = sessionEmployee
    ? { employeeId: sessionEmployee.id, name: sessionEmployee.name }
    : null;

  const canEditCustomer =
    order.status === "open" ||
    order.status === "pending" ||
    order.status === "partially_paid";

  const openLinkedRepair = () => {
    if (!order.linkedRepairTicketId) return;
    closeOrderDetail();
    setSelectedTicketId(order.linkedRepairTicketId);
    router.push("/repairs");
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close order panel"
        onClick={closeOrderDetail}
      />
      <aside
        className="relative flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <h2
              id="order-detail-title"
              className="font-mono text-sm font-semibold text-emerald-400/90"
            >
              Order
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-zinc-500">
              {order.id}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {new Date(order.updatedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={closeOrderDetail}
            className="touch-pad shrink-0 rounded-xl border border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-400 active:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section className="space-y-2 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Status & totals
              </h3>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${statusPill(
                  order.status,
                )}`}
              >
                {order.status.replaceAll("_", " ")}
              </span>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="font-mono text-zinc-200">
                  ${order.subtotal.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Tax</dt>
                <dd className="font-mono text-zinc-200">${order.tax.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                <dt className="text-zinc-500">Total due</dt>
                <dd className="font-mono text-zinc-100">${order.total.toFixed(2)}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Customer
            </h3>
            <div className="space-y-1 text-sm text-zinc-300">
              <p className="font-medium">{order.customer?.name ?? "Walk-in"}</p>
              {order.customer?.phone ? (
                <p className="font-mono text-xs text-zinc-500">{order.customer.phone}</p>
              ) : null}
              {order.customer?.email ? (
                <p className="font-mono text-xs text-zinc-500">{order.customer.email}</p>
              ) : null}
              {order.customer?.customerId ? (
                <button
                  type="button"
                  onClick={() => {
                    useCustomerUiStore.getState().openCustomerDetail(
                      order.customer!.customerId!,
                    );
                    closeOrderDetail();
                    router.push("/customers");
                  }}
                  className="mt-2 text-xs font-semibold text-emerald-400/90 underline"
                >
                  Open customer profile
                </button>
              ) : null}
            </div>
            {canEditCustomer ? (
              <div className="border-t border-zinc-800/80 pt-3">
                <CustomerPicker
                  selectedCustomerId={order.customer?.customerId ?? null}
                  createdBy={orderBy}
                  onSelect={(c) =>
                    void setOrderCustomer(
                      order.id,
                      orderCustomerSnapshotFromCustomer(c),
                      orderBy,
                    )
                  }
                  onClear={() => void setOrderCustomer(order.id, null, orderBy)}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Line items
            </h3>
            <ul className="space-y-2">
              {order.lines.map((line) => (
                <LineRow key={line.id} line={line} />
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Payment
            </h3>
            {order.paymentSummary ? (
              <div className="space-y-2">
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Collected</dt>
                    <dd className="font-mono text-zinc-200">
                      ${order.paymentSummary.totalCollected.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Remaining</dt>
                    <dd className="font-mono text-zinc-200">
                      ${order.paymentSummary.remainingBalance.toFixed(2)}
                    </dd>
                  </div>
                  {order.paymentSummary.changeDue > 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">Change</dt>
                      <dd className="font-mono text-sky-300">
                        ${order.paymentSummary.changeDue.toFixed(2)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {order.paymentSummary.payments.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {order.paymentSummary.payments.map((p) => (
                      <li key={p.id} className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2">
                        <div className="flex justify-between gap-2 font-medium text-zinc-200">
                          <span>{paymentMethodLabel(p.method)}</span>
                          <span className="font-mono">${p.amount.toFixed(2)}</span>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                          {new Date(p.recordedAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                        {p.note ? <p className="mt-1 text-xs text-zinc-400">{p.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No payment recorded yet.
              </p>
            )}
          </section>

          {order.linkedRepairTicketId ? (
            <button
              type="button"
              onClick={openLinkedRepair}
              className="touch-pad w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-3 text-sm font-semibold text-emerald-100"
            >
              Open linked repair ticket
            </button>
          ) : null}

          <section className="space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Linked transactions
            </h3>
            {order.linkedSaleIds.length === 0 ? (
              <p className="text-sm text-zinc-500">None yet.</p>
            ) : (
              <ul className="space-y-2">
                {order.linkedSaleIds.map((saleId) => (
                  <li
                    key={saleId}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 font-mono text-xs text-zinc-300"
                  >
                    {saleId}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Refunds
              </h3>
              <RefundCreateButton
                signInBlockedMessage={refundSignInBlocked}
                managerPinHint={refundPinHint}
                prereqMet={order.linkedSaleIds.length > 0}
                onClick={() => setRefundModalOpen(true)}
              />
            </div>

            {refundsForOrder.length === 0 ? (
              <p className="text-sm text-zinc-500">No refunds yet.</p>
            ) : (
              <ul className="space-y-2">
                {refundsForOrder.slice(0, 10).map((r) => (
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

          <section className="space-y-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              History
            </h3>
            <ul className="space-y-2">
              {order.history.length === 0 ? (
                <li className="text-sm text-zinc-500">No history yet.</li>
              ) : (
                order.history.slice(0, 30).map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-zinc-200 text-sm">
                        {h.type.replaceAll("_", " ")}
                      </p>
                      <p className="font-mono text-[11px] text-zinc-500">
                        {new Date(h.at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    {h.toStatus ? (
                      <p className="mt-1 text-xs text-zinc-400">
                        → {h.toStatus.replaceAll("_", " ")}
                      </p>
                    ) : null}
                    {h.linkedSaleId ? (
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">
                        Sale: {h.linkedSaleId.slice(0, 10)}…
                      </p>
                    ) : null}
                    {h.note ? (
                      <p className="mt-1 text-xs text-zinc-400">{h.note}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </aside>

      {saleForRefund ? (
        <CreateRefundModal
          open={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          sale={saleForRefund}
          defaultRestockInventory={hasProductLineForRefund}
        />
      ) : null}
    </div>
  );
}

