import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { seedEmployees } from "@/data/seed-employees";
import { migrateEmployee } from "@/lib/employee-migrate";
import type { Employee, EmployeeRole } from "@/types/employee";

export type SaveEmployeeInput = {
  name: string;
  role: EmployeeRole;
  pin: string;
  active: boolean;
};

export type EmployeesStoreState = {
  employees: Employee[];
};

export type EmployeesStoreActions = {
  createEmployee: (input: SaveEmployeeInput) => { ok: true; id: string } | { ok: false; error: string };
  updateEmployee: (
    id: string,
    input: SaveEmployeeInput,
  ) => { ok: true } | { ok: false; error: string };
  getById: (id: string) => Employee | undefined;
};

export type EmployeesStore = EmployeesStoreState & EmployeesStoreActions;

function newEmployeeId(): string {
  return `emp-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function normalizePin(pin: string): string {
  return pin.trim();
}

function validatePinFormat(pin: string): string | null {
  const p = normalizePin(pin);
  if (p.length < 4 || p.length > 8 || !/^\d+$/.test(p)) {
    return "PIN must be 4–8 digits.";
  }
  return null;
}

export const useEmployeesStore = create<EmployeesStore>()(
  persist(
    (set, get) => ({
      employees: seedEmployees.map((e) => ({ ...e })),

      getById: (id) => get().employees.find((e) => e.id === id),

      createEmployee: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Name is required." };
        const pinErr = validatePinFormat(input.pin);
        if (pinErr) return { ok: false, error: pinErr };
        const pin = normalizePin(input.pin);
        if (get().employees.some((e) => e.pin === pin)) {
          return { ok: false, error: "That PIN is already in use." };
        }
        const id = newEmployeeId();
        const emp: Employee = {
          id,
          name,
          role: input.role,
          pin,
          active: input.active,
        };
        set((s) => ({ employees: [emp, ...s.employees] }));
        return { ok: true, id };
      },

      updateEmployee: (id, input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Name is required." };
        let pin = "";
        if (normalizePin(input.pin).length > 0) {
          const pinErr = validatePinFormat(input.pin);
          if (pinErr) return { ok: false, error: pinErr };
          pin = normalizePin(input.pin);
          if (
            get().employees.some((e) => e.id !== id && e.pin === pin)
          ) {
            return { ok: false, error: "That PIN is already in use." };
          }
        }
        set((s) => ({
          employees: s.employees.map((e) => {
            if (e.id !== id) return e;
            return {
              ...e,
              name,
              role: input.role,
              active: input.active,
              pin: pin.length > 0 ? pin : e.pin,
            };
          }),
        }));
        return { ok: true };
      },
    }),
    {
      name: "fixlytiq-employees",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ employees: state.employees }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<EmployeesStoreState> | undefined;
        const raw = p?.employees;
        let employees = Array.isArray(raw)
          ? raw
              .map((row) => migrateEmployee(row))
              .filter((e): e is Employee => e !== null)
          : current.employees;
        if (employees.length === 0) {
          employees = seedEmployees.map((e) => ({ ...e }));
        }
        return { ...current, employees };
      },
    },
  ),
);
