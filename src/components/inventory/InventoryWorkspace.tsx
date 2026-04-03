"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { InventoryItemDrawer } from "@/components/inventory/InventoryItemDrawer";
import { InventoryItemFormModal } from "@/components/inventory/InventoryItemFormModal";
import {
  filterInventoryItems,
  sortInventoryItems,
  type InventorySortKey,
} from "@/lib/inventory-query";
import { lowStockItems } from "@/lib/inventory-low-stock";
import { useInventoryStore } from "@/stores/inventory-store";

export function InventoryWorkspace() {
  const items = useInventoryStore((s) => s.items);
  const selectedItemId = useInventoryStore((s) => s.selectedItemId);
  const setSelectedItemId = useInventoryStore((s) => s.setSelectedItemId);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortKey, setSortKey] = useState<InventorySortKey>("name_asc");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formItemId, setFormItemId] = useState<string | null>(null);

  const categories = useInventoryStore((s) => s.categories);

  const filtered = useMemo(() => {
    const q = filterInventoryItems(items, {
      search,
      categoryId,
      lowStockOnly,
    });
    return sortInventoryItems(q, sortKey);
  }, [items, search, categoryId, lowStockOnly, sortKey]);

  const lowList = useMemo(() => lowStockItems(items), [items]);

  const stats = useMemo(() => {
    const skuCount = items.length;
    const costValue = items.reduce(
      (s, i) => s + i.quantityOnHand * i.costPrice,
      0,
    );
    return {
      skuCount,
      costValue,
      lowCount: lowStockItems(items).length,
    };
  }, [items]);

  const openCreate = () => {
    setFormMode("create");
    setFormItemId(null);
    setFormOpen(true);
  };

  const openEdit = (id: string) => {
    setFormMode("edit");
    setFormItemId(id);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        variant="device"
        title="Stock"
        actions={
          <button
            type="button"
            disabled
            title="Import coming later"
            className="touch-pad cursor-not-allowed rounded-xl border border-zinc-800 bg-zinc-950/50 px-5 text-base font-semibold text-zinc-600"
          >
            Import
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-4">
        <StatCard
          size="device"
          label="SKUs"
          value={String(stats.skuCount)}
          icon={<span>▦</span>}
        />
        <StatCard
          size="device"
          label="Cost value"
          value={`$${(stats.costValue / 1000).toFixed(1)}k`}
          hint="Qty × cost"
          icon={<span>$</span>}
        />
        <StatCard
          size="device"
          label="Low"
          value={String(stats.lowCount)}
          trend={{ text: "reorder", positive: false }}
          icon={<span>↓</span>}
        />
        <StatCard
          size="device"
          label="Turn 30d"
          value="—"
          hint="Needs sales link"
          icon={<span>↻</span>}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <div className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-base font-semibold text-zinc-100">On hand</h3>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Category
              <select
                value={categoryId}
                onChange={(e) =>
                  setCategoryId(e.target.value as string | "all")
                }
                className="mt-1 min-h-11 min-w-[9rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm font-medium text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sort
              <select
                value={sortKey}
                onChange={(e) =>
                  setSortKey(e.target.value as InventorySortKey)
                }
                className="mt-1 min-h-11 min-w-[10.5rem] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-sm font-medium text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="name_asc">Name A–Z</option>
                <option value="sku_asc">SKU A–Z</option>
                <option value="qty_desc">Qty high → low</option>
                <option value="qty_asc">Qty low → high</option>
                <option value="sale_desc">Sale price</option>
                <option value="updated_desc">Recently updated</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setLowStockOnly((v) => !v)}
              className={`mt-5 min-h-11 self-end rounded-full border px-4 text-sm font-semibold ${
                lowStockOnly
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 active:bg-zinc-900"
              }`}
            >
              Low stock
            </button>
          </div>
        </div>

        <div className="border-b border-zinc-800 bg-zinc-900/30 px-4 py-3">
          <label className="sr-only" htmlFor="inv-search">
            Search inventory
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              id="inv-search"
              type="search"
              placeholder="Search SKU, name, barcode, bin…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[3.25rem] rounded-xl border border-zinc-800 bg-zinc-950/70 py-2 pl-11 pr-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Showing {filtered.length} of {items.length} SKU
            {items.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-b border-zinc-800 bg-zinc-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="touch-pad rounded-xl bg-emerald-600 px-5 text-base font-semibold text-white active:bg-emerald-500"
          >
            + SKU
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Bin</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3 text-right">OK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/90">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-base text-zinc-500"
                  >
                    No SKUs match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const healthy = r.quantityOnHand > r.reorderThreshold;
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer bg-zinc-900/15 hover:bg-zinc-900/40"
                      onClick={() => setSelectedItemId(r.id)}
                    >
                      <td className="px-4 py-4 font-mono text-sm text-emerald-400/90">
                        {r.sku}
                      </td>
                      <td className="px-4 py-4 text-base font-medium text-zinc-200">
                        {r.name}
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-zinc-500">
                        {r.locationBin}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-base text-zinc-200">
                        {r.quantityOnHand}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-base text-zinc-500">
                        {r.reorderThreshold}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            healthy
                              ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25"
                              : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/25"
                          }`}
                        >
                          {healthy ? "OK" : "Low"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lowList.length > 0 ? (
        <section className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-rose-100">Reorder</h3>
            <button
              type="button"
              disabled
              title="Purchase orders — later"
              className="touch-pad cursor-not-allowed rounded-xl border border-rose-500/25 bg-rose-950/20 px-5 text-base font-semibold text-rose-200/50"
            >
              PO
            </button>
          </div>
          <ul className="mt-4 divide-y divide-rose-500/15">
            {lowList.map((r) => (
              <li
                key={r.id}
                className="flex cursor-pointer flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => setSelectedItemId(r.id)}
              >
                <div>
                  <p className="font-mono text-sm text-rose-200/90">{r.sku}</p>
                  <p className="text-base font-medium text-zinc-100">
                    {r.name}
                  </p>
                </div>
                <div className="flex items-center gap-4 font-mono text-base text-rose-100/90">
                  <span>Qty {r.quantityOnHand}</span>
                  <span className="text-rose-200/60">
                    min {r.reorderThreshold}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <InventoryItemFormModal
        open={formOpen}
        mode={formMode}
        itemId={formItemId}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => setSelectedItemId(id)}
      />

      <InventoryItemDrawer
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
        onRequestEdit={openEdit}
      />
    </div>
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
