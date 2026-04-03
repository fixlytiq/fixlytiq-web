"use client";

import { useEffect, useMemo, useState } from "react";
import { mockCategories, mockProducts } from "@/data/mock-pos";
import { posCartLineId } from "@/lib/pos-cart";
import {
  cartQtyForInventoryId,
  inventoryItemForProduct,
  inventoryItemToPosProduct,
  productIsLowStock,
} from "@/lib/pos-inventory";
import { cartLineSubtotal, totalsFromCart } from "@/lib/pos-totals";
import { saleIncludesRepairCheckout } from "@/lib/sale-repair";
import { CheckoutSuccessModal } from "@/components/pos/CheckoutSuccessModal";
import { OpenOrdersPanel } from "@/components/pos/OpenOrdersPanel";
import { CustomItemModal } from "@/components/pos/CustomItemModal";
import { PaymentCheckoutModal } from "@/components/pos/PaymentCheckoutModal";
import { useInventoryStore } from "@/stores/inventory-store";
import { parseTaxRate, useSettingsStore } from "@/stores/settings-store";
import { usePosStore } from "@/stores/pos-store";
import { customerLinkSnapshot } from "@/lib/customer-helpers";
import { useSessionStore } from "@/stores/session-store";
import { useTransactionUiStore } from "@/stores/transaction-ui-store";
import type { Product } from "@/types/pos";
import { CustomerPicker } from "@/components/customers/CustomerPicker";

const ALL = "all" as const;

function registerProductMatchesQuery(
  p: Product,
  query: string,
  inventoryItems: { id: string; barcode: string }[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (p.name.toLowerCase().includes(q)) return true;
  if (p.sku.toLowerCase().includes(q)) return true;
  const invId = p.inventoryItemId ?? "";
  const inv = invId
    ? inventoryItems.find((i) => i.id === invId)
    : inventoryItems.find((i) => i.id === p.id);
  if (inv?.barcode && inv.barcode.toLowerCase().includes(q)) return true;
  return false;
}

export function PosWorkspace() {
  const categoryFilterId = usePosStore((s) => s.categoryFilterId);
  const setCategoryFilter = usePosStore((s) => s.setCategoryFilter);
  const cart = usePosStore((s) => s.cart);
  const addOrIncrementProduct = usePosStore((s) => s.addOrIncrementProduct);
  const incrementLine = usePosStore((s) => s.incrementLine);
  const decrementLine = usePosStore((s) => s.decrementLine);
  const removeLine = usePosStore((s) => s.removeLine);
  const clearCart = usePosStore((s) => s.clearCart);
  const openPaymentSession = usePosStore((s) => s.openPaymentSession);
  const cancelPaymentSession = usePosStore((s) => s.cancelPaymentSession);
  const paymentSession = usePosStore((s) => s.paymentSession);
  const dismissCheckout = usePosStore((s) => s.dismissCheckout);
  const checkoutOpen = usePosStore((s) => s.checkoutOpen);
  const lastCompletedSale = usePosStore((s) => s.lastCompletedSale);
  const recentSales = usePosStore((s) => s.recentSales);
  const openTransactionDetail = useTransactionUiStore(
    (s) => s.openTransactionDetail,
  );
  const cartCustomer = usePosStore((s) => s.cartCustomer);
  const setCartCustomer = usePosStore((s) => s.setCartCustomer);
  const sessionEmployee = useSessionStore((s) => s.employee);
  const inventoryItems = useInventoryStore((s) => s.items);
  const invCategories = useInventoryStore((s) => s.categories);
  const taxRate = useSettingsStore((s) => parseTaxRate(s.settings.taxRate));

  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [registerSearch, setRegisterSearch] = useState("");

  useEffect(() => {
    if (!registerMessage) return;
    const t = window.setTimeout(() => setRegisterMessage(null), 6000);
    return () => window.clearTimeout(t);
  }, [registerMessage]);

  const filterTabs = useMemo(() => {
    const seen = new Set<string>([ALL]);
    const tabs: { id: string; label: string }[] = [
      { id: ALL, label: "All" },
      ...mockCategories.map((c) => {
        seen.add(c.id);
        return { id: c.id, label: c.label };
      }),
    ];
    for (const c of invCategories) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      tabs.push({ id: c.id, label: c.name });
    }
    return tabs;
  }, [invCategories]);

  const registerCatalog = useMemo(() => {
    const fromInventory = inventoryItems
      .filter((i) => i.linkedProductId == null)
      .map(inventoryItemToPosProduct);
    const combined = [...fromInventory, ...mockProducts];
    combined.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return combined;
  }, [inventoryItems]);

  const filtered = useMemo(() => {
    const byCat =
      categoryFilterId === ALL
        ? registerCatalog
        : registerCatalog.filter((p) => p.categoryId === categoryFilterId);
    return byCat.filter((p) =>
      registerProductMatchesQuery(p, registerSearch, inventoryItems),
    );
  }, [categoryFilterId, registerCatalog, registerSearch, inventoryItems]);

  const { subtotal, tax, total } = totalsFromCart(cart, taxRate);
  const canCharge = cart.length > 0 && !paymentSession;
  const cartLocked = paymentSession !== null;

  return (
    <>
      {registerMessage ? (
        <div
          className="rounded-xl border border-rose-500/35 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {registerMessage}
        </div>
      ) : null}

      <OpenOrdersPanel />

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
        <aside className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-44 lg:flex-col lg:overflow-y-auto lg:pb-0">
          {filterTabs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`touch-pad min-w-[5.5rem] shrink-0 rounded-xl px-4 text-center text-base font-semibold lg:w-full lg:text-left ${
                categoryFilterId === c.id
                  ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-100"
                  : "border border-zinc-800 bg-zinc-900/70 text-zinc-400 active:bg-zinc-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/30">
          <div className="shrink-0 space-y-2 border-b border-zinc-800 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Items
            </p>
            <label className="sr-only" htmlFor="pos-register-search">
              Search register
            </label>
            <input
              id="pos-register-search"
              type="search"
              value={registerSearch}
              onChange={(e) => setRegisterSearch(e.target.value)}
              placeholder="Search name, SKU, barcode…"
              autoComplete="off"
              className="w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="text-xs text-zinc-500">
              Showing {filtered.length} of {registerCatalog.length} in catalog
            </p>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((p) => {
              const inv = inventoryItemForProduct(p, inventoryItems);
              const invId = p.inventoryItemId;
              const tracked = invId != null && invId !== "";
              const inCartQty = tracked
                ? cartQtyForInventoryId(cart, invId)
                : 0;
              const onHand = inv?.quantityOnHand ?? 0;
              const atMax = tracked && inCartQty >= onHand;
              const low = productIsLowStock(p, inventoryItems);
              const out = tracked && onHand === 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={atMax || cartLocked}
                  onClick={() => {
                    const r = addOrIncrementProduct(p);
                    if (!r.ok) setRegisterMessage(r.error);
                    else setRegisterMessage(null);
                  }}
                  className={`flex min-h-[7rem] flex-col rounded-2xl border p-4 text-left lg:min-h-[8.5rem] ${
                    atMax
                      ? "cursor-not-allowed border-zinc-800/80 bg-zinc-950/50 opacity-50"
                      : "border-zinc-800 bg-zinc-950/80 active:scale-[0.99] active:bg-zinc-900"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="line-clamp-2 text-base font-semibold leading-snug text-zinc-100">
                      {p.name}
                    </span>
                    {low && !out ? (
                      <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-200/90">
                        Low
                      </span>
                    ) : null}
                    {out ? (
                      <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-200/90">
                        Out
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-1 font-mono text-xs text-zinc-500">{p.sku}</span>
                  {tracked ? (
                    <span className="mt-1 font-mono text-[0.7rem] text-zinc-500">
                      {onHand} on hand
                      {inCartQty > 0 ? ` · ${inCartQty} in ticket` : null}
                    </span>
                  ) : null}
                  <span className="mt-auto pt-3 font-mono text-xl font-bold text-emerald-400">
                    ${p.price.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="flex max-h-[min(52vh,28rem)] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/50 lg:max-h-none lg:h-auto lg:w-[min(22rem,40vw)] xl:w-96">
          <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Ticket
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-zinc-50">
              ${total.toFixed(2)}
            </p>
            <button
              type="button"
              disabled={cartLocked}
              onClick={() => setCustomItemOpen(true)}
              className="touch-pad mt-3 w-full rounded-xl border border-cyan-500/40 bg-cyan-950/35 py-2.5 text-sm font-bold uppercase tracking-wide text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Custom item
            </button>
            <div className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-2">
              <p className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
                Customer (optional)
              </p>
              <CustomerPicker
                className="mt-1"
                selectedCustomerId={cartCustomer?.customerId ?? null}
                createdBy={
                  sessionEmployee
                    ? {
                        employeeId: sessionEmployee.id,
                        name: sessionEmployee.name,
                      }
                    : null
                }
                onSelect={(c) =>
                  setCartCustomer({
                    customerId: c.id,
                    snapshot: customerLinkSnapshot(c),
                  })
                }
                onClear={() => setCartCustomer(null)}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
                Tap items to sell
              </p>
            ) : (
              cart.map((line) => {
                const lineId = posCartLineId(line);
                const isRepair = line.kind === "repair";
                const isCustom = line.kind === "custom";
                const label =
                  line.kind === "product"
                    ? line.product.name
                    : line.kind === "custom"
                      ? line.name
                      : line.description;
                const sku =
                  line.kind === "product"
                    ? line.product.sku
                    : line.kind === "custom"
                      ? line.sku
                      : "Repair payment";
                const unit =
                  line.kind === "product"
                    ? line.product.price
                    : line.unitPrice;
                const invId =
                  line.kind === "product"
                    ? line.product.inventoryItemId
                    : null;
                const invRow =
                  invId != null && invId !== ""
                    ? inventoryItems.find((i) => i.id === invId)
                    : null;
                const invDemand =
                  invId != null && invId !== ""
                    ? cartQtyForInventoryId(cart, invId)
                    : 0;
                const lineAtMax =
                  invRow != null && invDemand >= invRow.quantityOnHand;
                return (
                  <div
                    key={lineId}
                    className={`rounded-xl border bg-zinc-950/70 p-3 ${
                      isRepair
                        ? "border-amber-500/35"
                        : isCustom
                          ? "border-cyan-500/30"
                          : "border-zinc-800/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isRepair ? (
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-amber-400/90">
                            Repair payment
                          </p>
                        ) : null}
                        {isCustom ? (
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-cyan-400/90">
                            Custom
                            {line.categoryLabel
                              ? ` · ${line.categoryLabel}`
                              : ""}
                            {!line.taxable ? " · Tax-exempt" : ""}
                          </p>
                        ) : null}
                        <p className="truncate text-base font-medium text-zinc-100">
                          {label}
                        </p>
                        <p className="font-mono text-xs text-zinc-500">
                          {sku} · ${unit.toFixed(2)} ea
                        </p>
                        {line.kind === "custom" && line.note ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            {line.note}
                          </p>
                        ) : null}
                        {invRow ? (
                          <p className="mt-1 font-mono text-[0.7rem] text-zinc-500">
                            Stock {invRow.quantityOnHand} on hand
                            {lineAtMax ? " · at max in ticket" : null}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(lineId)}
                        disabled={cartLocked}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-400/90 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Remove ${label}`}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => decrementLine(lineId)}
                          disabled={isRepair || cartLocked}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-lg font-semibold text-zinc-200 active:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-[2rem] text-center font-mono text-lg font-semibold tabular-nums text-zinc-100">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const r = incrementLine(lineId);
                            if (!r.ok) setRegisterMessage(r.error);
                          }}
                          disabled={isRepair || lineAtMax || cartLocked}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-lg font-semibold text-zinc-200 active:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <p className="font-mono text-base font-semibold tabular-nums text-zinc-100">
                        ${cartLineSubtotal(line).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="shrink-0 space-y-2 border-t border-zinc-800 px-3 pb-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Recent
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-500">
              {recentSales.slice(0, 12).map((s) => {
                const repair = saleIncludesRepairCheckout(s);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => openTransactionDetail(s.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-left font-mono tabular-nums hover:bg-zinc-800/60"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                        <span className="truncate text-zinc-500">
                          {new Date(s.createdAt).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {repair ? (
                          <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-200/90">
                            Repair
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-zinc-400">
                        ${s.total.toFixed(2)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="shrink-0 space-y-2 border-t border-zinc-800 p-4">
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Subtotal</span>
              <span className="font-mono text-zinc-200">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
              <span className="font-mono text-zinc-200">${tax.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => clearCart()}
                disabled={cart.length === 0 || cartLocked}
                className="touch-pad rounded-xl border border-zinc-700 bg-zinc-950/80 text-base font-semibold text-zinc-300 disabled:opacity-40 active:bg-zinc-900"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const r = openPaymentSession();
                  if (!r.ok) setRegisterMessage(r.error);
                  else setRegisterMessage(null);
                }}
                disabled={!canCharge}
                className="touch-pad rounded-xl bg-emerald-600 text-base font-bold text-white shadow-md shadow-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40 active:bg-emerald-500"
              >
                Charge
              </button>
            </div>
          </div>
        </aside>
      </div>

      <CustomItemModal
        open={customItemOpen}
        onClose={() => setCustomItemOpen(false)}
      />

      <PaymentCheckoutModal onClose={() => cancelPaymentSession()} />

      <CheckoutSuccessModal
        open={checkoutOpen}
        sale={lastCompletedSale}
        onDismiss={dismissCheckout}
        onViewTransaction={
          lastCompletedSale
            ? () =>
                useTransactionUiStore
                  .getState()
                  .openTransactionDetail(lastCompletedSale.id)
            : undefined
        }
      />
    </>
  );
}
