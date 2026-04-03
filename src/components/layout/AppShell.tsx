"use client";

import { DeviceChrome } from "@/components/layout/DeviceChrome";
import { RouteAccessGuard } from "@/components/layout/RouteAccessGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { TransactionDetailDrawer } from "@/components/pos/TransactionDetailDrawer";
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer";
import { CustomerDetailDrawer } from "@/components/customers";
import { DEVICE_UI_MODE } from "@/lib/device";

/**
 * Device shell: sidebar | (DeviceChrome + scrollable main).
 * Header is NOT position:fixed — it is a flex row above `main`, so main does
 * not use padding-top for the bar. Children use `h-full min-h-0` to fill the
 * remaining column (see POS).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="device-shell flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-zinc-950 text-zinc-50"
      data-local-ui={DEVICE_UI_MODE ? "1" : "0"}
    >
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DeviceChrome />
        <main className="device-main flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain bg-zinc-950 p-4 md:p-6">
          <RouteAccessGuard>{children}</RouteAccessGuard>
          <TransactionDetailDrawer />
          <OrderDetailDrawer />
          <CustomerDetailDrawer />
        </main>
      </div>
    </div>
  );
}
