import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  seedInventoryCategories,
  seedInventoryItems,
  seedVendors,
} from "@/data/seed-inventory";
import type { InventoryItem, StockAdjustment } from "@/types/inventory";

const MAX_ADJUSTMENTS = 400;

export type InventoryEmployeeRef = {
  employeeId: string;
  name: string;
};

export type SaveInventoryItemInput = {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  vendorId: string | null;
  costPrice: number;
  salePrice: number;
  quantityOnHand: number;
  reorderThreshold: number;
  locationBin: string;
  linkedProductId: string | null;
};

export type InventoryStoreState = {
  categories: typeof seedInventoryCategories;
  vendors: typeof seedVendors;
  items: InventoryItem[];
  adjustments: StockAdjustment[];
  selectedItemId: string | null;
};

export type InventoryStoreActions = {
  setSelectedItemId: (id: string | null) => void;
  createItem: (input: SaveInventoryItemInput) => { ok: true; id: string } | { ok: false; error: string };
  updateItem: (
    itemId: string,
    input: SaveInventoryItemInput,
  ) => { ok: true } | { ok: false; error: string };
  recordStockAdd: (
    itemId: string,
    quantity: number,
    reason: string,
    note: string,
    by: InventoryEmployeeRef,
  ) => { ok: true } | { ok: false; error: string };
  recordStockRemove: (
    itemId: string,
    quantity: number,
    reason: string,
    note: string,
    by: InventoryEmployeeRef,
  ) => { ok: true } | { ok: false; error: string };
  recordStockCorrection: (
    itemId: string,
    newQuantityOnHand: number,
    reason: string,
    note: string,
    by: InventoryEmployeeRef,
  ) => { ok: true } | { ok: false; error: string };
};

export type InventoryStore = InventoryStoreState & InventoryStoreActions;

function touchItem(item: InventoryItem): InventoryItem {
  return { ...item, updatedAt: new Date().toISOString() };
}

function trimAdjustments(list: StockAdjustment[]): StockAdjustment[] {
  if (list.length <= MAX_ADJUSTMENTS) return list;
  return list
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, MAX_ADJUSTMENTS);
}

function pushAdjustment(
  adjustments: StockAdjustment[],
  adj: StockAdjustment,
): StockAdjustment[] {
  return trimAdjustments([adj, ...adjustments]);
}

function newItemId(): string {
  return `inv-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      categories: seedInventoryCategories,
      vendors: seedVendors,
      items: seedInventoryItems.map((i) => ({ ...i })),
      adjustments: [],
      selectedItemId: null,

      setSelectedItemId: (id) => set({ selectedItemId: id }),

      createItem: (input) => {
        const sku = input.sku.trim().toUpperCase();
        if (!input.name.trim()) return { ok: false, error: "Name is required." };
        if (!sku) return { ok: false, error: "SKU is required." };
        const dup = get().items.some(
          (i) => i.sku.toUpperCase() === sku,
        );
        if (dup) return { ok: false, error: "SKU already exists." };

        const iso = new Date().toISOString();
        const id = newItemId();
        const item: InventoryItem = {
          id,
          name: input.name.trim(),
          sku,
          barcode: input.barcode.trim(),
          categoryId: input.categoryId,
          vendorId: input.vendorId,
          costPrice: input.costPrice,
          salePrice: input.salePrice,
          quantityOnHand: Math.max(0, Math.floor(input.quantityOnHand)),
          reorderThreshold: Math.max(0, Math.floor(input.reorderThreshold)),
          locationBin: input.locationBin.trim(),
          linkedProductId: input.linkedProductId,
          createdAt: iso,
          updatedAt: iso,
        };

        set((s) => ({ items: [item, ...s.items] }));
        return { ok: true, id };
      },

      updateItem: (itemId, input) => {
        const sku = input.sku.trim().toUpperCase();
        if (!input.name.trim()) return { ok: false, error: "Name is required." };
        if (!sku) return { ok: false, error: "SKU is required." };
        const dup = get().items.some(
          (i) => i.id !== itemId && i.sku.toUpperCase() === sku,
        );
        if (dup) return { ok: false, error: "SKU already in use." };

        set((s) => ({
          items: s.items.map((i) =>
            i.id === itemId
              ? touchItem({
                  ...i,
                  name: input.name.trim(),
                  sku,
                  barcode: input.barcode.trim(),
                  categoryId: input.categoryId,
                  vendorId: input.vendorId,
                  costPrice: input.costPrice,
                  salePrice: input.salePrice,
                  quantityOnHand: Math.max(0, Math.floor(input.quantityOnHand)),
                  reorderThreshold: Math.max(
                    0,
                    Math.floor(input.reorderThreshold),
                  ),
                  locationBin: input.locationBin.trim(),
                  linkedProductId: input.linkedProductId,
                })
              : i,
          ),
        }));
        return { ok: true };
      },

      recordStockAdd: (itemId, quantity, reason, note, by) => {
        const q = Math.floor(quantity);
        if (q <= 0) return { ok: false, error: "Quantity must be positive." };
        const r = reason.trim();
        if (!r) return { ok: false, error: "Reason is required." };

        const adj: StockAdjustment = {
          id: crypto.randomUUID(),
          itemId,
          type: "add",
          quantityDelta: q,
          reason: r,
          note: note.trim(),
          createdAt: new Date().toISOString(),
          createdByEmployeeId: by.employeeId,
          createdByName: by.name,
        };

        set((s) => {
          const items = s.items.map((i) =>
            i.id === itemId
              ? touchItem({
                  ...i,
                  quantityOnHand: i.quantityOnHand + q,
                })
              : i,
          );
          return {
            items,
            adjustments: pushAdjustment(s.adjustments, adj),
          };
        });
        return { ok: true };
      },

      recordStockRemove: (itemId, quantity, reason, note, by) => {
        const q = Math.floor(quantity);
        if (q <= 0) return { ok: false, error: "Quantity must be positive." };
        const r = reason.trim();
        if (!r) return { ok: false, error: "Reason is required." };

        const item = get().items.find((i) => i.id === itemId);
        if (!item) return { ok: false, error: "Item not found." };
        if (q > item.quantityOnHand) {
          return { ok: false, error: "Not enough on hand for this removal." };
        }

        const adj: StockAdjustment = {
          id: crypto.randomUUID(),
          itemId,
          type: "remove",
          quantityDelta: -q,
          reason: r,
          note: note.trim(),
          createdAt: new Date().toISOString(),
          createdByEmployeeId: by.employeeId,
          createdByName: by.name,
        };

        set((s) => ({
          items: s.items.map((i) =>
            i.id === itemId
              ? touchItem({
                  ...i,
                  quantityOnHand: i.quantityOnHand - q,
                })
              : i,
          ),
          adjustments: pushAdjustment(s.adjustments, adj),
        }));
        return { ok: true };
      },

      recordStockCorrection: (itemId, newQuantityOnHand, reason, note, by) => {
        const next = Math.max(0, Math.floor(newQuantityOnHand));
        const r = reason.trim();
        if (!r) return { ok: false, error: "Reason is required." };

        const item = get().items.find((i) => i.id === itemId);
        if (!item) return { ok: false, error: "Item not found." };
        const delta = next - item.quantityOnHand;
        if (delta === 0) return { ok: false, error: "No change in quantity." };

        const adj: StockAdjustment = {
          id: crypto.randomUUID(),
          itemId,
          type: "correction",
          quantityDelta: delta,
          reason: r,
          note: note.trim(),
          createdAt: new Date().toISOString(),
          createdByEmployeeId: by.employeeId,
          createdByName: by.name,
        };

        set((s) => ({
          items: s.items.map((i) =>
            i.id === itemId
              ? touchItem({
                  ...i,
                  quantityOnHand: next,
                })
              : i,
          ),
          adjustments: pushAdjustment(s.adjustments, adj),
        }));
        return { ok: true };
      },
    }),
    {
      name: "fixlytiq-inventory",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        adjustments: state.adjustments,
      }),
      skipHydration: true,
    },
  ),
);

export function adjustmentTypeLabel(
  t: StockAdjustment["type"],
): string {
  switch (t) {
    case "add":
      return "Add";
    case "remove":
      return "Remove";
    case "correction":
      return "Correction";
  }
}
