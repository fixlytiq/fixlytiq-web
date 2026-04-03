import type { CartItem, Product } from "@/types/pos";

/** Stable cart row id for increment/remove (product id, repair key, or custom key). */
export function posCartLineId(line: CartItem): string {
  if (line.kind === "product") return line.product.id;
  if (line.kind === "repair") return repairPosLineKey(line.ticketId);
  return customPosLineKey(line.customItemId);
}

export function customPosLineKey(customItemId: string): string {
  return `custom:${customItemId}`;
}

export function repairPosLineKey(ticketId: string): string {
  return `repair:${ticketId}`;
}

export function cartIncludesRepairTicket(
  cart: CartItem[],
  ticketId: string,
): boolean {
  return cart.some((l) => l.kind === "repair" && l.ticketId === ticketId);
}

export const REPAIR_SALE_SKU = "REPAIR-CHECKOUT";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseProduct(raw: unknown): Product | null {
  if (!isRecord(raw)) return null;
  const p = raw;
  if (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.sku === "string" &&
    typeof p.price === "number" &&
    typeof p.categoryId === "string"
  ) {
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      categoryId: p.categoryId,
      inventoryItemId:
        p.inventoryItemId === null || p.inventoryItemId === undefined
          ? null
          : String(p.inventoryItemId),
    };
  }
  return null;
}

/** Normalize one cart row from persisted JSON (handles pre-union legacy carts). */
export function migratePosCartItem(raw: unknown): CartItem | null {
  if (!isRecord(raw)) return null;

  if (raw.kind === "repair") {
    const ticketId = typeof raw.ticketId === "string" ? raw.ticketId : "";
    const description =
      typeof raw.description === "string" ? raw.description : "Repair";
    const unitPrice =
      typeof raw.unitPrice === "number" && Number.isFinite(raw.unitPrice)
        ? raw.unitPrice
        : 0;
    const quantity =
      typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
        ? Math.max(1, Math.floor(raw.quantity))
        : 1;
    if (!ticketId) return null;
    return {
      kind: "repair",
      origin: "repair_ticket",
      ticketId,
      description,
      unitPrice,
      quantity,
    };
  }

  if (raw.kind === "custom") {
    const customItemId =
      typeof raw.customItemId === "string" ? raw.customItemId : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const unitPrice = Number(raw.unitPrice);
    const quantity =
      typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
        ? Math.max(1, Math.floor(raw.quantity))
        : 1;
    const sku =
      typeof raw.sku === "string" && raw.sku.trim() ? raw.sku.trim() : "CUSTOM";
    const note =
      raw.note === null || raw.note === undefined
        ? null
        : String(raw.note).trim() || null;
    const taxable =
      raw.taxable === false || raw.taxable === true ? raw.taxable : true;
    const categoryLabel =
      raw.categoryLabel === null || raw.categoryLabel === undefined
        ? null
        : String(raw.categoryLabel).trim() || null;
    const createdAt =
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString();
    if (!customItemId || !name || !Number.isFinite(unitPrice)) return null;
    return {
      kind: "custom",
      customItemId,
      name,
      note,
      sku,
      unitPrice,
      quantity,
      taxable,
      categoryLabel,
      createdAt,
    };
  }

  if (raw.kind === "product") {
    const product = parseProduct(raw.product);
    const quantity =
      typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
        ? Math.max(1, Math.floor(raw.quantity))
        : 1;
    if (!product) return null;
    return { kind: "product", product, quantity };
  }

  // Legacy: { product, quantity } without `kind`
  const product = parseProduct(raw.product);
  const quantity =
    typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
      ? Math.max(1, Math.floor(raw.quantity))
      : 1;
  if (!product) return null;
  return { kind: "product", product, quantity };
}

/** Deep clone for checkout / payment session snapshots. */
export function cloneCartItem(line: CartItem): CartItem {
  if (line.kind === "product") {
    return {
      kind: "product",
      product: { ...line.product },
      quantity: line.quantity,
    };
  }
  if (line.kind === "custom") {
    return { ...line };
  }
  return { ...line };
}

export function cloneCart(cart: CartItem[]): CartItem[] {
  return cart.map(cloneCartItem);
}

export function migratePosCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CartItem[] = [];
  for (const row of raw) {
    const line = migratePosCartItem(row);
    if (line) out.push(line);
  }
  return out;
}
