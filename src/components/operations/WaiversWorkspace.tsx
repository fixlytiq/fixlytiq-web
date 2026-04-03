"use client";

import { useEffect, useMemo, useState } from "react";
import { usePosStore } from "@/stores/pos-store";
import { useWaiversStore } from "@/stores/waivers-store";
import type { WaiverTemplateCategory } from "@/types/waivers";

const CATEGORY_OPTIONS: readonly {
  value: WaiverTemplateCategory;
  label: string;
}[] = [
  { value: "repair", label: "Repair" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "water_damage", label: "Water damage" },
  { value: "data_loss", label: "Data loss" },
  { value: "storage_policy", label: "Storage policy" },
  { value: "custom", label: "Custom" },
];

function categoryLabel(v: WaiverTemplateCategory): string {
  return CATEGORY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function WaiversWorkspace() {
  const storeId = usePosStore((s) => s.station.storeId);
  const allTemplates = useWaiversStore((s) => s.templates);

  const templates = useMemo(() => {
    return allTemplates
      .filter((t) => t.storeId === storeId)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [allTemplates, storeId]);
  const defaultRepairId = useWaiversStore(
    (s) => s.defaultRepairWaiverTemplateId,
  );
  const createTemplate = useWaiversStore((s) => s.createTemplate);
  const updateTemplate = useWaiversStore((s) => s.updateTemplate);
  const setTemplateActive = useWaiversStore((s) => s.setTemplateActive);
  const setDefaultRepairWaiverTemplateId = useWaiversStore(
    (s) => s.setDefaultRepairWaiverTemplateId,
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  /**
   * Stable revision key for the selected row — do not depend on `selectedTemplate` object identity
   * in effects (Zustand replaces template objects on unrelated updates).
   */
  const selectedTemplateRev =
    selectedTemplateId === null
      ? "create"
      : selectedTemplate
        ? `${selectedTemplate.id}#${selectedTemplate.updatedAt}#${selectedTemplate.version}`
        : "stale";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WaiverTemplateCategory>("repair");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    if (selectedTemplateId === null) {
      setTitle("");
      setCategory("repair");
      setBody("");
      setActive(true);
      setSetAsDefault(false);
      return;
    }
    if (selectedTemplateRev === "stale" || !selectedTemplate) {
      setTitle("");
      setCategory("repair");
      setBody("");
      setActive(true);
      setSetAsDefault(false);
      return;
    }

    const t = selectedTemplate;
    setTitle(t.title);
    setCategory(t.category);
    setBody(t.body);
    setActive(t.active);
    setSetAsDefault(t.id === defaultRepairId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedTemplate identity churns; use selectedTemplateRev
  }, [selectedTemplateId, selectedTemplateRev, defaultRepairId]);

  const beginCreate = () => setSelectedTemplateId(null);

  const persistForm = () => {
    setErr(null);
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) {
      setErr("Template title is required.");
      return;
    }
    if (!trimmedBody) {
      setErr("Template body/content is required.");
      return;
    }

    const orgId = storeId; // No separate org module yet; keep types future-proof.

    if (!selectedTemplate) {
      const created = createTemplate({
        storeId,
        organizationId: orgId,
        title: trimmedTitle,
        category,
        body: trimmedBody,
        active,
      });
      if (!created.ok) {
        setErr(created.error);
        return;
      }

      if (setAsDefault) {
        const def = setDefaultRepairWaiverTemplateId(created.id);
        if (!def.ok) {
          setErr(def.error);
          return;
        }
      }
      return;
    }

    // Editing: if the template is currently the default and user deactivates it, clear default first.
    if (selectedTemplate.id === defaultRepairId && !active) {
      const cleared = setDefaultRepairWaiverTemplateId(null);
      if (!cleared.ok) {
        setErr(cleared.error);
        return;
      }
    }

    const updated = updateTemplate(selectedTemplate.id, {
      title: trimmedTitle,
      category,
      body: trimmedBody,
      active,
    });
    if (!updated.ok) {
      setErr(updated.error);
      return;
    }

    if (setAsDefault) {
      const def = setDefaultRepairWaiverTemplateId(selectedTemplate.id);
      if (!def.ok) {
        setErr(def.error);
        return;
      }
    } else if (selectedTemplate.id === defaultRepairId) {
      const cleared = setDefaultRepairWaiverTemplateId(null);
      if (!cleared.ok) {
        setErr(cleared.error);
        return;
      }
    }
  };

  const field =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-50">
            Documents / Policies / Waivers
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Create store waiver templates used during repair intake.
          </p>
        </div>
        <button
          type="button"
          onClick={beginCreate}
          className="touch-pad min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 text-sm font-semibold text-emerald-200"
        >
          + New
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Templates ({templates.length})
          </h3>
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No templates for this store yet.
            </p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {templates.map((t) => {
                const isDefault = t.id === defaultRepairId;
                return (
                  <li
                    key={t.id}
                    className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {t.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {categoryLabel(t.category)} · v{t.version} ·{" "}
                          {t.organizationId}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-600">
                          Updated{" "}
                          {new Date(t.updatedAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isDefault ? (
                          <span className="inline-flex rounded-md bg-emerald-500/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-emerald-200/90">
                            Default
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${
                              t.active
                                ? "bg-emerald-500/15 text-emerald-200/90"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {t.active ? "Active" : "Inactive"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={t.active}
                          onChange={(e) => {
                            // If deactivating the default repair waiver, clear it first.
                            if (!e.target.checked && t.id === defaultRepairId) {
                              void setDefaultRepairWaiverTemplateId(null);
                            }
                            void setTemplateActive(t.id, e.target.checked);
                          }}
                          className="h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600 focus:ring-emerald-500/30"
                        />
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          Active
                        </span>
                      </label>

                      {t.category === "repair" ? (
                        <button
                          type="button"
                          onClick={() => {
                            void setDefaultRepairWaiverTemplateId(
                              t.active ? t.id : null,
                            );
                            setSelectedTemplateId(t.id);
                          }}
                          className={`touch-pad rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                            t.active && isDefault
                              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200/90"
                              : t.active
                                ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                                : "border-zinc-700 bg-zinc-900/40 text-zinc-500"
                          }`}
                          disabled={!t.active}
                        >
                          {isDefault ? "Default" : "Set default"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setSelectedTemplateId(t.id)}
                        className="touch-pad rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300"
                      >
                        Edit
                      </button>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        View body
                      </summary>
                      <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 text-[0.78rem] text-zinc-300">
                        {t.body}
                      </pre>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {selectedTemplate ? "Edit template" : "Create template"}
          </h3>

          {err ? (
            <p className="text-sm text-rose-400" role="alert">
              {err}
            </p>
          ) : null}

          <label className="block text-sm">
            <span className="text-zinc-500">Title *</span>
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Liability waiver (repair)"
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-500">Category *</span>
            <select
              className={`${field} font-semibold`}
              value={category}
              onChange={(e) => setCategory(e.target.value as WaiverTemplateCategory)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-500">Body/content *</span>
            <textarea
              className={`${field} min-h-[10rem] resize-y py-3 font-serif`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Full legal waiver text shown during customer acceptance"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600 focus:ring-emerald-500/30"
              />
              <span className="text-sm text-zinc-300">Active</span>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 ${
                category !== "repair" ? "opacity-40" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                disabled={category !== "repair"}
                className="h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600 focus:ring-emerald-500/30"
              />
              <span className="text-sm text-zinc-300">
                Set as default repair waiver
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={persistForm}
            className="touch-pad w-full min-h-12 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white"
          >
            {selectedTemplate ? "Save changes" : "Create template"}
          </button>
        </section>
      </div>
    </div>
  );
}

