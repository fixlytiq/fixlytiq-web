import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mockRecentSales, mockStation } from "@/data/mock-pos";
import {
  allocateRepairPaymentFromSale,
  buildSaleRepairCheckoutSnapshot,
} from "@/lib/repair-checkout-snapshot";
import {
  maxCardAmountAllowed,
  paymentsCoverTotalDue,
  roundCurrency,
  salePaymentMethodSummary,
  validateCardTotalAgainstDue,
} from "@/lib/payment-totals";
import { repairPaymentTotals } from "@/lib/repair-payment-math";
import {
  cartIncludesRepairTicket,
  cloneCart,
  migratePosCart,
  posCartLineId,
} from "@/lib/pos-cart";
import {
  cartDemandByInventoryId,
  cartQtyForInventoryId,
  validatePosCheckoutStock,
} from "@/lib/pos-inventory";
import { saleLinesFromCart, totalsFromCart } from "@/lib/pos-totals";
import { migrateSale } from "@/lib/sale-migrate";
import type { PaymentEntry, PaymentMethod } from "@/types/payment";
import type {
  CartItem,
  PosCartCustomer,
  Product,
  Sale,
  Station,
} from "@/types/pos";
import type { SaleRepairCheckoutSnapshot } from "@/types/repair-sale-snapshot";
import { useInventoryStore } from "@/stores/inventory-store";
import { parseTaxRate, useSettingsStore } from "@/stores/settings-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { useSessionStore } from "@/stores/session-store";
import { useOrdersStore } from "@/stores/orders-store";
import {
  orderLinesFromCart,
  posCartItemsFromOrderLines,
} from "@/lib/order-mappers";
import { orderCustomerSnapshotFromLink } from "@/lib/customer-helpers";

export type PosPaymentSession = {
  /** Frozen cart for this checkout (edits on the live cart do not change totals mid-flow). */
  cart: CartItem[];
  subtotal: number;
  tax: number;
  totalDue: number;
  payments: PaymentEntry[];
};

export type PosStoreState = {
  station: Station;
  cart: CartItem[];
  recentSales: Sale[];
  /** `all` or a category id from mock catalog */
  categoryFilterId: string;
  /** Active split-payment flow, if any. */
  paymentSession: PosPaymentSession | null;
  /** Prevents double-submit on complete checkout. */
  paymentFlowBusy: boolean;
  /** Optional walk-in profile attached to this cart / checkout. */
  cartCustomer: PosCartCustomer | null;
  /**
   * Orders domain id for the current register checkout.
   * Set when resuming/parking an order from POS; cleared after checkout completion/cancel.
   */
  activeCheckoutOrderId: string | null;
  checkoutOpen: boolean;
  lastCompletedSale: Sale | null;
};

export type AddRepairCheckoutResult =
  | { ok: true }
  | { ok: false; error: string };

export type PosStockResult = { ok: true } | { ok: false; error: string };

export type AddPaymentLineResult =
  | { ok: true }
  | { ok: false; error: string };

export type SaveOpenOrderResult =
  | { ok: true }
  | { ok: false; error: string };

export type PosStoreActions = {
  addOrIncrementProduct: (product: Product) => PosStockResult;
  incrementLine: (lineId: string) => PosStockResult;
  decrementLine: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  setCartCustomer: (customer: PosCartCustomer | null) => void;
  setCategoryFilter: (id: string) => void;
  setStation: (station: Station) => void;
  /** Completed repair → POS cart (labor + parts); updates repair payment state. */
  addRepairCheckoutLine: (ticketId: string) => AddRepairCheckoutResult;
  /** One-off register line — not catalog inventory, no stock movement. */
  addCustomCartItem: (line: Extract<CartItem, { kind: "custom" }>) => void;
  /**
   * Opens checkout (freezes cart + totals). Stock is validated on complete only;
   * use Save as Open Order to park if needed.
   */
  openPaymentSession: () => PosStockResult;
  cancelPaymentSession: () => void;
  addPaymentToSession: (input: {
    method: PaymentMethod;
    amount: number;
    note?: string;
  }) => AddPaymentLineResult;
  updatePaymentAmountInSession: (
    paymentId: string,
    amount: number,
  ) => AddPaymentLineResult;
  removePaymentFromSession: (paymentId: string) => void;
  /** Park current checkout without payment; clears cart and session. */
  saveOpenOrderFromSession: (input?: {
    note?: string;
    label?: string;
  }) => SaveOpenOrderResult;
  resumeOpenOrder: (orderId: string) => PosStockResult;
  cancelOpenOrder: (orderId: string) => void;
  /** Commit inventory, sale, and repair linkage after tenders cover total due. */
  finalizePaymentSession: () => PosStockResult;
  dismissCheckout: () => void;
};

export type PosStore = PosStoreState & PosStoreActions;

function cloneProduct(p: Product): Product {
  return { ...p };
}

function stockCheckBeforeAddOne(
  product: Product,
  cart: CartItem[],
): PosStockResult {
  const invId = product.inventoryItemId;
  if (invId == null || invId === "") return { ok: true };

  const inv = useInventoryStore.getState().items.find((i) => i.id === invId);
  if (!inv) {
    return {
      ok: false,
      error: `Inventory row missing for ${product.sku}.`,
    };
  }
  const inCart = cartQtyForInventoryId(cart, invId);
  if (inCart + 1 > inv.quantityOnHand) {
    return {
      ok: false,
      error: `Only ${inv.quantityOnHand} on hand for ${inv.sku}.`,
    };
  }
  return { ok: true };
}

export const usePosStore = create<PosStore>()(
  persist(
    (set, get) => ({
      station: mockStation,
      cart: [],
      recentSales: [...mockRecentSales],
      categoryFilterId: "all",
      paymentSession: null,
      paymentFlowBusy: false,
      cartCustomer: null,
      activeCheckoutOrderId: null,
      checkoutOpen: false,
      lastCompletedSale: null,

      addOrIncrementProduct: (product) => {
        const state = get();
        const check = stockCheckBeforeAddOne(product, state.cart);
        if (!check.ok) return check;

        set((s) => {
          const cart = [...s.cart];
          const idx = cart.findIndex(
            (l) => l.kind === "product" && l.product.id === product.id,
          );
          if (idx === -1) {
            cart.push({
              kind: "product",
              product: cloneProduct(product),
              quantity: 1,
            });
          } else {
            const line = cart[idx];
            if (line.kind !== "product") return { cart: s.cart };
            cart[idx] = {
              ...line,
              quantity: line.quantity + 1,
            };
          }
          return { cart };
        });
        return { ok: true };
      },

      incrementLine: (lineId) => {
        const state = get();
        const line = state.cart.find((l) => posCartLineId(l) === lineId);
        if (line?.kind === "product") {
          const check = stockCheckBeforeAddOne(line.product, state.cart);
          if (!check.ok) return check;
        }

        set((s) => ({
          cart: s.cart.map((l) => {
            if (posCartLineId(l) !== lineId) return l;
            if (l.kind === "repair") return l;
            return { ...l, quantity: l.quantity + 1 };
          }),
        }));
        return { ok: true };
      },

      addCustomCartItem: (line) => {
        set((s) => ({ cart: [...s.cart, line] }));
      },

      decrementLine: (lineId) => {
        set((state) => ({
          cart: state.cart
            .map((line) => {
              if (posCartLineId(line) !== lineId) return line;
              if (line.kind === "repair") return line;
              return { ...line, quantity: line.quantity - 1 };
            })
            .filter((line) =>
              line.kind === "product" || line.kind === "custom"
                ? line.quantity > 0
                : true,
            ),
        }));
      },

      removeLine: (lineId) => {
        set((state) => ({
          cart: state.cart.filter((l) => posCartLineId(l) !== lineId),
        }));
      },

      clearCart: () => set({ cart: [], cartCustomer: null }),

      setCartCustomer: (customer) => set({ cartCustomer: customer }),

      setCategoryFilter: (id) => set({ categoryFilterId: id }),

      setStation: (station) => set({ station }),

      addRepairCheckoutLine: (ticketId) => {
        const prep = useRepairsStore
          .getState()
          .prepareRepairForPosCheckout(ticketId);
        if (!prep.ok) return prep;

        const ticket = useRepairsStore
          .getState()
          .tickets.find((t) => t.id === ticketId);
        if (!ticket) return { ok: false, error: "Ticket not found." };

        const { estimateTotal, collectedTotal, remainingBalance } =
          repairPaymentTotals(ticket);
        if (remainingBalance <= 0) {
          return {
            ok: false,
            error: "This repair is already fully paid.",
          };
        }
        const description = `Repair ${ticket.id} · ${ticket.brandModel}`;

        const state = get();
        if (cartIncludesRepairTicket(state.cart, ticketId)) {
          return { ok: false, error: "This repair is already on the ticket." };
        }

        set((s) => ({
          cart: [
            ...s.cart,
            {
              kind: "repair",
              origin: "repair_ticket",
              ticketId,
              description,
              unitPrice:
                Math.round(remainingBalance * 100) / 100,
              quantity: 1,
            },
          ],
        }));
        return { ok: true };
      },

      openPaymentSession: () => {
        const state = get();
        if (state.paymentSession) {
          return {
            ok: false,
            error: "Finish or cancel the current payment first.",
          };
        }
        if (state.cart.length === 0) {
          return { ok: false, error: "Cart is empty." };
        }

        const demand = cartDemandByInventoryId(state.cart);
        if (demand.size > 0) {
          const emp = useSessionStore.getState().employee;
          if (!emp) {
            return {
              ok: false,
              error:
                "Sign in to take payment — stock-tracked items require a signed-in associate.",
            };
          }
        }

        const taxRate = parseTaxRate(
          useSettingsStore.getState().settings.taxRate,
        );
        const { subtotal, tax, total } = totalsFromCart(state.cart, taxRate);
        set({
          paymentSession: {
            cart: cloneCart(state.cart),
            subtotal,
            tax,
            totalDue: roundCurrency(total),
            payments: [],
          },
        });
        return { ok: true };
      },

      cancelPaymentSession: () => set({ paymentSession: null }),

      addPaymentToSession: ({ method, amount, note }) => {
        const session = get().paymentSession;
        if (!session) {
          return { ok: false, error: "No payment in progress." };
        }
        const a = roundCurrency(amount);
        if (!Number.isFinite(a) || a <= 0) {
          return { ok: false, error: "Enter a positive amount." };
        }
        if (method === "card") {
          const maxCard = maxCardAmountAllowed(
            session.totalDue,
            session.payments,
          );
          if (a > maxCard + 0.005) {
            return {
              ok: false,
              error: `Card max $${maxCard.toFixed(2)} for this sale (amount due less other card lines).`,
            };
          }
        }
        const emp = useSessionStore.getState().employee;
        const entry: PaymentEntry = {
          id: crypto.randomUUID(),
          method,
          amount: a,
          recordedAt: new Date().toISOString(),
          processedBy: emp
            ? { employeeId: emp.id, name: emp.name }
            : null,
          note: note?.trim() ? note.trim() : null,
        };
        const nextPayments = [...session.payments, entry];
        const cardCheck = validateCardTotalAgainstDue(session.totalDue, nextPayments);
        if (!cardCheck.ok) return cardCheck;
        set({
          paymentSession: {
            ...session,
            payments: nextPayments,
          },
        });
        return { ok: true };
      },

      updatePaymentAmountInSession: (paymentId, amount) => {
        const session = get().paymentSession;
        if (!session) {
          return { ok: false, error: "No payment in progress." };
        }
        const a = roundCurrency(amount);
        if (!Number.isFinite(a) || a <= 0) {
          return { ok: false, error: "Enter a positive amount." };
        }
        const row = session.payments.find((p) => p.id === paymentId);
        if (!row) return { ok: false, error: "Payment line not found." };
        if (row.method === "card") {
          const maxCard = maxCardAmountAllowed(
            session.totalDue,
            session.payments,
            paymentId,
          );
          if (a > maxCard + 0.005) {
            return {
              ok: false,
              error: `Card max $${maxCard.toFixed(2)} for this line.`,
            };
          }
        }
        const nextPayments = session.payments.map((p) =>
          p.id === paymentId ? { ...p, amount: a } : p,
        );
        const cardCheck = validateCardTotalAgainstDue(session.totalDue, nextPayments);
        if (!cardCheck.ok) return cardCheck;
        set({
          paymentSession: { ...session, payments: nextPayments },
        });
        return { ok: true };
      },

      removePaymentFromSession: (paymentId) => {
        const session = get().paymentSession;
        if (!session) return;
        set({
          paymentSession: {
            ...session,
            payments: session.payments.filter((p) => p.id !== paymentId),
          },
        });
      },

      saveOpenOrderFromSession: (input) => {
        const state = get();
        const session = state.paymentSession;
        if (!session) {
          return { ok: false, error: "Open checkout first." };
        }
        const emp = useSessionStore.getState().employee;
        const createdBy = emp
          ? { employeeId: emp.id, name: emp.name }
          : null;
        const orderId = state.activeCheckoutOrderId;

        const lines = orderLinesFromCart(session.cart);
        const linkedRepairTicketId = session.cart.find(
          (l): l is Extract<CartItem, { kind: "repair" }> => l.kind === "repair",
        )?.ticketId;

        const customer = orderCustomerSnapshotFromLink(
          state.cartCustomer?.snapshot ?? null,
        );
        const note = input?.note?.trim() ? input?.note.trim() : null;
        const label = input?.label?.trim() ? input?.label.trim() : null;

        const orders = useOrdersStore.getState();

        if (orderId) {
          const r = orders.parkOrder(
            orderId,
            {
              lines,
              subtotal: session.subtotal,
              tax: session.tax,
              total: session.totalDue,
              linkedRepairTicketId: linkedRepairTicketId ?? null,
              customer,
              note,
              label,
            },
            createdBy,
          );
          if (!r.ok) return r;
        } else {
          const r = orders.createOrder({
            stationId: state.station.id,
            storeId: state.station.storeId,
            createdBy,
            customer,
            lines,
            subtotal: session.subtotal,
            tax: session.tax,
            total: session.totalDue,
            linkedRepairTicketId: linkedRepairTicketId ?? null,
            note,
            label,
          });
          if (!r.ok) return r;
        }

        set({
          paymentSession: null,
          cart: [],
          cartCustomer: null,
          activeCheckoutOrderId: null,
        });
        return { ok: true };
      },

      resumeOpenOrder: (orderId) => {
        const state = get();
        if (state.paymentSession) {
          return {
            ok: false,
            error: "Finish or cancel the current checkout first.",
          };
        }
        const emp = useSessionStore.getState().employee;
        const by = emp ? { employeeId: emp.id, name: emp.name } : null;
        const orders = useOrdersStore.getState();
        const order = orders.orders.find((o) => o.id === orderId) ?? null;
        if (!order) return { ok: false, error: "Order not found." };

        const r = orders.resumeOrder(orderId, by);
        if (!r.ok) return { ok: false, error: r.error };

        const cartCustomer: PosCartCustomer | null =
          order.customer?.customerId && order.customer.name.trim()
            ? {
                customerId: order.customer.customerId,
                snapshot: {
                  customerId: order.customer.customerId,
                  fullName: order.customer.name.trim(),
                  phone: order.customer.phone?.trim() ?? "",
                  email: order.customer.email?.trim() ?? "",
                  company: order.customer.company ?? null,
                },
              }
            : null;

        set({
          cart: posCartItemsFromOrderLines(order.lines),
          activeCheckoutOrderId: orderId,
          cartCustomer,
        });
        return { ok: true };
      },

      cancelOpenOrder: (orderId) => {
        const emp = useSessionStore.getState().employee;
        const by = emp ? { employeeId: emp.id, name: emp.name } : null;
        const orders = useOrdersStore.getState();
        void orders.cancelOrder(orderId, by);
        set((s) => ({
          activeCheckoutOrderId:
            s.activeCheckoutOrderId === orderId ? null : s.activeCheckoutOrderId,
        }));
      },

      finalizePaymentSession: () => {
        const state = get();
        if (state.paymentFlowBusy) {
          return { ok: false, error: "Already processing checkout." };
        }
        const session = state.paymentSession;
        if (!session) {
          return { ok: false, error: "No payment in progress." };
        }
        if (!paymentsCoverTotalDue(session.totalDue, session.payments)) {
          const cardCheck = validateCardTotalAgainstDue(
            session.totalDue,
            session.payments,
          );
          if (!cardCheck.ok) return cardCheck;
          return {
            ok: false,
            error: "Tender must cover the total due before completing.",
          };
        }
        set({ paymentFlowBusy: true });

        const inventory = useInventoryStore.getState();
        const stockCheck = validatePosCheckoutStock(
          session.cart,
          inventory.items,
        );
        if (!stockCheck.ok) {
          set({ paymentFlowBusy: false });
          return stockCheck;
        }

        const demand = cartDemandByInventoryId(session.cart);
        if (demand.size > 0) {
          const emp = useSessionStore.getState().employee;
          if (!emp) {
            set({ paymentFlowBusy: false });
            return {
              ok: false,
              error:
                "Sign in to complete checkout — stock-tracked items require a signed-in associate.",
            };
          }
          const by = { employeeId: emp.id, name: emp.name };
          for (const [invId, qty] of demand) {
            const inv = inventory.items.find((i) => i.id === invId);
            if (!inv) {
              set({ paymentFlowBusy: false });
              return {
                ok: false,
                error: "Inventory changed — cancel and try again.",
              };
            }
            const r = useInventoryStore.getState().recordStockRemove(
              invId,
              qty,
              "POS checkout",
              `Register · ${inv.sku} ×${qty}`,
              by,
            );
            if (!r.ok) {
              set({ paymentFlowBusy: false });
              return r;
            }
          }
        }

        const totalDue = session.totalDue;
        const payments = session.payments.map((p) => ({ ...p }));
        const totalCollected = roundCurrency(
          payments.reduce((s, p) => s + p.amount, 0),
        );
        const remainingBalance = roundCurrency(
          Math.max(0, totalDue - totalCollected),
        );
        const changeDue = roundCurrency(
          Math.max(0, totalCollected - totalDue),
        );

        const repairs = useRepairsStore.getState();
        const repairSnapshots: SaleRepairCheckoutSnapshot[] = [];
        const repairCheckoutRows: {
          line: Extract<CartItem, { kind: "repair" }>;
          snap: SaleRepairCheckoutSnapshot;
        }[] = [];
        for (const line of session.cart) {
          if (line.kind !== "repair") continue;
          const ticket = repairs.tickets.find((t) => t.id === line.ticketId);
          if (!ticket) continue;
          const snap = buildSaleRepairCheckoutSnapshot(ticket);
          repairSnapshots.push(snap);
          repairCheckoutRows.push({ line, snap });
        }

        const sessionEmp = useSessionStore.getState().employee;
        const createdAt = new Date().toISOString();
        const cartCust = get().cartCustomer;
        const sale: Sale = {
          id: crypto.randomUUID(),
          stationId: state.station.id,
          storeId: state.station.storeId,
          createdAt,
          lines: saleLinesFromCart(session.cart),
          subtotal: session.subtotal,
          tax: session.tax,
          total: totalDue,
          totalDue,
          totalCollected,
          remainingBalance,
          changeDue,
          payments,
          linkedRepairTicketId:
            repairSnapshots[0]?.linkedRepairTicketId ??
            session.cart.find(
              (l): l is Extract<CartItem, { kind: "repair" }> => l.kind === "repair",
            )?.ticketId ??
            null,
          repairCheckouts:
            repairSnapshots.length > 0 ? repairSnapshots : undefined,
          processedBy: sessionEmp
            ? { employeeId: sessionEmp.id, name: sessionEmp.name }
            : null,
          paymentMethod: salePaymentMethodSummary(payments),
          customerId: cartCust?.customerId ?? null,
          customerSnapshot: cartCust?.snapshot ?? null,
        };

        const paidAt = sale.createdAt;
        for (const { line, snap } of repairCheckoutRows) {
          const repairCartSubtotal = roundCurrency(line.unitPrice * line.quantity);
          const { collectedTotal, taxAllocated } =
            allocateRepairPaymentFromSale(repairCartSubtotal, sale);
          repairs.markRepairPaidFromPosSale(snap.linkedRepairTicketId, {
            saleId: sale.id,
            paidAt,
            snapshot: snap,
            paymentSummary: {
              laborSubtotal: snap.pricing.laborSubtotal,
              partsSubtotal: snap.pricing.partsSubtotal,
              repairSubtotalPreTax: snap.pricing.repairSubtotalPreTax,
              collectedTotal,
              taxAllocated,
            },
          });
        }

        // If checkout came from an Orders record, mark it as paid and link this sale.
        if (state.activeCheckoutOrderId) {
          const orders = useOrdersStore.getState();
          const by = sessionEmp
            ? { employeeId: sessionEmp.id, name: sessionEmp.name }
            : null;
          void orders.markOrderPaidFromSale(
            state.activeCheckoutOrderId,
            {
              saleId: sale.id,
              paymentSummary: {
                subtotal: session.subtotal,
                tax: session.tax,
                totalDue,
                totalCollected,
                remainingBalance,
                changeDue,
                payments,
                paymentMethod: sale.paymentMethod ?? null,
              },
            },
            by,
          );
        }

        set({
          recentSales: [sale, ...state.recentSales].slice(0, 50),
          cart: [],
          cartCustomer: null,
          paymentSession: null,
          paymentFlowBusy: false,
          lastCompletedSale: sale,
          activeCheckoutOrderId: null,
          checkoutOpen: true,
        });
        return { ok: true };
      },

      dismissCheckout: () =>
        set({ checkoutOpen: false, lastCompletedSale: null }),
    }),
    {
      name: "fixlytiq-pos",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        station: state.station,
        cart: state.cart,
        cartCustomer: state.cartCustomer,
        recentSales: state.recentSales,
        activeCheckoutOrderId: state.activeCheckoutOrderId,
        categoryFilterId: state.categoryFilterId,
      }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<PosStoreState> | undefined;
        const rawCart = p?.cart;
        const cart = Array.isArray(rawCart)
          ? migratePosCart(rawCart)
          : current.cart;
        const rawSales = p?.recentSales;
        const recentSales = Array.isArray(rawSales)
          ? rawSales
              .map((s) => migrateSale(s))
              .filter((s): s is Sale => s !== null)
          : current.recentSales;
        const activeCheckoutOrderId =
          typeof p?.activeCheckoutOrderId === "string"
            ? p.activeCheckoutOrderId
            : current.activeCheckoutOrderId;
        const cc = p?.cartCustomer;
        const cartCustomer =
          cc &&
          typeof cc === "object" &&
          typeof (cc as PosCartCustomer).customerId === "string" &&
          (cc as PosCartCustomer).snapshot &&
          typeof (cc as PosCartCustomer).snapshot.fullName === "string"
            ? (cc as PosCartCustomer)
            : current.cartCustomer;
        const station = p?.station ?? current.station;
        const categoryFilterId =
          typeof p?.categoryFilterId === "string"
            ? p.categoryFilterId
            : current.categoryFilterId;
        return {
          ...current,
          station,
          cart,
          recentSales,
          activeCheckoutOrderId,
          cartCustomer,
          categoryFilterId,
        };
      },
    },
  ),
);
