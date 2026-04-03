"use client";

import { useCallback, useEffect, useState } from "react";
import { buildCustomCartItem } from "@/lib/custom-pos-item";
import { usePosStore } from "@/stores/pos-store";

type CustomItemModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CustomItemModal({ open, onClose }: CustomItemModalProps) {
  const addCustomCartItem = usePosStore((s) => s.addCustomCartItem);

  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [qtyStr, setQtyStr] = useState("1");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
  }, [open]);

  const reset = useCallback(() => {
    setName("");
    setPriceStr("");
    setQtyStr("1");
    setNote("");
    setErr(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const submit = () => {
    setErr(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErr("Item name is required.");
      return;
    }
    const price = Number.parseFloat(priceStr);
    if (!Number.isFinite(price) || price <= 0) {
      setErr("Enter a valid price greater than zero.");
      return;
    }
    const qty = Number.parseInt(qtyStr, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setErr("Quantity must be a whole number of at least 1.");
      return;
    }

    const line = buildCustomCartItem({
      name: trimmedName,
      unitPrice: price,
      quantity: qty,
      note: note.trim() ? note.trim() : null,
    });
    addCustomCartItem(line);
    handleClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const field =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-700 bg-zinc-950/90 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/15";

  return (
    <div
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/75 p-3 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-item-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-600 bg-zinc-950 shadow-2xl">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2
            id="custom-item-title"
            className="text-lg font-bold text-zinc-50"
          >
            Custom item
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Not saved to catalog · no inventory change
          </p>
        </div>

        <div className="max-h-[min(70dvh,24rem)] space-y-3 overflow-y-auto p-4">
          <label className="block text-sm">
            <span className="text-zinc-400">Name *</span>
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Labor — screen install"
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-zinc-400">Price *</span>
              <input
                className={`${field} font-mono`}
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">Qty *</span>
              <input
                className={`${field} font-mono`}
                inputMode="numeric"
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
                placeholder="1"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-zinc-400">Note (optional)</span>
            <input
              className={field}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Receipt / internal note"
            />
          </label>
          {err ? (
            <p className="text-sm text-rose-400" role="alert">
              {err}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={handleClose}
            className="touch-pad min-h-11 rounded-xl border border-zinc-600 bg-zinc-900 py-2.5 text-sm font-semibold text-zinc-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="touch-pad min-h-11 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
