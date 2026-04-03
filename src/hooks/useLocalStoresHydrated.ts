"use client";

import { useEffect, useState } from "react";
import { useEmployeesStore } from "@/stores/employees-store";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePosStore } from "@/stores/pos-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useShiftsStore } from "@/stores/shifts-store";
import { useWaiversStore } from "@/stores/waivers-store";
import { useOrdersStore } from "@/stores/orders-store";
import { useRefundsStore } from "@/stores/refunds-store";
import { useCustomersStore } from "@/stores/customers-store";

/** Rehydrate persisted Zustand stores from localStorage (Next.js client-only). */
export function useLocalStoresHydrated(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([
      usePosStore.persist.rehydrate(),
      useSessionStore.persist.rehydrate(),
      useRepairsStore.persist.rehydrate(),
      useWaiversStore.persist.rehydrate(),
      useOrdersStore.persist.rehydrate(),
      useRefundsStore.persist.rehydrate(),
      useCustomersStore.persist.rehydrate(),
      useInventoryStore.persist.rehydrate(),
      useEmployeesStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
      useShiftsStore.persist.rehydrate(),
    ]).finally(() => setReady(true));
  }, []);

  return ready;
}
