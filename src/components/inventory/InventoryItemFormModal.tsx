"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mockProducts } from "@/data/mock-pos";
import { linkableCatalogProducts } from "@/lib/pos-inventory-bridge";
import {
  useInventoryStore,
  type SaveInventoryItemInput,
} from "@/stores/inventory-store";

type Mode = "create" | "edit";

export type InventoryItemFormModalProps = {
  open: boolean;
  mode: Mode;
  /** Required when mode === "edit" */
  itemId: string | null;
  onClose: () => void;
  onSaved?: (itemId: string) => void;
};

function emptyInput(): SaveInventoryItemInput {
  return {
    name: "",
    sku: "",
    barcode: "",
    categoryId: "parts",
    vendorId: null,
    costPrice: 0,
    salePrice: 0,
    quantityOnHand: 0,
    reorderThreshold: 0,
    locationBin: "",
    linkedProductId: null,
  };
}

export function InventoryItemFormModal({
  open,
  mode,
  itemId,
  onClose,
  onSaved,
}: InventoryItemFormModalProps) {
  const categories = useInventoryStore((s) => s.categories);
  const vendors = useInventoryStore((s) => s.vendors);
  const items = useInventoryStore((s) => s.items);
  const createItem = useInventoryStore((s) => s.createItem);
  const updateItem = useInventoryStore((s) => s.updateItem);

  const [form, setForm] = useState<SaveInventoryItemInput>(emptyInput);
  const [error, setError] = useState<string | null>(null);

  const editingItem = useMemo(
    () => (itemId ? items.find((i) => i.id === itemId) ?? null : null),
    [items, itemId],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && editingItem) {
      setForm({
        name: editingItem.name,
        sku: editingItem.sku,
        barcode: editingItem.barcode,
        categoryId: editingItem.categoryId,
        vendorId: editingItem.vendorId,
        costPrice: editingItem.costPrice,
        salePrice: editingItem.salePrice,
        quantityOnHand: editingItem.quantityOnHand,
        reorderThreshold: editingItem.reorderThreshold,
        locationBin: editingItem.locationBin,
        linkedProductId: editingItem.linkedProductId,
      });
    } else if (mode === "create") {
      setForm(emptyInput());
    }
  }, [open, mode, editingItem]);

  const linkOptions = useMemo(
    () =>
      linkableCatalogProducts(
        mockProducts,
        items,
        mode === "edit" && itemId ? itemId : null,
      ),
    [items, mode, itemId],
  );

  const submit = useCallback(() => {
    if (mode === "edit") {
      if (!itemId || !editingItem) {
        setError("Missing item.");
        return;
      }
      const r = updateItem(itemId, form);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSaved?.(itemId);
      onClose();
      return;
    }
    const r = createItem(form);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onSaved?.(r.id);
    onClose();
  }, [createItem, editingItem, form, itemId, mode, onClose, onSaved, updateItem]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  if (mode === "edit" && (!itemId || !editingItem)) {
    return null;
  }

  const fieldClass =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  const title =
    mode === "create" ? "New SKU" : `Edit · ${editingItem?.sku ?? ""}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-form-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(100dvh,920px)] w-full max-w-2xl flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-zinc-800 px-5 py-4">
          <h2
            id="inv-form-title"
            className="text-lg font-semibold text-zinc-50"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Stored locally on this station. POS link is optional.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-3 text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Item name *
              </span>
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                SKU *
              </span>
              <input
                className={`${fieldClass} font-mono`}
                value={form.sku}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sku: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Barcode
              </span>
              <input
                className={`${fieldClass} font-mono`}
                value={form.barcode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, barcode: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Category
              </span>
              <select
                className={fieldClass}
                value={form.categoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryId: e.target.value }))
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Vendor
              </span>
              <select
                className={fieldClass}
                value={form.vendorId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    vendorId: e.target.value === "" ? null : e.target.value,
                  }))
                }
              >
                <option value="">None</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Cost (USD)
              </span>
              <input
                className={`${fieldClass} font-mono`}
                type="number"
                min={0}
                step="0.01"
                value={form.costPrice}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    costPrice: Number.parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Sale price (USD)
              </span>
              <input
                className={`${fieldClass} font-mono`}
                type="number"
                min={0}
                step="0.01"
                value={form.salePrice}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    salePrice: Number.parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Qty on hand
              </span>
              <input
                className={`${fieldClass} font-mono`}
                type="number"
                min={0}
                step={1}
                value={form.quantityOnHand}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    quantityOnHand: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Reorder threshold
              </span>
              <input
                className={`${fieldClass} font-mono`}
                type="number"
                min={0}
                step={1}
                value={form.reorderThreshold}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    reorderThreshold: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Location / bin
              </span>
              <input
                className={`${fieldClass} font-mono`}
                value={form.locationBin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, locationBin: e.target.value }))
                }
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Link to POS product (optional)
              </span>
              <select
                className={fieldClass}
                value={form.linkedProductId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    linkedProductId:
                      e.target.value === "" ? null : e.target.value,
                  }))
                }
              >
                <option value="">Not linked</option>
                {linkOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.sku}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="touch-pad min-h-12 flex-1 rounded-xl border border-zinc-700 bg-zinc-950/80 text-base font-semibold text-zinc-300 active:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="touch-pad min-h-12 flex-1 rounded-xl bg-emerald-600 text-base font-semibold text-white active:bg-emerald-500"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
