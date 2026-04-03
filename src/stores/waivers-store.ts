import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  TicketWaiverSnapshot,
  WaiverTemplate,
  WaiverTemplateCategory,
  WaiverTemplateVersion,
} from "@/types/waivers";

const STORAGE_KEY = "fixlytiq-waivers";

const DEFAULT_SEED_STORE_ID = "store-01";
const DEFAULT_SEED_ORGANIZATION_ID = "org-01";
const DEFAULT_REPAIR_WAIVER_TEMPLATE_ID = "wt-repair-default-v1";

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCategory(v: unknown): v is WaiverTemplateCategory {
  return (
    v === "repair" ||
    v === "diagnostics" ||
    v === "water_damage" ||
    v === "data_loss" ||
    v === "storage_policy" ||
    v === "custom"
  );
}

function migrateVersion(v: unknown): WaiverTemplateVersion {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.floor(n);
}

function migrateSnapshot(raw: unknown): TicketWaiverSnapshot | null {
  // Used by future migrations; currently repairs store does not contain snapshots yet.
  if (!isRecord(raw)) return null;
  const r = raw;
  const templateId = typeof r.templateId === "string" ? r.templateId : "";
  const title = typeof r.title === "string" ? r.title : "";
  const acceptedAt = typeof r.acceptedAt === "string" ? r.acceptedAt : "";
  if (!templateId || !title || !acceptedAt) return null;
  if (!isCategory(r.category)) return null;
  if (typeof r.body !== "string") return null;

  // SignatureCapture validation lives in repair-workflow; here we just do lightweight shape checks.
  const sig = r.signature;
  const sigOk =
    isRecord(sig) &&
    (sig.mode === "typed" || sig.mode === "drawn") &&
    (typeof sig.dataUrl === "string" || sig.dataUrl === null) &&
    (typeof sig.typedFullName === "string" ||
      sig.typedFullName === null);

  // We will not over-validate signature fields here; snapshot acceptance UX is validated elsewhere.
  if (!sigOk) return null;

  return {
    templateId,
    templateVersion: migrateVersion(r.templateVersion),
    title,
    category: r.category,
    body: r.body,
    acceptedAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signature: sig as any,
  };
}

function migrateTemplate(raw: unknown): WaiverTemplate | null {
  if (!isRecord(raw)) return null;
  const o = raw;

  const id = typeof o.id === "string" ? o.id : "";
  const storeId = typeof o.storeId === "string" ? o.storeId : "";
  const organizationId =
    typeof o.organizationId === "string" ? o.organizationId : "";
  const title = typeof o.title === "string" ? o.title : "";
  const body = typeof o.body === "string" ? o.body : "";
  if (!id || !storeId || !organizationId || !title || !body) return null;
  if (!isCategory(o.category)) return null;

  const version = migrateVersion(o.version);
  const active = o.active === true;

  const createdAt = typeof o.createdAt === "string" ? o.createdAt : nowIso();
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : createdAt;

  return {
    id,
    storeId,
    organizationId,
    title,
    category: o.category,
    body,
    version,
    active,
    createdAt,
    updatedAt,
  };
}

const seedRepairWaiverBody = [
  "Repair may involve hardware handling and diagnostic steps.",
  "",
  "Data loss / backup",
  "Repair may erase or alter stored data. You are responsible for backups.",
  "",
  "Pre-existing damage",
  "Cosmetic or functional issues present before service may not worsen or improve during repair; these are documented on intake.",
  "",
  "Waterproofing",
  "Water resistance cannot be guaranteed after service.",
  "",
  "Parts",
  "OEM, aftermarket, or refurbished parts may be used as quoted.",
  "",
  "Warranty & policy",
  "Customer acknowledges the shop warranty and return policy as explained at intake.",
].join("\n");

export function getSeedRepairWaiverTemplate(): WaiverTemplate {
  const iso = nowIso();
  return {
    id: DEFAULT_REPAIR_WAIVER_TEMPLATE_ID,
    storeId: DEFAULT_SEED_STORE_ID,
    organizationId: DEFAULT_SEED_ORGANIZATION_ID,
    title: "Liability Waiver — Repair",
    category: "repair",
    body: seedRepairWaiverBody,
    version: 1,
    active: true,
    createdAt: iso,
    updatedAt: iso,
  };
}

function seedTemplates(): WaiverTemplate[] {
  const iso = nowIso();
  return [
    {
      id: DEFAULT_REPAIR_WAIVER_TEMPLATE_ID,
      storeId: DEFAULT_SEED_STORE_ID,
      organizationId: DEFAULT_SEED_ORGANIZATION_ID,
      title: "Liability Waiver — Repair",
      category: "repair",
      body: seedRepairWaiverBody,
      version: 1,
      active: true,
      createdAt: iso,
      updatedAt: iso,
    },
  ];
}

export type WaiversStoreState = {
  templates: WaiverTemplate[];
  /** Which template id should default to the repair intake flow. */
  defaultRepairWaiverTemplateId: string | null;
};

export type WaiversStoreActions = {
  createTemplate: (input: {
    storeId: string;
    organizationId: string;
    title: string;
    category: WaiverTemplateCategory;
    body: string;
    active?: boolean;
  }) =>
    | { ok: true; id: string }
    | { ok: false; error: string };
  updateTemplate: (
    templateId: string,
    patch: Partial<Pick<WaiverTemplate, "title" | "category" | "body" | "active">>,
  ) => { ok: true } | { ok: false; error: string };
  setTemplateActive: (
    templateId: string,
    active: boolean,
  ) => { ok: true } | { ok: false; error: string };
  setDefaultRepairWaiverTemplateId: (
    templateId: string | null,
  ) => { ok: true } | { ok: false; error: string };
};

export type WaiversStore = WaiversStoreState & WaiversStoreActions;

export const DEFAULT_REPAIR_WAIVER_TEMPLATE_ID_CONST =
  DEFAULT_REPAIR_WAIVER_TEMPLATE_ID;

export const useWaiversStore = create<WaiversStore>()(
  persist(
    (set, get) => ({
      templates: seedTemplates(),
      defaultRepairWaiverTemplateId: DEFAULT_REPAIR_WAIVER_TEMPLATE_ID,

      createTemplate: (input) => {
        const storeId = input.storeId.trim();
        const organizationId = input.organizationId.trim();
        const title = input.title.trim();
        const body = input.body.trim();
        if (!storeId) return { ok: false, error: "storeId is required." };
        if (!organizationId)
          return { ok: false, error: "organizationId is required." };
        if (!title) return { ok: false, error: "Title is required." };
        if (!body) return { ok: false, error: "Body/content is required." };

        const id = crypto.randomUUID();
        const iso = nowIso();

        const template: WaiverTemplate = {
          id,
          storeId,
          organizationId,
          title,
          category: input.category,
          body,
          version: 1,
          active: input.active ?? false,
          createdAt: iso,
          updatedAt: iso,
        };

        set((s) => ({ templates: [template, ...s.templates] }));
        return { ok: true, id };
      },

      updateTemplate: (templateId, patch) => {
        const existing = get().templates.find((t) => t.id === templateId);
        if (!existing) return { ok: false, error: "Template not found." };

        const nextTitle =
          patch.title === undefined ? existing.title : patch.title.trim();
        const nextBody =
          patch.body === undefined ? existing.body : patch.body.trim();
        const nextCategory =
          patch.category === undefined ? existing.category : patch.category;
        const nextActive = patch.active === undefined ? existing.active : patch.active;

        if (!nextTitle) return { ok: false, error: "Title is required." };
        if (!nextBody) return { ok: false, error: "Body/content is required." };
        if (!isCategory(nextCategory)) return { ok: false, error: "Invalid category." };

        const contentChanged =
          patch.title !== undefined || patch.body !== undefined || patch.category !== undefined;
        const version = contentChanged ? existing.version + 1 : existing.version;

        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId
              ? {
                  ...t,
                  title: nextTitle,
                  body: nextBody,
                  category: nextCategory,
                  active: nextActive,
                  version,
                  updatedAt: nowIso(),
                }
              : t,
          ),
        }));

        return { ok: true };
      },

      setTemplateActive: (templateId, active) => {
        const existing = get().templates.find((t) => t.id === templateId);
        if (!existing) return { ok: false, error: "Template not found." };
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId ? { ...t, active, updatedAt: nowIso() } : t,
          ),
        }));
        return { ok: true };
      },

      setDefaultRepairWaiverTemplateId: (templateId) => {
        if (templateId === null) {
          set({ defaultRepairWaiverTemplateId: null });
          return { ok: true };
        }
        const t = get().templates.find((x) => x.id === templateId);
        if (!t) return { ok: false, error: "Template not found." };
        if (t.category !== "repair")
          return {
            ok: false,
            error: "Default repair waiver must be a repair template.",
          };
        if (!t.active)
          return { ok: false, error: "Default repair waiver must be active." };

        set({ defaultRepairWaiverTemplateId: templateId });
        return { ok: true };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        templates: state.templates,
        defaultRepairWaiverTemplateId: state.defaultRepairWaiverTemplateId,
      }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<WaiversStoreState> | undefined;
        const nextTemplatesRaw = Array.isArray(p?.templates)
          ? p?.templates
          : current.templates;
        const templates = nextTemplatesRaw
          .map((t) => migrateTemplate(t))
          .filter((t): t is WaiverTemplate => t !== null);

        const candidateDefault =
          typeof p?.defaultRepairWaiverTemplateId === "string"
            ? p?.defaultRepairWaiverTemplateId
            : current.defaultRepairWaiverTemplateId;

        const defaultRepairWaiverTemplateId =
          candidateDefault && templates.some((t) => t.id === candidateDefault)
            ? candidateDefault
            : templates.find((t) => t.category === "repair" && t.active)?.id ??
              null;

        return {
          ...current,
          ...(p && typeof p === "object" ? p : {}),
          templates,
          defaultRepairWaiverTemplateId,
        };
      },
    },
  ),
);

export function templateMatchesStore(
  template: WaiverTemplate,
  storeId: string,
): boolean {
  return template.storeId === storeId;
}

