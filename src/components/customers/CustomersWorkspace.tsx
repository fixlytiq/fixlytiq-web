"use client";

import { useMemo, useState } from "react";
import { filterCustomers } from "@/lib/customer-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCustomerUiStore } from "@/stores/customer-ui-store";
import { useCustomersStore } from "@/stores/customers-store";
import { useSessionStore } from "@/stores/session-store";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";

const STATUS_TABS = [
  { id: "active" as const, label: "Active" },
  { id: "archived" as const, label: "Archived" },
  { id: "all" as const, label: "All" },
];

export function CustomersWorkspace() {
  const customers = useCustomersStore((s) => s.customers);
  const openDetail = useCustomerUiStore((s) => s.openCustomerDetail);
  const employee = useSessionStore((s) => s.employee);
  const author = employee
    ? { employeeId: employee.id, name: employee.name }
    : null;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>(
    "active",
  );
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return filterCustomers(customers, { query: search, status })
      .slice()
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, {
          sensitivity: "base",
        }),
      );
  }, [customers, search, status]);

  return (
    <div className="space-y-4">
      <PageHeader
        variant="device"
        title="Customers"
        description="Local profiles linked to repairs, orders, and register sales."
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="touch-pad rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          + New customer
        </button>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, email, id…"
            className="mt-1 w-full min-h-[3rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatus(t.id)}
              className={`touch-pad shrink-0 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                status === t.id
                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35"
                  : "bg-zinc-950/60 text-zinc-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <ul className="space-y-2">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => openDetail(c.id)}
              className="flex w-full flex-col gap-1 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 px-4 py-3 text-left transition hover:border-emerald-500/25"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-zinc-100">{c.fullName}</span>
                {!c.active ? (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-400">
                    Archived
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-xs text-zinc-500">
                {c.phone || "—"} · {c.email || "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">No customers match.</p>
      ) : null}

      <CustomerFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        createdBy={author}
        onSaved={(id) => {
          setCreateOpen(false);
          openDetail(id);
        }}
      />
    </div>
  );
}
