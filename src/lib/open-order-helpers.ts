import { cloneCart, migratePosCart } from "@/lib/pos-cart";
import { totalsFromCart } from "@/lib/pos-totals";
import type { OpenOrder } from "@/types/open-order";
import type { CartItem, Station } from "@/types/pos";
import type { PaymentProcessorSnapshot } from "@/types/payment";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function firstLinkedRepairTicketIdFromCart(
  cart: CartItem[],
): string | null {
  const line = cart.find(
    (l): l is Extract<CartItem, { kind: "repair" }> => l.kind === "repair",
  );
  return line?.ticketId ?? null;
}

export function buildOpenOrder(input: {
  station: Station;
  cart: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdBy: PaymentProcessorSnapshot | null;
  note?: string | null;
  label?: string | null;
  customer?: OpenOrder["customer"];
}): OpenOrder {
  const now = new Date().toISOString();
  const cart = cloneCart(input.cart);
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    stationId: input.station.id,
    storeId: input.station.storeId,
    createdBy: input.createdBy,
    cart,
    linkedRepairTicketId: firstLinkedRepairTicketIdFromCart(cart),
    customer: input.customer ?? null,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    status: "open",
    note: input.note?.trim() ? input.note.trim() : null,
    label: input.label?.trim() ? input.label.trim() : null,
  };
}

export function touchOpenOrder(order: OpenOrder): OpenOrder {
  return { ...order, updatedAt: new Date().toISOString() };
}

/** Recompute totals from cart + tax rate (caller supplies rate). */
export function openOrderTotalsFromCart(
  cart: CartItem[],
  taxRate: number,
): { subtotal: number; tax: number; total: number } {
  return totalsFromCart(cart, taxRate);
}

export function migrateOpenOrder(raw: unknown): OpenOrder | null {
  if (!isRecord(raw)) return null;
  const o = raw;
  if (typeof o.id !== "string" || !o.id) return null;
  const cart = migratePosCart(o.cart);

  const createdAt =
    typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString();
  const updatedAt =
    typeof o.updatedAt === "string" ? o.updatedAt : createdAt;
  const stationId = String(o.stationId ?? "");
  const storeId = String(o.storeId ?? "");
  if (!stationId || !storeId) return null;

  let createdBy: PaymentProcessorSnapshot | null = null;
  const cb = o.createdBy;
  if (
    isRecord(cb) &&
    typeof cb.employeeId === "string" &&
    typeof cb.name === "string"
  ) {
    createdBy = { employeeId: cb.employeeId, name: cb.name };
  }

  const subtotal = Number(o.subtotal);
  const tax = Number(o.tax);
  const total = Number(o.total);
  if (
    !Number.isFinite(subtotal) ||
    !Number.isFinite(tax) ||
    !Number.isFinite(total)
  ) {
    return null;
  }

  const linked =
    o.linkedRepairTicketId === null || o.linkedRepairTicketId === undefined
      ? firstLinkedRepairTicketIdFromCart(cart)
      : String(o.linkedRepairTicketId);

  return {
    id: o.id,
    createdAt,
    updatedAt,
    stationId,
    storeId,
    createdBy,
    cart,
    linkedRepairTicketId: linked || null,
    customer: null,
    subtotal,
    tax,
    total,
    status: "open",
    note:
      o.note === null || o.note === undefined
        ? null
        : String(o.note).trim() || null,
    label:
      o.label === null || o.label === undefined
        ? null
        : String(o.label).trim() || null,
  };
}
