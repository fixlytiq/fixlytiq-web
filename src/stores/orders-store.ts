import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Order,
  OrderCustomerSnapshot,
  OrderHistoryEntry,
  OrderLine,
  OrderPaymentSummary,
  OrderStatus,
} from "@/types/orders";
import type { RefundSummary } from "@/types/refunds";
import type { PaymentEntry, PaymentProcessorSnapshot } from "@/types/payment";
import { migratePosCart } from "@/lib/pos-cart";
import { orderLinesFromCart } from "@/lib/order-mappers";

const STORAGE_KEY = "fixlytiq-orders";

const ORDER_STATUSES: readonly OrderStatus[] = [
  "open",
  "pending",
  "partially_paid",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isOrderStatus(v: unknown): v is OrderStatus {
  return ORDER_STATUSES.includes(v as OrderStatus);
}

function migratePaymentProcessorSnapshot(
  raw: unknown,
): PaymentProcessorSnapshot | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  if (typeof raw.employeeId !== "string") return null;
  if (typeof raw.name !== "string") return null;
  return { employeeId: raw.employeeId, name: raw.name };
}

function migrateCustomerSnapshot(
  raw: unknown,
): OrderCustomerSnapshot {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  const customerId =
    raw.customerId === null || raw.customerId === undefined
      ? null
      : typeof raw.customerId === "string"
        ? raw.customerId
        : null;
  const phone = typeof raw.phone === "string" ? raw.phone : undefined;
  const email = typeof raw.email === "string" ? raw.email : undefined;
  const company =
    raw.company === null || raw.company === undefined
      ? null
      : typeof raw.company === "string"
        ? raw.company.trim() || null
        : null;
  return {
    customerId,
    name: raw.name.trim(),
    phone: phone?.trim(),
    email: email?.trim(),
    company,
  };
}

function migrateOrderLine(raw: unknown): OrderLine | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (raw.lineKind !== "product" && raw.lineKind !== "repair" && raw.lineKind !== "custom") {
    return null;
  }
  if (typeof raw.productId !== "string") return null;
  if (typeof raw.name !== "string") return null;
  if (typeof raw.sku !== "string") return null;
  const unitPrice = Number(raw.unitPrice);
  const quantity = Number(raw.quantity);
  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity) || quantity < 1) {
    return null;
  }
  return {
    id: raw.id,
    lineKind: raw.lineKind,
    productId: raw.productId,
    name: raw.name,
    sku: raw.sku,
    unitPrice: Math.round(unitPrice * 100) / 100,
    quantity: Math.max(1, Math.floor(quantity)),
    categoryId:
      raw.categoryId === undefined || raw.categoryId === null
        ? null
        : typeof raw.categoryId === "string"
          ? raw.categoryId
          : null,
    inventoryItemId:
      raw.inventoryItemId === undefined || raw.inventoryItemId === null
        ? null
        : String(raw.inventoryItemId),
    repairTicketId:
      raw.repairTicketId === null || raw.repairTicketId === undefined
        ? null
        : String(raw.repairTicketId),
    customItemId:
      raw.customItemId === null || raw.customItemId === undefined
        ? null
        : String(raw.customItemId),
    note:
      raw.note === null || raw.note === undefined
        ? null
        : typeof raw.note === "string"
          ? raw.note
          : null,
    taxable:
      raw.taxable === null || raw.taxable === undefined
        ? undefined
        : raw.taxable === true,
    categoryLabel:
      raw.categoryLabel === null || raw.categoryLabel === undefined
        ? null
        : typeof raw.categoryLabel === "string"
          ? raw.categoryLabel
          : null,
  };
}

function migrateOrderHistoryEntry(raw: unknown): OrderHistoryEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (typeof raw.at !== "string") return null;
  if (typeof raw.type !== "string") return null;
  const by = migratePaymentProcessorSnapshot(raw.by);
  const allowedTypes = new Set([
    "created",
    "status_changed",
    "lines_updated",
    "payment_recorded",
    "cancelled",
    "note_added",
    "refunded",
    "customer_assigned",
  ]);
  if (!allowedTypes.has(raw.type)) return null;
  if (raw.fromStatus !== undefined && raw.fromStatus !== null && !isOrderStatus(raw.fromStatus)) return null;
  if (raw.toStatus !== undefined && raw.toStatus !== null && !isOrderStatus(raw.toStatus)) return null;
  return {
    id: raw.id,
    at: raw.at,
    type: raw.type as OrderHistoryEntry["type"],
    by,
    fromStatus: raw.fromStatus as OrderStatus | null | undefined,
    toStatus: raw.toStatus as OrderStatus | null | undefined,
    linkedSaleId:
      raw.linkedSaleId === undefined ? undefined : (raw.linkedSaleId === null ? null : String(raw.linkedSaleId)),
    refundId:
      raw.refundId === undefined ? undefined : (raw.refundId === null ? null : String(raw.refundId)),
    note:
      raw.note === undefined ? undefined : (raw.note === null ? null : String(raw.note)),
  };
}

function migratePaymentEntry(raw: unknown): PaymentEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (raw.method !== "cash" && raw.method !== "card") return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;
  if (typeof raw.recordedAt !== "string") return null;
  return {
    id: raw.id,
    method: raw.method,
    amount: Math.round(amount * 100) / 100,
    recordedAt: raw.recordedAt,
    processedBy: migratePaymentProcessorSnapshot(raw.processedBy),
    note:
      raw.note === null || raw.note === undefined
        ? undefined
        : typeof raw.note === "string"
          ? raw.note
          : undefined,
  };
}

function migrateOrder(raw: unknown): Order | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const storeId = typeof raw.storeId === "string" ? raw.storeId : "";
  const stationId = typeof raw.stationId === "string" ? raw.stationId : "";
  if (!id || !storeId || !stationId) return null;

  const status = raw.status;
  if (!isOrderStatus(status)) return null;

  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt;

  const createdBy = migratePaymentProcessorSnapshot(raw.createdBy);
  const customer = migrateCustomerSnapshot(raw.customer);

  const linesRaw = raw.lines;
  if (!Array.isArray(linesRaw)) return null;
  const lines = linesRaw.map(migrateOrderLine).filter((l): l is OrderLine => l !== null);
  if (lines.length === 0) return null;

  const linkedRepairTicketId =
    raw.linkedRepairTicketId === undefined || raw.linkedRepairTicketId === null
      ? null
      : String(raw.linkedRepairTicketId);

  const note =
    raw.note === undefined || raw.note === null ? null : String(raw.note);
  const label =
    raw.label === undefined || raw.label === null ? null : String(raw.label);

  const subtotal = Number(raw.subtotal);
  const tax = Number(raw.tax);
  const total = Number(raw.total);
  if (!Number.isFinite(subtotal) || !Number.isFinite(tax) || !Number.isFinite(total)) {
    return null;
  }

  const paymentSummary = isRecord(raw.paymentSummary)
    ? (() => {
        const ps = raw.paymentSummary as Record<string, unknown>;
        const psSubtotal = Number(ps.subtotal);
        const psTax = Number(ps.tax);
        const totalDue = Number(ps.totalDue);
        const totalCollected = Number(ps.totalCollected);
        const remainingBalance = Number(ps.remainingBalance);
        const changeDue = Number(ps.changeDue);
        const paymentsRaw = Array.isArray(ps.payments) ? ps.payments : [];
        const payments = paymentsRaw
          .map((p) => migratePaymentEntry(p))
          .filter((p): p is PaymentEntry => p !== null);
        if (
          !Number.isFinite(psSubtotal) ||
          !Number.isFinite(psTax) ||
          !Number.isFinite(totalDue) ||
          !Number.isFinite(totalCollected) ||
          !Number.isFinite(remainingBalance) ||
          !Number.isFinite(changeDue)
        ) {
          return null;
        }
        return {
          subtotal: psSubtotal,
          tax: psTax,
          totalDue,
          totalCollected,
          remainingBalance,
          changeDue,
          payments,
          paymentMethod:
            typeof ps.paymentMethod === "string" ? ps.paymentMethod : null,
        } satisfies OrderPaymentSummary;
      })()
    : null;
  const historyRaw = Array.isArray(raw.history) ? raw.history : [];
  const history = historyRaw.map(migrateOrderHistoryEntry).filter((h): h is OrderHistoryEntry => h !== null);

  const linkedSaleIds = Array.isArray(raw.linkedSaleIds)
    ? raw.linkedSaleIds.filter((x) => typeof x === "string")
    : [];

  return {
    id,
    storeId,
    stationId,
    createdBy,
    createdAt,
    updatedAt,
    status,
    history,
    customer,
    lines,
    subtotal,
    tax,
    total,
    paymentSummary,
    linkedRepairTicketId: linkedRepairTicketId || null,
    note,
    label,
    linkedSaleIds,
  };
}

function deriveLinkedRepairTicketIdFromCart(cart: unknown): string | null {
  if (!Array.isArray(cart)) return null;
  for (const row of cart) {
    if (!isRecord(row)) continue;
    if (row.kind === "repair" && typeof row.ticketId === "string" && row.ticketId) {
      return row.ticketId;
    }
  }
  return null;
}

function migratePosOpenOrderToOrder(raw: unknown): Order | null {
  if (!isRecord(raw)) return null;
  const o = raw;
  const id = typeof o.id === "string" ? o.id : "";
  const stationId = typeof o.stationId === "string" ? o.stationId : "";
  const storeId = typeof o.storeId === "string" ? o.storeId : "";
  if (!id || !stationId || !storeId) return null;

  const cart = migratePosCart(o.cart);
  if (cart.length === 0) return null;
  const lines = orderLinesFromCart(cart);
  if (lines.length === 0) return null;

  const createdAt =
    typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString();
  const updatedAt =
    typeof o.updatedAt === "string" ? o.updatedAt : createdAt;

  const createdBy = migratePaymentProcessorSnapshot(o.createdBy);
  const customer = migrateCustomerSnapshot(o.customer);

  const subtotal = Number(o.subtotal);
  const tax = Number(o.tax);
  const total = Number(o.total);
  if (!Number.isFinite(subtotal) || !Number.isFinite(tax) || !Number.isFinite(total)) {
    return null;
  }

  const linkedRepairTicketId =
    typeof o.linkedRepairTicketId === "string"
      ? o.linkedRepairTicketId
      : deriveLinkedRepairTicketIdFromCart(cart) ??
        null;

  return {
    id,
    storeId,
    stationId,
    createdBy,
    createdAt,
    updatedAt,
    status: "open",
    history: [
      initialOrderHistoryEntry({
        type: "created",
        by: createdBy,
        fromStatus: null,
        toStatus: "open",
      }),
    ],
    customer,
    lines,
    subtotal,
    tax,
    total,
    paymentSummary: null,
    linkedRepairTicketId: linkedRepairTicketId || null,
    note: o.note === undefined || o.note === null ? null : String(o.note),
    label: o.label === undefined || o.label === null ? null : String(o.label),
    linkedSaleIds: [],
  };
}

function initialOrderHistoryEntry(input: {
  type: OrderHistoryEntry["type"];
  by: PaymentProcessorSnapshot | null;
  fromStatus?: OrderStatus | null;
  toStatus?: OrderStatus | null;
  linkedSaleId?: string | null;
  refundId?: string | null;
  note?: string | null;
}): OrderHistoryEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: input.type,
    by: input.by,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    linkedSaleId: input.linkedSaleId,
    refundId: input.refundId,
    note: input.note ?? undefined,
  };
}

function deriveStatusFromPaymentSummary(
  ps: OrderPaymentSummary,
): OrderStatus {
  if (ps.totalCollected <= 0) return "pending";
  if (ps.remainingBalance <= 0) return "paid";
  return "partially_paid";
}

export type CreateOrderInput = {
  stationId: string;
  storeId: string;
  createdBy: PaymentProcessorSnapshot | null;
  customer: OrderCustomerSnapshot;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  linkedRepairTicketId: string | null;
  note: string | null;
  label: string | null;
};

export type OrdersStoreActions = {
  createOrder: (input: CreateOrderInput) => { ok: true; orderId: string } | { ok: false; error: string };
  resumeOrder: (orderId: string, by: PaymentProcessorSnapshot | null) => { ok: true } | { ok: false; error: string };
  parkOrder: (
    orderId: string,
    payload: {
      lines: OrderLine[];
      subtotal: number;
      tax: number;
      total: number;
      linkedRepairTicketId: string | null;
      customer: OrderCustomerSnapshot;
      note: string | null;
      label: string | null;
    },
    by: PaymentProcessorSnapshot | null,
  ) => { ok: true } | { ok: false; error: string };
  updateOrderLines: (
    orderId: string,
    payload: {
      lines: OrderLine[];
      subtotal: number;
      tax: number;
      total: number;
      linkedRepairTicketId: string | null;
      customer: OrderCustomerSnapshot;
      note: string | null;
      label: string | null;
    },
    by: PaymentProcessorSnapshot | null,
  ) => { ok: true } | { ok: false; error: string };
  cancelOrder: (orderId: string, by: PaymentProcessorSnapshot | null) => { ok: true } | { ok: false; error: string };
  recordRefundForOrder: (
    orderId: string,
    payload: {
      refundId: string;
      summary: RefundSummary;
      /** Optional audit line on order history (e.g. manager PIN approval). */
      historyNote?: string | null;
    },
    by: PaymentProcessorSnapshot | null,
  ) => { ok: true } | { ok: false; error: string };
  markOrderPaidFromSale: (
    orderId: string,
    payload: {
      saleId: string;
      paymentSummary: OrderPaymentSummary;
    },
    by: PaymentProcessorSnapshot | null,
  ) => { ok: true } | { ok: false; error: string };
  addOrderNote: (orderId: string, note: string, by: PaymentProcessorSnapshot | null) => { ok: true } | { ok: false; error: string };
  setOrderCustomer: (
    orderId: string,
    customer: OrderCustomerSnapshot,
    by: PaymentProcessorSnapshot | null,
  ) => { ok: true } | { ok: false; error: string };
};

export type OrdersStoreState = {
  orders: Order[];
};

export type OrdersStore = OrdersStoreState & OrdersStoreActions;

export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set, get) => ({
      orders: [],

      createOrder: (input) => {
        const stationId = input.stationId.trim();
        const storeId = input.storeId.trim();
        if (!stationId || !storeId) {
          return { ok: false, error: "stationId and storeId are required." };
        }
        if (input.lines.length === 0) {
          return { ok: false, error: "Order must have at least one line." };
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const status: OrderStatus = "open";

        const order: Order = {
          id,
          storeId,
          stationId,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
          status,
          history: [
            initialOrderHistoryEntry({
              type: "created",
              by: input.createdBy,
              fromStatus: null,
              toStatus: status,
            }),
          ],
          customer: input.customer,
          lines: input.lines,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          paymentSummary: null,
          linkedRepairTicketId: input.linkedRepairTicketId,
          note: input.note,
          label: input.label,
          linkedSaleIds: [],
        };

        set((s) => ({ orders: [order, ...s.orders] }));
        return { ok: true, orderId: id };
      },

      resumeOrder: (orderId, by) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };
        if (order.status !== "open") {
          return { ok: false, error: "Only open orders can be resumed." };
        }
        const nextStatus: OrderStatus = "pending";
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
              history: [
                initialOrderHistoryEntry({
                  type: "status_changed",
                  by,
                  fromStatus: o.status,
                  toStatus: nextStatus,
                }),
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },

      updateOrderLines: (orderId, payload, by) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };
        if (order.status === "paid" || order.status === "fulfilled" || order.status === "cancelled" || order.status === "refunded") {
          return { ok: false, error: "Cannot update lines for a closed order." };
        }

        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              customer: payload.customer,
              lines: payload.lines,
              subtotal: payload.subtotal,
              tax: payload.tax,
              total: payload.total,
              linkedRepairTicketId: payload.linkedRepairTicketId,
              note: payload.note,
              label: payload.label,
              updatedAt: new Date().toISOString(),
              history: [
                initialOrderHistoryEntry({
                  type: "lines_updated",
                  by,
                  fromStatus: null,
                  toStatus: null,
                  note: `Updated ${payload.lines.length} line(s)`,
                }),
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },

      parkOrder: (orderId, payload, by) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };
        if (order.status !== "pending") {
          // POS can only park orders that are in the middle of a checkout.
          return { ok: false, error: "Only pending orders can be parked." };
        }

        const nextStatus: OrderStatus = "open";
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              status: nextStatus,
              customer: payload.customer,
              lines: payload.lines,
              subtotal: payload.subtotal,
              tax: payload.tax,
              total: payload.total,
              linkedRepairTicketId: payload.linkedRepairTicketId,
              note: payload.note,
              label: payload.label,
              updatedAt: new Date().toISOString(),
              history: [
                initialOrderHistoryEntry({
                  type: "status_changed",
                  by,
                  fromStatus: o.status,
                  toStatus: nextStatus,
                }),
                initialOrderHistoryEntry({
                  type: "lines_updated",
                  by,
                  note: `Parked with ${payload.lines.length} line(s)`,
                }),
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },

      cancelOrder: (orderId, by) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };
        if (order.status === "cancelled") return { ok: true };
        const nextStatus: OrderStatus = "cancelled";
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
              history: [
                initialOrderHistoryEntry({
                  type: "cancelled",
                  by,
                  fromStatus: o.status,
                  toStatus: nextStatus,
                }),
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },

      markOrderPaidFromSale: (orderId, payload, by) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };

        const nextStatus = deriveStatusFromPaymentSummary(payload.paymentSummary);
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
              paymentSummary: payload.paymentSummary,
              linkedSaleIds: Array.from(new Set([...o.linkedSaleIds, payload.saleId])),
              history: [
                {
                  ...initialOrderHistoryEntry({
                    type: "payment_recorded",
                    by,
                    fromStatus: o.status,
                    toStatus: nextStatus,
                    linkedSaleId: payload.saleId,
                  }),
                },
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },

      recordRefundForOrder: (orderId, payload, by) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };
        if (!order.paymentSummary) {
          return { ok: false, error: "Order has no payment summary." };
        }

        const prev = order.paymentSummary;
        const refundedTotal = payload.summary.refundedTotal;
        const newTotalCollected = Math.max(0, prev.totalCollected - refundedTotal);
        const newRemainingBalance = Math.max(0, prev.totalDue - newTotalCollected);

        const nextStatus: OrderStatus =
          newRemainingBalance <= 0 ? "paid" : newTotalCollected <= 0 ? "refunded" : "partially_paid";

        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              status: nextStatus,
              paymentSummary: {
                ...prev,
                totalCollected: newTotalCollected,
                remainingBalance: newRemainingBalance,
                changeDue: 0,
              },
              updatedAt: new Date().toISOString(),
              history: [
                initialOrderHistoryEntry({
                  type: "refunded",
                  by,
                  fromStatus: o.status,
                  toStatus: nextStatus,
                  refundId: payload.refundId,
                  note: payload.historyNote ?? null,
                }),
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },

      addOrderNote: (orderId, note, by) => {
        const trimmed = note.trim();
        if (!trimmed) return { ok: false, error: "Note cannot be empty." };
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              note: trimmed,
              updatedAt: new Date().toISOString(),
              history: [
                initialOrderHistoryEntry({
                  type: "note_added",
                  by,
                  note: trimmed,
                }),
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },

      setOrderCustomer: (orderId, customer, by) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found." };
        if (
          order.status === "paid" ||
          order.status === "fulfilled" ||
          order.status === "cancelled" ||
          order.status === "refunded"
        ) {
          return { ok: false, error: "Cannot change customer on a closed order." };
        }
        const label =
          customer?.name?.trim() ||
          (customer?.customerId ? "Linked customer" : "Walk-in");
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              customer,
              updatedAt: new Date().toISOString(),
              history: [
                initialOrderHistoryEntry({
                  type: "customer_assigned",
                  by,
                  note: label,
                }),
                ...o.history,
              ],
            };
          }),
        }));
        return { ok: true };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ orders: state.orders }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<OrdersStoreState> | undefined;
        const raw = p?.orders;
        const orders = Array.isArray(raw)
          ? raw.map((o) => migrateOrder(o)).filter((o): o is Order => o !== null)
          : current.orders;
        // One-time migration: convert legacy POS `openOrders` into Orders domain.
        if (orders.length === 0) {
          try {
            const rawPos = localStorage.getItem("fixlytiq-pos");
            if (rawPos) {
              const parsed = JSON.parse(rawPos) as unknown;
              const state =
                isRecord(parsed) && "state" in parsed && isRecord(parsed.state)
                  ? parsed.state
                  : isRecord(parsed)
                    ? parsed
                    : null;
              const openOrdersRaw = state ? (state.openOrders as unknown) : null;
              if (Array.isArray(openOrdersRaw)) {
                const migrated = openOrdersRaw
                  .map((o) => migratePosOpenOrderToOrder(o))
                  .filter((o): o is Order => o !== null);
                if (migrated.length > 0) {
                  return {
                    ...current,
                    ...(p && typeof p === "object" ? p : {}),
                    orders: migrated,
                  };
                }
              }
            }
          } catch {
            // ignore migration errors
          }
        }

        return {
          ...current,
          ...(p && typeof p === "object" ? p : {}),
          orders,
        };
      },
    },
  ),
);

