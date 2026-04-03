import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_STORE_SETTINGS,
  type StoreSettings,
} from "@/types/operations";

export { DEFAULT_STORE_SETTINGS };
export type { StoreSettings };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function migrateSettings(raw: unknown): StoreSettings {
  if (!isRecord(raw)) return { ...DEFAULT_STORE_SETTINGS };
  const o = raw;
  return {
    storeName:
      typeof o.storeName === "string" && o.storeName.trim()
        ? o.storeName.trim()
        : DEFAULT_STORE_SETTINGS.storeName,
    address:
      typeof o.address === "string" ? o.address : DEFAULT_STORE_SETTINGS.address,
    phone:
      typeof o.phone === "string" ? o.phone : DEFAULT_STORE_SETTINGS.phone,
    taxRate:
      typeof o.taxRate === "string" && o.taxRate.trim()
        ? o.taxRate.trim()
        : DEFAULT_STORE_SETTINGS.taxRate,
    currency:
      typeof o.currency === "string" && o.currency.trim()
        ? o.currency.trim().toUpperCase()
        : DEFAULT_STORE_SETTINGS.currency,
    receiptFooter:
      typeof o.receiptFooter === "string"
        ? o.receiptFooter
        : DEFAULT_STORE_SETTINGS.receiptFooter,
    businessHours:
      typeof o.businessHours === "string"
        ? o.businessHours
        : DEFAULT_STORE_SETTINGS.businessHours,
  };
}

export type SettingsStoreState = {
  settings: StoreSettings;
};

export type SettingsStoreActions = {
  updateSettings: (patch: Partial<StoreSettings>) => void;
  resetToDefaults: () => void;
};

export type SettingsStore = SettingsStoreState & SettingsStoreActions;

/** Parse tax rate string to number; falls back to default. */
export function parseTaxRate(rateStr: string): number {
  const n = Number.parseFloat(rateStr);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return 0.0825;
  }
  return n;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: { ...DEFAULT_STORE_SETTINGS },

      updateSettings: (patch) =>
        set((s) => ({
          settings: { ...s.settings, ...patch },
        })),

      resetToDefaults: () =>
        set({ settings: { ...DEFAULT_STORE_SETTINGS } }),
    }),
    {
      name: "fixlytiq-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsStoreState> | undefined;
        return {
          ...current,
          settings: migrateSettings(p?.settings),
        };
      },
    },
  ),
);
