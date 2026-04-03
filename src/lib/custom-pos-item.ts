import type { CartItem } from "@/types/pos";

export const CUSTOM_SALE_LINE_PREFIX = "custom-sale:" as const;
export const DEFAULT_CUSTOM_SKU = "CUSTOM" as const;

export function newCustomItemId(): string {
  return crypto.randomUUID();
}

export function customSaleProductId(customItemId: string): string {
  return `${CUSTOM_SALE_LINE_PREFIX}${customItemId}`;
}

/** Parse custom item id from persisted sale line `productId`. */
export function customItemIdFromSaleProductId(productId: string): string | null {
  if (!productId.startsWith(CUSTOM_SALE_LINE_PREFIX)) return null;
  const id = productId.slice(CUSTOM_SALE_LINE_PREFIX.length);
  return id.trim() ? id : null;
}

/** Register modal typically sends name, price, qty, note; other fields default. */
export type CustomItemFormValues = {
  name: string;
  unitPrice: number;
  quantity: number;
  note?: string | null;
  /** Defaults to `DEFAULT_CUSTOM_SKU`. */
  sku?: string;
  /** Defaults to true (same as catalog/repair lines). */
  taxable?: boolean;
  categoryLabel?: string | null;
};

export function buildCustomCartItem(values: CustomItemFormValues): Extract<
  CartItem,
  { kind: "custom" }
> {
  const customItemId = newCustomItemId();
  const rawSku = values.sku?.trim() ?? "";
  const sku =
    rawSku === ""
      ? DEFAULT_CUSTOM_SKU
      : rawSku.toUpperCase().slice(0, 32);
  const taxable = values.taxable !== false;
  const categoryLabel =
    values.categoryLabel?.trim() ? values.categoryLabel.trim() : null;
  return {
    kind: "custom",
    customItemId,
    name: values.name.trim(),
    note: values.note?.trim() ? values.note.trim() : null,
    sku,
    unitPrice: Math.round(values.unitPrice * 100) / 100,
    quantity: Math.max(1, Math.floor(values.quantity)),
    taxable,
    categoryLabel,
    createdAt: new Date().toISOString(),
  };
}
