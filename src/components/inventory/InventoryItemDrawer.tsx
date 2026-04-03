"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mockProducts } from "@/data/mock-pos";
import {
  adjustmentTypeLabel,
  useInventoryStore,
} from "@/stores/inventory-store";
import { useSessionStore } from "@/stores/session-store";
import { productForInventoryItem } from "@/lib/pos-inventory-bridge";
import { effectiveLowStockRule } from "@/lib/inventory-low-stock";

export type InventoryItemDrawerProps = {
  itemId: string | null;
  onClose: () => void;
  onRequestEdit: (itemId: string) => void;
};

export function InventoryItemDrawer({
  itemId,
  onClose,
  onRequestEdit,
}: InventoryItemDrawerProps) {
  const items = useInventoryStore((s) => s.items);
  const categories = useInventoryStore((s) => s.categories);
  const vendors = useInventoryStore((s) => s.vendors);
  const adjustments = useInventoryStore((s) => s.adjustments);
  const recordStockAdd = useInventoryStore((s) => s.recordStockAdd);
  const recordStockRemove = useInventoryStore((s) => s.recordStockRemove);
  const recordStockCorrection = useInventoryStore(
    (s) => s.recordStockCorrection,
  );
  const employee = useSessionStore((s) => s.employee);

  const item = useMemo(
    () => items.find((i) => i.id === itemId) ?? null,
    [items, itemId],
  );

  const categoryName = useMemo(() => {
    if (!item) return "";
    return categories.find((c) => c.id === item.categoryId)?.name ?? item.categoryId;
  }, [categories, item]);

  const vendorName = useMemo(() => {
    if (!item?.vendorId) return "—";
    return vendors.find((v) => v.id === item.vendorId)?.name ?? item.vendorId;
  }, [item, vendors]);

  const linkedProduct = useMemo(
    () => (item ? productForInventoryItem(mockProducts, item) : undefined),
    [item],
  );

  const itemAdjustments = useMemo(() => {
    if (!itemId) return [];
    return adjustments
      .filter((a) => a.itemId === itemId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [adjustments, itemId]);

  const [addQty, setAddQty] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);

  const [remQty, setRemQty] = useState("");
  const [remReason, setRemReason] = useState("");
  const [remNote, setRemNote] = useState("");
  const [remErr, setRemErr] = useState<string | null>(null);

  const [corrQty, setCorrQty] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [corrNote, setCorrNote] = useState("");
  const [corrErr, setCorrErr] = useState<string | null>(null);

  useEffect(() => {
    setAddQty("");
    setAddReason("");
    setAddNote("");
    setAddErr(null);
    setRemQty("");
    setRemReason("");
    setRemNote("");
    setRemErr(null);
    setCorrReason("");
    setCorrNote("");
    setCorrErr(null);
    const inv = useInventoryStore
      .getState()
      .items.find((i) => i.id === itemId);
    setCorrQty(inv ? String(inv.quantityOnHand) : "");
  }, [itemId]);

  useEffect(() => {
    if (item) setCorrQty(String(item.quantityOnHand));
  }, [item?.quantityOnHand, item?.id]);

  useEffect(() => {
    if (!itemId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [itemId, onClose]);

  const submitAdd = useCallback(() => {
    if (!item || !employee) return;
    setAddErr(null);
    const q = Number.parseInt(addQty, 10);
    const r = recordStockAdd(item.id, q, addReason, addNote, {
      employeeId: employee.id,
      name: employee.name,
    });
    if (!r.ok) {
      setAddErr(r.error);
      return;
    }
    setAddQty("");
    setAddReason("");
    setAddNote("");
  }, [
    addNote,
    addQty,
    addReason,
    employee,
    item,
    recordStockAdd,
  ]);

  const submitRem = useCallback(() => {
    if (!item || !employee) return;
    setRemErr(null);
    const q = Number.parseInt(remQty, 10);
    const r = recordStockRemove(item.id, q, remReason, remNote, {
      employeeId: employee.id,
      name: employee.name,
    });
    if (!r.ok) {
      setRemErr(r.error);
      return;
    }
    setRemQty("");
    setRemReason("");
    setRemNote("");
  }, [
    employee,
    item,
    recordStockRemove,
    remNote,
    remQty,
    remReason,
  ]);

  const submitCorr = useCallback(() => {
    if (!item || !employee) return;
    setCorrErr(null);
    const q = Number.parseInt(corrQty, 10);
    const r = recordStockCorrection(item.id, q, corrReason, corrNote, {
      employeeId: employee.id,
      name: employee.name,
    });
    if (!r.ok) {
      setCorrErr(r.error);
      return;
    }
    setCorrReason("");
    setCorrNote("");
    setCorrQty(String(q));
  }, [
    corrNote,
    corrQty,
    corrReason,
    employee,
    item,
    recordStockCorrection,
  ]);

  if (!itemId || !item) return null;

  const rule = effectiveLowStockRule(item);
  const low = item.quantityOnHand <= item.reorderThreshold;

  const fieldClass =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-drawer-sku"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <p
              id="inv-drawer-sku"
              className="font-mono text-sm font-semibold text-emerald-400/90"
            >
              {item.sku}
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">
              {item.name}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              On hand{" "}
              <span className="font-mono text-zinc-200">
                {item.quantityOnHand}
              </span>
              {low ? (
                <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30">
                  Low
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25">
                  OK
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => onRequestEdit(item.id)}
              className="touch-pad rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 active:bg-zinc-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="touch-pad rounded-xl border border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-400 active:bg-zinc-900"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section className="space-y-2 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Details
            </h3>
            <dl className="grid gap-2">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Category</dt>
                <dd className="text-right text-zinc-200">{categoryName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Vendor</dt>
                <dd className="text-right text-zinc-200">{vendorName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Bin</dt>
                <dd className="font-mono text-right text-zinc-200">
                  {item.locationBin || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Barcode</dt>
                <dd className="font-mono text-right text-zinc-400">
                  {item.barcode || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Cost</dt>
                <dd className="font-mono text-right text-emerald-400/90">
                  ${item.costPrice.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Sale</dt>
                <dd className="font-mono text-right text-emerald-400/90">
                  ${item.salePrice.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Reorder at</dt>
                <dd className="font-mono text-right text-zinc-200">
                  ≤ {rule.minOnHand}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">POS link</dt>
                <dd className="text-right text-zinc-300">
                  {linkedProduct
                    ? `${linkedProduct.name} (${linkedProduct.id})`
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          {!employee ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              Sign in to record stock adjustments with audit trail.
            </p>
          ) : (
            <>
              <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Add stock
                </h3>
                {addErr ? (
                  <p className="text-sm text-rose-400">{addErr}</p>
                ) : null}
                <label className="block text-sm">
                  <span className="text-zinc-500">Quantity</span>
                  <input
                    className={fieldClass}
                    type="number"
                    min={1}
                    step={1}
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">Reason *</span>
                  <input
                    className={fieldClass}
                    placeholder="e.g. Receiving, PO #1042"
                    value={addReason}
                    onChange={(e) => setAddReason(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">Note</span>
                  <textarea
                    className={`${fieldClass} min-h-[3.5rem] resize-y py-2`}
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    rows={2}
                  />
                </label>
                <button
                  type="button"
                  onClick={submitAdd}
                  className="touch-pad w-full min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-500"
                >
                  Apply add
                </button>
              </section>

              <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Remove stock
                </h3>
                {remErr ? (
                  <p className="text-sm text-rose-400">{remErr}</p>
                ) : null}
                <label className="block text-sm">
                  <span className="text-zinc-500">Quantity</span>
                  <input
                    className={fieldClass}
                    type="number"
                    min={1}
                    step={1}
                    value={remQty}
                    onChange={(e) => setRemQty(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">Reason *</span>
                  <input
                    className={fieldClass}
                    placeholder="e.g. Store use, damage"
                    value={remReason}
                    onChange={(e) => setRemReason(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">Note</span>
                  <textarea
                    className={`${fieldClass} min-h-[3.5rem] resize-y py-2`}
                    value={remNote}
                    onChange={(e) => setRemNote(e.target.value)}
                    rows={2}
                  />
                </label>
                <button
                  type="button"
                  onClick={submitRem}
                  className="touch-pad w-full min-h-11 rounded-xl border border-rose-500/40 bg-rose-950/40 text-sm font-semibold text-rose-100 active:bg-rose-950/60"
                >
                  Apply removal
                </button>
              </section>

              <section className="mt-4 space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Correction (set count)
                </h3>
                {corrErr ? (
                  <p className="text-sm text-rose-400">{corrErr}</p>
                ) : null}
                <label className="block text-sm">
                  <span className="text-zinc-500">New on-hand total</span>
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    step={1}
                    value={corrQty}
                    onChange={(e) => setCorrQty(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">Reason *</span>
                  <input
                    className={fieldClass}
                    placeholder="e.g. Cycle count"
                    value={corrReason}
                    onChange={(e) => setCorrReason(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">Note</span>
                  <textarea
                    className={`${fieldClass} min-h-[3.5rem] resize-y py-2`}
                    value={corrNote}
                    onChange={(e) => setCorrNote(e.target.value)}
                    rows={2}
                  />
                </label>
                <button
                  type="button"
                  onClick={submitCorr}
                  className="touch-pad w-full min-h-11 rounded-xl border border-sky-500/40 bg-sky-950/30 text-sm font-semibold text-sky-100 active:bg-sky-950/50"
                >
                  Apply correction
                </button>
              </section>
            </>
          )}

          <section className="mt-4 space-y-2 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Adjustment history
            </h3>
            <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
              {itemAdjustments.length === 0 ? (
                <li className="text-zinc-500">No adjustments yet.</li>
              ) : (
                itemAdjustments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase text-zinc-500">
                        {adjustmentTypeLabel(a.type)}
                      </span>
                      <span
                        className={`font-mono text-sm font-semibold ${
                          a.quantityDelta > 0
                            ? "text-emerald-400"
                            : a.quantityDelta < 0
                              ? "text-rose-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {a.quantityDelta > 0 ? "+" : ""}
                        {a.quantityDelta}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-200">{a.reason}</p>
                    {a.note ? (
                      <p className="mt-1 text-xs text-zinc-500">{a.note}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-500">
                      {a.createdByName} ·{" "}
                      {new Date(a.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
