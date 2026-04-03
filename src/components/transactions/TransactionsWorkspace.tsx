"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransactionTypeBadge } from "@/components/transactions/TransactionTypeBadge";
import {
  filterTransactions,
  summarizeForDay,
  type TransactionFilters,
  type TransactionTypeFilter,
} from "@/lib/transactions-query";
import { usePosStore } from "@/stores/pos-store";
import { useSessionStore } from "@/stores/session-store";
import { useTransactionUiStore } from "@/stores/transaction-ui-store";
import { PAYMENT_METHOD_LABELS } from "@/types/payment";
import type { Sale } from "@/types/pos";

type DateInputValue = string; // YYYY-MM-DD or ""

function todayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TransactionsWorkspace() {
  const sales = usePosStore((s) => s.recentSales);
  const employee = useSessionStore((s) => s.employee);
  const openTransactionDetail = useTransactionUiStore(
    (s) => s.openTransactionDetail,
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<TransactionTypeFilter>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string | "all">("all");
  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState<string | "all">("all");
  const [dateFrom, setDateFrom] = useState<DateInputValue>("");
  const [dateTo, setDateTo] = useState<DateInputValue>("");

  const filterState: TransactionFilters = {
    search,
    type: typeFilter,
    employeeId: employeeFilter,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    paymentMethod: paymentMethodFilter,
  };

  const filtered = useMemo(
    () => filterTransactions(sales, filterState),
    [sales, filterState],
  );

  const todaySummary = useMemo(
    () => summarizeForDay(sales, new Date()),
    [sales],
  );

  const employeeOptions = useMemo(() => {
    const ids = new Map<string, string>();
    for (const s of sales) {
      if (s.processedBy) {
        ids.set(s.processedBy.employeeId, s.processedBy.name);
      }
    }
    return Array.from(ids.entries()).map(([id, name]) => ({ id, name }));
  }, [sales]);

  const paymentMethods = useMemo(() => {
    const set = new Set<string>();
    for (const s of sales) {
      if (s.paymentMethod?.trim()) set.add(s.paymentMethod.trim());
      for (const p of s.payments ?? []) {
        set.add(PAYMENT_METHOD_LABELS[p.method]);
      }
      const pays = s.payments ?? [];
      if (
        pays.some((p) => p.method === "cash") &&
        pays.some((p) => p.method === "card")
      ) {
        set.add("Split");
      }
    }
    return Array.from(set.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [sales]);

  const todayLabel = todayLocalDateString();

  return (
    <div className="space-y-4">
      <PageHeader
        variant="device"
        title="Transactions"
        description="All recorded sales from the register."
      />

      <section className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Transactions today"
          value={todaySummary.count.toString()}
          helper={todayLabel}
        />
        <SummaryCard
          label="Revenue today"
          value={`$${todaySummary.totalRevenue.toFixed(2)}`}
          helper={todayLabel}
        />
        <SummaryCard
          label="Repair revenue today"
          value={`$${todaySummary.repairRevenue.toFixed(2)}`}
          helper={
            todaySummary.repairCount > 0
              ? `${todaySummary.repairCount} repair ${
                  todaySummary.repairCount === 1 ? "ticket" : "tickets"
                }`
              : "No repair payments today"
          }
        />
        <SummaryCard
          label="Avg. ticket"
          value={
            todaySummary.count === 0
              ? "$0.00"
              : `$${todaySummary.averageTicket.toFixed(2)}`
          }
          helper="Across today's transactions"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Transaction, repair ticket, or customer…"
              className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Matches transaction id, repair ticket number, or repair customer
            snapshot.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Type
            <select
              className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as TransactionTypeFilter)
              }
            >
              <option value="all">All</option>
              <option value="product_sale">Product sale</option>
              <option value="repair_payment">Repair payment</option>
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Employee
            <select
              className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={employeeFilter}
              onChange={(e) =>
                setEmployeeFilter(
                  e.target.value === "" ? "all" : e.target.value,
                )
              }
            >
              <option value="">All</option>
              {employeeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                  {employee?.id === opt.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Payment
            <select
              className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={paymentMethodFilter}
              onChange={(e) =>
                setPaymentMethodFilter(
                  e.target.value === "" ? "all" : e.target.value,
                )
              }
            >
              <option value="">All</option>
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 md:w-[18rem]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/90 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Date / time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Processed by</th>
                <th className="px-4 py-3">Linked repair</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Lines</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-base text-zinc-500"
                  >
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => (
                  <TransactionRow
                    key={sale.id}
                    sale={sale}
                    onOpenDetail={openTransactionDetail}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-50">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-xs text-zinc-500">{helper}</p>
      ) : null}
    </div>
  );
}

function TransactionRow({
  sale,
  onOpenDetail,
}: {
  sale: Sale;
  onOpenDetail: (id: string) => void;
}) {
  const dt = new Date(sale.createdAt);
  const repairId =
    sale.repairCheckouts?.[0]?.repairTicketNumber ??
    sale.repairCheckouts?.[0]?.linkedRepairTicketId ??
    sale.linkedRepairTicketId ??
    sale.lines.find((l) => l.repairTicketId)?.repairTicketId ??
    null;

  return (
    <tr className="bg-zinc-950/60 hover:bg-zinc-900/80">
      <td className="px-4 py-3 align-middle">
        <p className="font-mono text-xs text-emerald-300">
          {sale.id.slice(0, 10)}…
        </p>
      </td>
      <td className="px-4 py-3 align-middle text-sm text-zinc-300">
        {dt.toLocaleDateString(undefined, {
          month: "short",
          day: "2-digit",
        })}{" "}
        ·{" "}
        {dt.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-3 align-middle">
        <TransactionTypeBadge sale={sale} />
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <span className="font-mono text-sm font-semibold text-zinc-50">
          ${sale.total.toFixed(2)}
        </span>
      </td>
      <td className="px-4 py-3 align-middle text-sm text-zinc-300">
        {sale.processedBy?.name ?? "—"}
      </td>
      <td className="px-4 py-3 align-middle text-sm text-emerald-300">
        {repairId ?? "—"}
      </td>
      <td className="px-4 py-3 align-middle text-sm text-zinc-300">
        {sale.paymentMethod?.trim() || "—"}
      </td>
      <td className="px-4 py-3 align-middle text-right text-sm text-zinc-300">
        {sale.lines.length}
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <button
          type="button"
          onClick={() => onOpenDetail(sale.id)}
          className="touch-pad inline-flex items-center rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
        >
          View
        </button>
      </td>
    </tr>
  );
}

