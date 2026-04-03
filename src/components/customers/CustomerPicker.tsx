"use client";

import { useMemo, useState } from "react";
import { filterCustomers } from "@/lib/customer-query";
import { useCustomersStore } from "@/stores/customers-store";
import type { Customer } from "@/types/customers";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";

export type CustomerPickerProps = {
  selectedCustomerId: string | null;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
  createdBy: { employeeId: string; name: string } | null;
  /** Include inactive profiles in search results */
  includeArchived?: boolean;
  className?: string;
};

export function CustomerPicker({
  selectedCustomerId,
  onSelect,
  onClear,
  createdBy,
  includeArchived = false,
  className = "",
}: CustomerPickerProps) {
  const customers = useCustomersStore((s) => s.customers);
  const getById = useCustomersStore((s) => s.getCustomerById);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return filterCustomers(customers, {
      query: q,
      status: includeArchived ? "all" : "active",
    }).slice(0, 12);
  }, [customers, q, includeArchived]);

  const selected = selectedCustomerId
    ? getById(selectedCustomerId)
    : null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Find customer
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, email…"
            className="mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="touch-pad mt-6 shrink-0 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-200"
        >
          New
        </button>
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-100">{selected.fullName}</p>
            <p className="truncate font-mono text-xs text-zinc-500">
              {selected.phone || "—"} · {selected.email || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="touch-pad shrink-0 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400"
          >
            Unlink
          </button>
        </div>
      ) : null}

      {!selected && q.trim() ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-1">
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-sm text-zinc-500">No matches.</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setQ("");
                  }}
                  className="flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-800/80"
                >
                  <span className="font-medium text-zinc-200">{c.fullName}</span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {c.phone || "—"} · {c.email || "—"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      <CustomerFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        createdBy={createdBy}
        onSaved={(id) => {
          const c = useCustomersStore.getState().getCustomerById(id);
          if (c) onSelect(c);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
