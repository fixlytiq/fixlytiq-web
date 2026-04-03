import { isLowStock } from "@/lib/inventory-low-stock";
import type { InventoryItem } from "@/types/inventory";
import type { CartItem, Product } from "@/types/pos";

/**
 * POS sellable row for an inventory SKU that is not linked to a static catalog product.
 * Uses the inventory row id as `Product.id` so cart and sales stay stable.
 */
export function inventoryItemToPosProduct(item: InventoryItem): Product {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    price: item.salePrice,
    categoryId: item.categoryId,
    inventoryItemId: item.id,
  };
}

/** Total units in cart per inventory row (linked POS products only). */
export function cartDemandByInventoryId(cart: CartItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of cart) {
    if (line.kind !== "product") continue;
    const id = line.product.inventoryItemId;
    if (id == null || id === "") continue;
    m.set(id, (m.get(id) ?? 0) + line.quantity);
  }
  return m;
}

export function cartQtyForInventoryId(
  cart: CartItem[],
  inventoryItemId: string,
): number {
  let n = 0;
  for (const line of cart) {
    if (line.kind !== "product") continue;
    if (line.product.inventoryItemId === inventoryItemId) {
      n += line.quantity;
    }
  }
  return n;
}

/** `null` = not stock-tracked; otherwise current on-hand for linked row. */
export function quantityAvailableForLinkedProduct(
  product: Product,
  items: InventoryItem[],
): number | null {
  const id = product.inventoryItemId;
  if (id == null || id === "") return null;
  const inv = items.find((i) => i.id === id);
  return inv ? inv.quantityOnHand : 0;
}

export function inventoryItemForProduct(
  product: Product,
  items: InventoryItem[],
): InventoryItem | null {
  const id = product.inventoryItemId;
  if (id == null || id === "") return null;
  return items.find((i) => i.id === id) ?? null;
}

export function productIsLowStock(
  product: Product,
  items: InventoryItem[],
): boolean {
  const inv = inventoryItemForProduct(product, items);
  return inv ? isLowStock(inv) : false;
}

export function validatePosCheckoutStock(
  cart: CartItem[],
  items: InventoryItem[],
): { ok: true } | { ok: false; error: string } {
  const demand = cartDemandByInventoryId(cart);
  const byId = new Map(items.map((i) => [i.id, i] as const));
  for (const [invId, need] of demand) {
    const inv = byId.get(invId);
    if (!inv) {
      return {
        ok: false,
        error:
          "A cart item is linked to inventory that no longer exists. Remove the line or fix the catalog.",
      };
    }
    if (need > inv.quantityOnHand) {
      return {
        ok: false,
        error: `Not enough stock for ${inv.sku} (${inv.name}). In cart: ${need}, on hand: ${inv.quantityOnHand}.`,
      };
    }
  }
  return { ok: true };
}
