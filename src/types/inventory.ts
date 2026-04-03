/** Inventory domain — local-first; backend will align later */

export type InventoryCategory = {
  id: string;
  name: string;
  description?: string;
};

export type Vendor = {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
};

export type StockAdjustmentType = "add" | "remove" | "correction";

/**
 * Audit log for quantity changes. quantityDelta is signed: positive adds,
 * negative removes; correction stores the delta from prior on-hand to new count.
 */
export type StockAdjustment = {
  id: string;
  itemId: string;
  type: StockAdjustmentType;
  quantityDelta: number;
  /** Short reason code / label (required) */
  reason: string;
  /** Free-form detail */
  note: string;
  createdAt: string;
  createdByEmployeeId: string;
  createdByName: string;
};

/**
 * Effective reorder / alert band for an SKU. Today derived from
 * `InventoryItem.reorderThreshold` (and optional reorderQty on item); kept as a
 * named type for future per-location rules and API contracts.
 */
export type LowStockRule = {
  itemId: string;
  minOnHand: number;
  reorderQty?: number | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  vendorId: string | null;
  /** Unit cost (USD) */
  costPrice: number;
  /** Default retail / list (USD) */
  salePrice: number;
  quantityOnHand: number;
  reorderThreshold: number;
  /** Bin / shelf location */
  locationBin: string;
  /**
   * When set, POS `Product.id` this row fulfills for future catalog sync.
   * See `Product.inventoryItemId` for the reverse link.
   */
  linkedProductId: string | null;
  createdAt: string;
  updatedAt: string;
};
