import type { CartItem } from "@/types/pos";
import type { OrderLine } from "@/types/orders";
import { REPAIR_SALE_SKU } from "@/lib/pos-cart";

function orderLineIdFromCart(line: CartItem): string {
  if (line.kind === "product") return `product:${line.product.id}`;
  if (line.kind === "repair") return `repair:${line.ticketId}`;
  return `custom:${line.customItemId}`;
}

/** Convert a POS cart snapshot into persisted order lines. */
export function orderLinesFromCart(cart: CartItem[]): OrderLine[] {
  return cart.map((line) => {
    if (line.kind === "product") {
      return {
        id: orderLineIdFromCart(line),
        lineKind: "product",
        productId: line.product.id,
        name: line.product.name,
        sku: line.product.sku,
        unitPrice: line.product.price,
        quantity: line.quantity,
        categoryId: line.product.categoryId,
        inventoryItemId: line.product.inventoryItemId ?? null,
      };
    }

    if (line.kind === "repair") {
      return {
        id: orderLineIdFromCart(line),
        lineKind: "repair",
        productId: `repair:${line.ticketId}`,
        name: line.description,
        sku: REPAIR_SALE_SKU,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        repairTicketId: line.ticketId,
      };
    }

    // custom
    return {
      id: orderLineIdFromCart(line),
      lineKind: "custom",
      productId: `custom:${line.customItemId}`,
      name: line.name,
      sku: line.sku,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      customItemId: line.customItemId,
      note: line.note,
      taxable: line.taxable,
      categoryLabel: line.categoryLabel,
    };
  });
}

/** Convert stored order lines back into a POS cart snapshot. */
export function posCartItemsFromOrderLines(lines: OrderLine[]): CartItem[] {
  return lines.map((l) => {
    if (l.lineKind === "product") {
      return {
        kind: "product",
        product: {
          id: l.productId,
          name: l.name,
          sku: l.sku,
          price: l.unitPrice,
          categoryId: l.categoryId ?? "unknown",
          inventoryItemId: l.inventoryItemId ?? null,
        },
        quantity: l.quantity,
      };
    }

    if (l.lineKind === "repair") {
      return {
        kind: "repair",
        origin: "repair_ticket",
        ticketId: l.repairTicketId ?? "",
        description: l.name,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
      };
    }

    return {
      kind: "custom",
      customItemId: l.customItemId ?? "",
      name: l.name,
      note: l.note ?? null,
      sku: l.sku,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      taxable: l.taxable !== false,
      categoryLabel: l.categoryLabel ?? null,
      createdAt: new Date().toISOString(),
    };
  });
}

