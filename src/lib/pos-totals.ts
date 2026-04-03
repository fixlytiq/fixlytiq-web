import { customSaleProductId } from "@/lib/custom-pos-item";
import { REPAIR_SALE_SKU } from "@/lib/pos-cart";
import type { CartItem, SaleLine } from "@/types/pos";

/** Default sales tax rate for mock POS (e.g. 8.25%) */
export const DEFAULT_TAX_RATE = 0.0825;

export function cartLineSubtotal(line: CartItem): number {
  if (line.kind === "product") {
    return line.product.price * line.quantity;
  }
  if (line.kind === "custom") {
    return line.unitPrice * line.quantity;
  }
  return line.unitPrice * line.quantity;
}

/** Product and repair lines are taxable; custom lines follow `taxable` flag. */
export function lineIsTaxable(line: CartItem): boolean {
  if (line.kind === "custom") return line.taxable;
  return true;
}

/** Subtotal of lines that contribute to sales tax. */
export function taxableSubtotalForCart(items: CartItem[]): number {
  return items.reduce(
    (s, line) => s + (lineIsTaxable(line) ? cartLineSubtotal(line) : 0),
    0,
  );
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, line) => s + cartLineSubtotal(line), 0);
}

export function taxFromSubtotal(subtotal: number, rate: number = DEFAULT_TAX_RATE): number {
  return Math.round(subtotal * rate * 100) / 100;
}

export function totalFromSubtotal(subtotal: number, rate: number = DEFAULT_TAX_RATE): number {
  return Math.round((subtotal + taxFromSubtotal(subtotal, rate)) * 100) / 100;
}

export function totalsFromCart(items: CartItem[], rate: number = DEFAULT_TAX_RATE) {
  const subtotal = cartSubtotal(items);
  const taxableBase = taxableSubtotalForCart(items);
  const tax = taxFromSubtotal(taxableBase, rate);
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

export function saleLinesFromCart(items: CartItem[]): SaleLine[] {
  return items.map((line) => {
    if (line.kind === "product") {
      return {
        productId: line.product.id,
        name: line.product.name,
        sku: line.product.sku,
        unitPrice: line.product.price,
        quantity: line.quantity,
        lineKind: "product",
        repairTicketId: null,
        taxable: true,
      };
    }
    if (line.kind === "custom") {
      return {
        productId: customSaleProductId(line.customItemId),
        name: line.name,
        sku: line.sku,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineKind: "custom",
        repairTicketId: null,
        customItemId: line.customItemId,
        note: line.note,
        taxable: line.taxable,
        categoryLabel: line.categoryLabel,
      };
    }
    return {
      productId: repairPosLineProductId(line.ticketId),
      name: line.description,
      sku: REPAIR_SALE_SKU,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineKind: "repair",
      repairTicketId: line.ticketId,
      taxable: true,
    };
  });
}

function repairPosLineProductId(ticketId: string): string {
  return `repair-sale:${ticketId}`;
}
