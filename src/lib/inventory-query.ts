import type { InventoryItem } from "@/types/inventory";
import { isLowStock } from "@/lib/inventory-low-stock";

export type InventorySortKey =
  | "name_asc"
  | "sku_asc"
  | "qty_desc"
  | "qty_asc"
  | "sale_desc"
  | "updated_desc";

export type InventoryListQuery = {
  search: string;
  categoryId: string | "all";
  lowStockOnly: boolean;
};

function matchesSearch(item: InventoryItem, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const hay = [
    item.sku,
    item.name,
    item.barcode,
    item.locationBin,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

export function filterInventoryItems(
  items: InventoryItem[],
  query: InventoryListQuery,
): InventoryItem[] {
  return items.filter((item) => {
    if (!matchesSearch(item, query.search)) return false;
    if (query.categoryId !== "all" && item.categoryId !== query.categoryId) {
      return false;
    }
    if (query.lowStockOnly && !isLowStock(item)) return false;
    return true;
  });
}

export function sortInventoryItems(
  items: InventoryItem[],
  key: InventorySortKey,
): InventoryItem[] {
  const copy = [...items];
  switch (key) {
    case "name_asc":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    case "sku_asc":
      return copy.sort((a, b) =>
        a.sku.localeCompare(b.sku, undefined, { sensitivity: "base" }),
      );
    case "qty_desc":
      return copy.sort((a, b) => b.quantityOnHand - a.quantityOnHand);
    case "qty_asc":
      return copy.sort((a, b) => a.quantityOnHand - b.quantityOnHand);
    case "sale_desc":
      return copy.sort((a, b) => b.salePrice - a.salePrice);
    case "updated_desc":
      return copy.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    default:
      return copy;
  }
}
