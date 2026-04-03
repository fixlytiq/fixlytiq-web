import type { InventoryItem } from "@/types/inventory";
import type { Product } from "@/types/pos";

/**
 * Products that can be linked to an inventory row (no other item already claims
 * `linkedProductId`, unless we are editing that same item).
 */
export function linkableCatalogProducts(
  products: Product[],
  items: InventoryItem[],
  editingItemId: string | null,
): Product[] {
  return products.filter((p) => {
    const holder = items.find((i) => i.linkedProductId === p.id);
    if (!holder) return true;
    if (editingItemId && holder.id === editingItemId) return true;
    return false;
  });
}

/** Resolve catalog product for a stock row (when linked). */
export function productForInventoryItem(
  products: Product[],
  item: InventoryItem,
): Product | undefined {
  if (!item.linkedProductId) return undefined;
  return products.find((p) => p.id === item.linkedProductId);
}

/** Resolve stock row for a POS product (when linked). */
export function inventoryItemForProduct(
  items: InventoryItem[],
  product: Product,
): InventoryItem | undefined {
  if (!product.inventoryItemId) return undefined;
  return items.find((i) => i.id === product.inventoryItemId);
}
