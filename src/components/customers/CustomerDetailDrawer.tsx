"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { computeCustomerSummaryMetrics } from "@/lib/customer-history";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { useCustomerUiStore } from "@/stores/customer-ui-store";
import { useCustomersStore } from "@/stores/customers-store";
import { useOrdersStore } from "@/stores/orders-store";
import { useOrderUiStore } from "@/stores/order-ui-store";
import { usePosStore } from "@/stores/pos-store";
import { useRefundsStore } from "@/stores/refunds-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { useSessionStore } from "@/stores/session-store";
import { useTransactionUiStore } from "@/stores/transaction-ui-store";
import { REPAIR_STATUS_LABELS } from "@/types/repairs";

export function CustomerDetailDrawer() {
  const router = useRouter();
  const detailId = useCustomerUiStore((s) => s.detailCustomerId);
  const close = useCustomerUiStore((s) => s.closeCustomerDetail);
  const getCustomer = useCustomersStore((s) => s.getCustomerById);
  const addCustomerNote = useCustomersStore((s) => s.addCustomerNote);
  const archiveCustomer = useCustomersStore((s) => s.archiveCustomer);
  const restoreCustomer = useCustomersStore((s) => s.restoreCustomer);
  const tickets = useRepairsStore((s) => s.tickets);
  const setSelectedTicketId = useRepairsStore((s) => s.setSelectedTicketId);
  const orders = useOrdersStore((s) => s.orders);
  const openOrderDetail = useOrderUiStore((s) => s.openOrderDetail);
  const recentSales = usePosStore((s) => s.recentSales);
  const openTransactionDetail = useTransactionUiStore(
    (s) => s.openTransactionDetail,
  );
  const refunds = useRefundsStore((s) => s.refunds);
  const employee = useSessionStore((s) => s.employee);

  const [noteDraft, setNoteDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const customer = detailId ? getCustomer(detailId) : null;

  const salesById = useMemo(() => {
    const m = new Map<string, (typeof recentSales)[0]>();
    for (const s of recentSales) m.set(s.id, s);
    return m;
  }, [recentSales]);

  const metrics = useMemo(() => {
    if (!customer) return null;
    return computeCustomerSummaryMetrics({
      customerId: customer.id,
      tickets,
      orders,
      sales: recentSales,
      refunds,
    });
  }, [customer, tickets, orders, recentSales, refunds]);

  const tix = useMemo(() => {
    if (!customer) return [];
    return tickets
      .filter((t) => t.linkedCustomerId === customer.id)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [customer, tickets]);

  const ords = useMemo(() => {
    if (!customer) return [];
    return orders
      .filter((o) => o.customer?.customerId === customer.id)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [customer, orders]);

  const sales = useMemo(() => {
    if (!customer) return [];
    return recentSales
      .filter((s) => s.customerId === customer.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [customer, recentSales]);

  const rf = useMemo(() => {
    if (!customer) return [];
    return refunds
      .filter((r) => salesById.get(r.saleId)?.customerId === customer.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [customer, refunds, salesById]);

  if (!detailId || !customer) return null;

  const author = employee
    ? { employeeId: employee.id, name: employee.name }
    : null;

  return (
    <div className="fixed inset-0 z-[95] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close customer panel"
        onClick={close}
      />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-semibold text-emerald-400/90">
              Customer
            </h2>
            <p className="mt-1 truncate text-lg font-semibold text-zinc-100">
              {customer.fullName}
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-500">{customer.id}</p>
            {!customer.active ? (
              <p className="mt-2 text-xs font-semibold uppercase text-amber-400">
                Archived
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="touch-pad shrink-0 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {metrics ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard label="Repairs" value={String(metrics.repairTicketCount)} />
              <MetricCard label="Orders" value={String(metrics.orderCount)} />
              <MetricCard label="Sales" value={String(metrics.saleCount)} />
              <MetricCard label="Refunds" value={String(metrics.refundCount)} />
              <MetricCard
                label="Orders Σ"
                value={`$${metrics.ordersTotal.toFixed(0)}`}
              />
              <MetricCard
                label="Sales Σ"
                value={`$${metrics.salesTotal.toFixed(0)}`}
              />
            </div>
          ) : null}

          <section className="rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Contact
            </h3>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Phone</dt>
                <dd className="font-mono text-zinc-200">{customer.phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Email</dt>
                <dd className="truncate text-zinc-200">{customer.email || "—"}</dd>
              </div>
              {customer.company ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Company</dt>
                  <dd className="text-zinc-200">{customer.company}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Marketing</dt>
                <dd className="text-zinc-200">
                  {customer.marketingOptIn ? "Opted in" : "No"}
                </dd>
              </div>
            </dl>
            {customer.address ? (
              <p className="mt-3 text-xs text-zinc-400">
                {customer.address.line1}
                {customer.address.line2 ? `, ${customer.address.line2}` : ""}
                <br />
                {customer.address.city}
                {customer.address.region ? `, ${customer.address.region}` : ""}{" "}
                {customer.address.postalCode ?? ""}
              </p>
            ) : null}
            {customer.notes ? (
              <p className="mt-3 text-sm text-zinc-400">{customer.notes}</p>
            ) : null}
            {customer.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {customer.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300"
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="touch-pad rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200"
            >
              Edit
            </button>
            {customer.active ? (
              <button
                type="button"
                onClick={() => void archiveCustomer(customer.id)}
                className="touch-pad rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-300"
              >
                Archive
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void restoreCustomer(customer.id)}
                className="touch-pad rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-200"
              >
                Restore
              </button>
            )}
          </div>

          <section className="space-y-2 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Add note
            </h3>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="min-h-[4rem] w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100"
              placeholder="Operational note…"
            />
            <button
              type="button"
              onClick={() => {
                const r = addCustomerNote(customer.id, noteDraft, author);
                if (r.ok) setNoteDraft("");
              }}
              className="touch-pad rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save note
            </button>
          </section>

          <HistoryBlock
            title="Repair tickets"
            empty="No linked repairs."
            items={tix.slice(0, 15).map((t) => ({
              id: t.id,
              primary: t.id,
              secondary: `${REPAIR_STATUS_LABELS[t.status]} · ${t.brandModel}`,
              onOpen: () => {
                close();
                setSelectedTicketId(t.id);
                router.push("/repairs");
              },
            }))}
          />

          <HistoryBlock
            title="Orders"
            empty="No linked orders."
            items={ords.slice(0, 15).map((o) => ({
              id: o.id,
              primary: o.label || o.id.slice(0, 10),
              secondary: `${o.status} · $${o.total.toFixed(2)}`,
              onOpen: () => {
                close();
                openOrderDetail(o.id);
                router.push("/orders");
              },
            }))}
          />

          <HistoryBlock
            title="Transactions"
            empty="No linked register sales in local history."
            items={sales.slice(0, 15).map((s) => ({
              id: s.id,
              primary: s.id.slice(0, 12) + "…",
              secondary: `$${s.totalDue.toFixed(2)} · ${new Date(s.createdAt).toLocaleDateString()}`,
              onOpen: () => {
                close();
                openTransactionDetail(s.id);
                router.push("/transactions");
              },
            }))}
          />

          <HistoryBlock
            title="Refunds"
            empty="No refunds on linked sales."
            items={rf.slice(0, 10).map((r) => ({
              id: r.id,
              primary: r.id.slice(0, 10) + "…",
              secondary: `$${r.summary.refundedTotal.toFixed(2)}`,
              onOpen: () => {
                const sale = salesById.get(r.saleId);
                if (sale) {
                  close();
                  openTransactionDetail(sale.id);
                  router.push("/transactions");
                }
              },
            }))}
          />

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Note history
            </h3>
            {customer.customerNotes.length === 0 ? (
              <p className="text-sm text-zinc-500">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {customer.customerNotes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3 text-sm"
                  >
                    <p className="text-zinc-200">{n.body}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-500">
                      {new Date(n.createdAt).toLocaleString()}
                      {n.createdBy ? ` · ${n.createdBy.name}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-center text-xs text-zinc-600">
            <Link
              href="/customers"
              className="text-emerald-400/90 underline"
              onClick={close}
            >
              Back to customers list
            </Link>
          </p>
        </div>
      </aside>

      <CustomerFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        customer={customer}
        createdBy={author}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-2 py-2 text-center">
      <p className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-100">
        {value}
      </p>
    </div>
  );
}

function HistoryBlock(props: {
  title: string;
  empty: string;
  items: {
    id: string;
    primary: string;
    secondary: string;
    onOpen: () => void;
  }[];
}) {
  return (
    <section className="rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {props.title}
      </h3>
      {props.items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{props.empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {props.items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={it.onOpen}
                className="flex w-full flex-col rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-left hover:border-emerald-500/30"
              >
                <span className="font-mono text-xs text-zinc-200">
                  {it.primary}
                </span>
                <span className="text-[11px] text-zinc-500">{it.secondary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
