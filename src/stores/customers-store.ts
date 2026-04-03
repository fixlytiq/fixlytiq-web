import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { seedCustomers } from "@/data/seed-customers";
import { buildCustomerFullName } from "@/lib/customer-helpers";
import type { PaymentProcessorSnapshot } from "@/types/payment";
import type {
  Customer,
  CustomerNote,
  CustomerTag,
} from "@/types/customers";

const STORAGE_KEY = "fixlytiq-customers";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function migrateProcessor(raw: unknown): PaymentProcessorSnapshot | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.employeeId !== "string" || typeof raw.name !== "string") {
    return null;
  }
  return { employeeId: raw.employeeId, name: raw.name };
}

function migrateTag(raw: unknown): CustomerTag | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.label !== "string") return null;
  return { id: raw.id, label: raw.label.trim() };
}

function migrateCustomerNote(raw: unknown): CustomerNote | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.customerId !== "string" ||
    typeof raw.body !== "string" ||
    typeof raw.createdAt !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    customerId: raw.customerId,
    body: raw.body,
    createdAt: raw.createdAt,
    createdBy: migrateProcessor(raw.createdBy),
  };
}

function migrateCustomer(raw: unknown): Customer | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const firstName = String(raw.firstName ?? "").trim();
  const lastName = String(raw.lastName ?? "").trim();
  const legacyName = String(raw.fullName ?? "").trim();
  const fullName =
    legacyName ||
    buildCustomerFullName(
      firstName || legacyName.split(" ")[0] || "",
      lastName || legacyName.split(" ").slice(1).join(" ") || "",
    );
  const phone = String(raw.phone ?? "");
  const email = String(raw.email ?? "");
  const company =
    raw.company === null || raw.company === undefined
      ? null
      : String(raw.company).trim() || null;
  let address: Customer["address"] = null;
  const a = raw.address;
  if (isRecord(a) && typeof a.line1 === "string" && typeof a.city === "string") {
    address = {
      line1: a.line1,
      line2:
        a.line2 === null || a.line2 === undefined
          ? null
          : String(a.line2),
      city: a.city,
      region:
        a.region === null || a.region === undefined
          ? null
          : String(a.region),
      postalCode:
        a.postalCode === null || a.postalCode === undefined
          ? null
          : String(a.postalCode),
      country:
        a.country === null || a.country === undefined
          ? null
          : String(a.country),
    };
  }
  const notes = String(raw.notes ?? "");
  const notesArr = Array.isArray(raw.customerNotes)
    ? raw.customerNotes
        .map(migrateCustomerNote)
        .filter((n): n is CustomerNote => n !== null)
    : [];
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(migrateTag).filter((t): t is CustomerTag => t !== null)
    : [];
  const contactMethods = Array.isArray(raw.contactMethods)
    ? raw.contactMethods.filter(() => false)
    : [];
  const marketingOptIn = raw.marketingOptIn === true;
  const createdAt =
    typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const updatedAt =
    typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt;
  const createdBy = migrateProcessor(raw.createdBy);
  const active = raw.active !== false;

  return {
    id,
    firstName: firstName || fullName.split(" ")[0] || "",
    lastName:
      lastName ||
      fullName.split(" ").slice(1).join(" ") ||
      "",
    fullName,
    phone,
    email,
    company,
    address,
    notes,
    customerNotes: notesArr,
    tags,
    contactMethods,
    marketingOptIn,
    createdAt,
    updatedAt,
    createdBy,
    active,
  };
}

export type CreateCustomerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company?: string | null;
  address?: Customer["address"];
  notes?: string;
  tags?: CustomerTag[];
  marketingOptIn?: boolean;
  createdBy: PaymentProcessorSnapshot | null;
};

export type UpdateCustomerInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string | null;
  address?: Customer["address"] | null;
  notes?: string;
  tags?: CustomerTag[];
  marketingOptIn?: boolean;
};

export type CustomersStoreState = {
  customers: Customer[];
};

export type CustomersStoreActions = {
  createCustomer: (
    input: CreateCustomerInput,
  ) => { ok: true; customerId: string } | { ok: false; error: string };
  updateCustomer: (
    customerId: string,
    input: UpdateCustomerInput,
  ) => { ok: true } | { ok: false; error: string };
  archiveCustomer: (customerId: string) => { ok: true } | { ok: false; error: string };
  restoreCustomer: (customerId: string) => { ok: true } | { ok: false; error: string };
  addCustomerNote: (
    customerId: string,
    body: string,
    author: PaymentProcessorSnapshot | null,
  ) => { ok: true } | { ok: false; error: string };
  getCustomerById: (id: string) => Customer | null;
};

export type CustomersStore = CustomersStoreState & CustomersStoreActions;

export const useCustomersStore = create<CustomersStore>()(
  persist(
    (set, get) => ({
      customers: seedCustomers.map((c) => ({ ...c })),

      getCustomerById: (id) =>
        get().customers.find((c) => c.id === id) ?? null,

      createCustomer: (input) => {
        const firstName = input.firstName.trim();
        const lastName = input.lastName.trim();
        if (!firstName && !lastName) {
          return { ok: false, error: "First or last name is required." };
        }
        const now = new Date().toISOString();
        const fullName = buildCustomerFullName(firstName, lastName);
        const c: Customer = {
          id: crypto.randomUUID(),
          firstName: firstName || fullName,
          lastName: lastName || "",
          fullName,
          phone: input.phone.trim(),
          email: input.email.trim(),
          company: input.company?.trim() ? input.company.trim() : null,
          address: input.address ?? null,
          notes: input.notes?.trim() ?? "",
          customerNotes: [],
          tags: input.tags ?? [],
          contactMethods: [],
          marketingOptIn: input.marketingOptIn === true,
          createdAt: now,
          updatedAt: now,
          createdBy: input.createdBy,
          active: true,
        };
        set((s) => ({ customers: [c, ...s.customers] }));
        return { ok: true, customerId: c.id };
      },

      updateCustomer: (customerId, input) => {
        const cur = get().customers.find((c) => c.id === customerId);
        if (!cur) return { ok: false, error: "Customer not found." };
        const firstName =
          input.firstName !== undefined ? input.firstName.trim() : cur.firstName;
        const lastName =
          input.lastName !== undefined ? input.lastName.trim() : cur.lastName;
        const fullName = buildCustomerFullName(firstName, lastName);
        const next: Customer = {
          ...cur,
          firstName,
          lastName,
          fullName,
          phone: input.phone !== undefined ? input.phone.trim() : cur.phone,
          email: input.email !== undefined ? input.email.trim() : cur.email,
          company:
            input.company !== undefined
              ? input.company?.trim()
                ? input.company.trim()
                : null
              : cur.company,
          address:
            input.address !== undefined ? input.address : cur.address,
          notes: input.notes !== undefined ? input.notes.trim() : cur.notes,
          tags: input.tags !== undefined ? input.tags : cur.tags,
          marketingOptIn:
            input.marketingOptIn !== undefined
              ? input.marketingOptIn
              : cur.marketingOptIn,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          customers: s.customers.map((c) => (c.id === customerId ? next : c)),
        }));
        return { ok: true };
      },

      archiveCustomer: (customerId) => {
        const cur = get().customers.find((c) => c.id === customerId);
        if (!cur) return { ok: false, error: "Customer not found." };
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === customerId
              ? { ...c, active: false, updatedAt: new Date().toISOString() }
              : c,
          ),
        }));
        return { ok: true };
      },

      restoreCustomer: (customerId) => {
        const cur = get().customers.find((c) => c.id === customerId);
        if (!cur) return { ok: false, error: "Customer not found." };
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === customerId
              ? { ...c, active: true, updatedAt: new Date().toISOString() }
              : c,
          ),
        }));
        return { ok: true };
      },

      addCustomerNote: (customerId, body, author) => {
        const trimmed = body.trim();
        if (!trimmed) return { ok: false, error: "Note is empty." };
        const cur = get().customers.find((c) => c.id === customerId);
        if (!cur) return { ok: false, error: "Customer not found." };
        const note: CustomerNote = {
          id: crypto.randomUUID(),
          customerId,
          body: trimmed,
          createdAt: new Date().toISOString(),
          createdBy: author,
        };
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  customerNotes: [note, ...c.customerNotes],
                  updatedAt: new Date().toISOString(),
                }
              : c,
          ),
        }));
        return { ok: true };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ customers: state.customers }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<CustomersStoreState> | undefined;
        const raw = p?.customers;
        const customers = Array.isArray(raw)
          ? raw.map(migrateCustomer).filter((c): c is Customer => c !== null)
          : current.customers;
        return { ...current, customers };
      },
    },
  ),
);
