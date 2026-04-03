"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { roleCanEditStoreSettings } from "@/lib/rbac";
import {
  DEFAULT_STORE_SETTINGS,
  useSettingsStore,
} from "@/stores/settings-store";
import { useSessionStore } from "@/stores/session-store";
import { WaiversWorkspace } from "@/components/operations/WaiversWorkspace";

export function SettingsWorkspace() {
  const employee = useSessionStore((s) => s.employee);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const canEdit = employee && roleCanEditStoreSettings(employee.role);

  const fieldClass =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-500">
        You don&apos;t have access to store settings.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader variant="device" title="Store settings" />

      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <label className="block text-sm">
          <span className="text-zinc-500">Store name</span>
          <input
            className={fieldClass}
            value={draft.storeName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, storeName: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">Address</span>
          <textarea
            className={`${fieldClass} min-h-[4rem] resize-y py-2`}
            value={draft.address}
            onChange={(e) =>
              setDraft((d) => ({ ...d, address: e.target.value }))
            }
            rows={2}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">Phone</span>
          <input
            className={fieldClass}
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-500">Tax rate (decimal)</span>
            <input
              className={`${fieldClass} font-mono`}
              inputMode="decimal"
              value={draft.taxRate}
              onChange={(e) =>
                setDraft((d) => ({ ...d, taxRate: e.target.value }))
              }
              placeholder="0.0825"
            />
            <span className="mt-1 block text-xs text-zinc-600">
              e.g. 0.0825 = 8.25% — used at POS checkout
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Currency (ISO code)</span>
            <input
              className={`${fieldClass} font-mono uppercase`}
              value={draft.currency}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  currency: e.target.value.toUpperCase().slice(0, 8),
                }))
              }
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-zinc-500">Receipt footer</span>
          <textarea
            className={`${fieldClass} min-h-[4rem] resize-y py-2`}
            value={draft.receiptFooter}
            onChange={(e) =>
              setDraft((d) => ({ ...d, receiptFooter: e.target.value }))
            }
            rows={2}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">Business hours</span>
          <textarea
            className={`${fieldClass} min-h-[3.5rem] resize-y py-2`}
            value={draft.businessHours}
            onChange={(e) =>
              setDraft((d) => ({ ...d, businessHours: e.target.value }))
            }
            rows={2}
          />
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => updateSettings(draft)}
            className="touch-pad min-h-11 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white"
          >
            Save settings
          </button>
          <button
            type="button"
            onClick={() => {
              resetToDefaults();
              setDraft({ ...DEFAULT_STORE_SETTINGS });
            }}
            className="touch-pad min-h-11 rounded-xl border border-zinc-700 px-6 text-sm font-semibold text-zinc-400"
          >
            Reset defaults
          </button>
        </div>
      </div>

      <WaiversWorkspace />
    </div>
  );
}
