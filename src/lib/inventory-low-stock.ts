import type { InventoryItem, LowStockRule } from "@/types/inventory";

export function isLowStock(item: InventoryItem): boolean {
  return item.quantityOnHand <= item.reorderThreshold;
}

export function effectiveLowStockRule(item: InventoryItem): LowStockRule {
  return {
    itemId: item.id,
    minOnHand: item.reorderThreshold,
    reorderQty: null,
  };
}

export function lowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter(isLowStock);
}
