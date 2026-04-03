"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CreateRepairTicketModal } from "@/components/repairs/CreateRepairTicketModal";
import { RepairTicketDrawer } from "@/components/repairs/RepairTicketDrawer";
import {
  filterRepairTickets,
  type RepairQuickFilter,
  type RepairSortKey,
  sortRepairTickets,
} from "@/lib/repair-query";
import { useRepairsStore } from "@/stores/repairs-store";
import { useSessionStore } from "@/stores/session-store";
import {
  REPAIR_PAYMENT_STATE_LABELS,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  type RepairPaymentState,
  type RepairStatus,
} from "@/types/repairs";

export function RepairsWorkspace() {
  const tickets = useRepairsStore((s) => s.tickets);
  const selectedTicketId = useRepairsStore((s) => s.selectedTicketId);
  const setSelectedTicketId = useRepairsStore((s) => s.setSelectedTicketId);
  const employee = useSessionStore((s) => s.employee);

  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<RepairQuickFilter>("all");
  const [statusFilter, setStatusFilter] = useState<RepairStatus | "all">("all");
  const [sortKey, setSortKey] = useState<RepairSortKey>("updated_desc");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = filterRepairTickets(tickets, {
      search,
      statusFilter,
      quickFilter,
      currentEmployeeId: employee?.id ?? null,
    });
    return sortRepairTickets(q, sortKey);
  }, [
    tickets,
    search,
    statusFilter,
    quickFilter,
    sortKey,
    employee?.id,
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        variant="device"
        title="Queue"
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="touch-pad rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white active:bg-emerald-500"
          >
            + Ticket
          </button>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="repair-search">
            Search
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              id="repair-search"
              type="search"
              placeholder="Search customer, device, issue, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[3.25rem] rounded-xl border border-zinc-800 bg-zinc-950/70 py-2 pl-11 pr-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <label className="flex flex-col text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Status
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as RepairStatus | "all")
              }
              className="mt-1 min-h-11 min-w-[9.5rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm font-medium text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All statuses</option>
              {REPAIR_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {REPAIR_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Sort
            <select
              value={sortKey}
              onChange={(e) =>
                setSortKey(e.target.value as RepairSortKey)
              }
              className="mt-1 min-h-11 min-w-[11rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm font-medium text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="updated_desc">Recently updated</option>
              <option value="created_desc">Newest created</option>
              <option value="customer_asc">Customer A–Z</option>
              <option value="status_asc">Status (pipeline)</option>
              <option value="price_desc">Est. price (high)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="All"
          active={quickFilter === "all"}
          onClick={() => setQuickFilter("all")}
        />
        <FilterChip
          label="Mine"
          active={quickFilter === "mine"}
          onClick={() => setQuickFilter("mine")}
        />
        <FilterChip
          label="Today"
          active={quickFilter === "today"}
          onClick={() => setQuickFilter("today")}
        />
        <FilterChip
          label="Parts"
          active={quickFilter === "waiting_parts"}
          onClick={() => setQuickFilter("waiting_parts")}
        />
      </div>

      <p className="text-sm text-zinc-500">
        Showing {filtered.length} of {tickets.length} ticket
        {tickets.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Parts</th>
                <th className="px-4 py-3 text-right">Est.</th>
                <th className="px-4 py-3">Tech</th>
                <th className="px-4 py-3 text-right">Intake</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/90">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-base text-zinc-500"
                  >
                    No tickets match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer bg-zinc-900/20 hover:bg-zinc-900/50"
                    onClick={() => setSelectedTicketId(t.id)}
                  >
                    <td className="px-4 py-4 font-mono text-sm font-medium text-emerald-400/90">
                      {t.id}
                    </td>
                    <td className="px-4 py-4 text-base font-medium text-zinc-200">
                      {t.customerName}
                    </td>
                    <td className="px-4 py-4 text-base text-zinc-400">
                      {t.brandModel}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-4 text-base text-zinc-400">
                      {t.issueDescription}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-4">
                      <PaymentStatePill state={t.repairPaymentState} />
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-zinc-400">
                      {t.partsUsage.length === 0
                        ? "—"
                        : `${t.partsUsage.length} line${t.partsUsage.length === 1 ? "" : "s"}`}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm font-medium text-emerald-400/90">
                      ${t.estimatedPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {t.assignment?.technicianName ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-zinc-500">
                      {t.intakeDate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateRepairTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => setSelectedTicketId(id)}
      />

      <RepairTicketDrawer
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
      />
    </div>
  );
}

function PaymentStatePill({ state }: { state: RepairPaymentState }) {
  const cls =
    state === "paid"
      ? "bg-emerald-500/15 text-emerald-300"
      : state === "partially_paid"
        ? "bg-sky-500/15 text-sky-200"
        : "bg-zinc-800/90 text-zinc-400";
  return (
    <span
      className={`inline-block max-w-[9rem] truncate rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
      title={REPAIR_PAYMENT_STATE_LABELS[state]}
    >
      {REPAIR_PAYMENT_STATE_LABELS[state]}
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
        active
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
          : "border-zinc-800 bg-zinc-950/60 text-zinc-400 active:bg-zinc-900"
      }`}
    >
      {label}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
