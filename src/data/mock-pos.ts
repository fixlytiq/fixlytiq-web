import { migrateSale } from "@/lib/sale-migrate";
import { saleLinesFromCart, totalsFromCart } from "@/lib/pos-totals";
import type { CartItem, Category, Product, Sale, Station } from "@/types/pos";

export const mockStation: Station = {
  id: "st-01",
  name: "Register 1",
  storeId: "store-01",
  label: "Store 01 · Main floor",
};

export const mockCategories: Category[] = [
  { id: "devices", label: "Devices" },
  { id: "parts", label: "Parts" },
  { id: "accessories", label: "Acc" },
  { id: "services", label: "Svc" },
];

export const mockProducts: Product[] = [
  {
    id: "p-1",
    name: "iPhone 15 Screen",
    sku: "SCR-IP15",
    price: 129.99,
    categoryId: "parts",
    inventoryItemId: "inv-p-1",
  },
  {
    id: "p-2",
    name: "USB-C 2m",
    sku: "CBL-USBC-2",
    price: 19.99,
    categoryId: "accessories",
    inventoryItemId: "inv-p-2",
  },
  {
    id: "p-3",
    name: "Battery swap",
    sku: "SRV-BATT",
    price: 49.0,
    categoryId: "services",
  },
  {
    id: "p-4",
    name: "Galaxy case",
    sku: "CS-GS24",
    price: 34.99,
    categoryId: "accessories",
  },
  {
    id: "p-5",
    name: "iPad refurb",
    sku: "DEV-IPAD-R",
    price: 329.0,
    categoryId: "devices",
  },
  {
    id: "p-6",
    name: "Glass",
    sku: "ACC-GLS",
    price: 14.99,
    categoryId: "accessories",
  },
  {
    id: "p-7",
    name: "Board svc",
    sku: "SRV-LB",
    price: 199.0,
    categoryId: "services",
  },
  {
    id: "p-8",
    name: "Charge port",
    sku: "PRT-CP",
    price: 39.99,
    categoryId: "parts",
    inventoryItemId: "inv-p-8",
  },
  {
    id: "p-9",
    name: "Pixel 9",
    sku: "DEV-P9",
    price: 699.0,
    categoryId: "devices",
  },
  {
    id: "p-10",
    name: "Screen protector",
    sku: "ACC-SP",
    price: 12.99,
    categoryId: "accessories",
  },
];

function buildMockSale(id: string, isoTime: string, items: CartItem[]): Sale {
  const { subtotal, tax, total } = totalsFromCart(items);
  const migrated = migrateSale({
    id,
    stationId: mockStation.id,
    storeId: mockStation.storeId,
    createdAt: isoTime,
    lines: saleLinesFromCart(items),
    subtotal,
    tax,
    total,
  });
  if (!migrated) {
    throw new Error(`migrateSale failed for mock ${id}`);
  }
  return migrated;
}

export const mockRecentSales: Sale[] = [
  buildMockSale("sale-m1", "2026-03-27T10:15:00.000Z", [
    { kind: "product", product: mockProducts[0], quantity: 1 },
    { kind: "product", product: mockProducts[1], quantity: 2 },
  ]),
  buildMockSale("sale-m2", "2026-03-27T09:42:00.000Z", [
    { kind: "product", product: mockProducts[4], quantity: 1 },
  ]),
  buildMockSale("sale-m3", "2026-03-26T16:20:00.000Z", [
    { kind: "product", product: mockProducts[6], quantity: 1 },
  ]),
  buildMockSale("sale-m4", "2026-03-26T14:05:00.000Z", [
    { kind: "product", product: mockProducts[2], quantity: 1 },
    { kind: "product", product: mockProducts[7], quantity: 1 },
  ]),
];
