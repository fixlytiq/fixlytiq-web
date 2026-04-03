import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EmployeeRole, EmployeeSession } from "@/types/employee";

function migrateSessionRole(raw: unknown): EmployeeRole {
  if (raw === "tech") return "technician";
  if (
    raw === "owner" ||
    raw === "manager" ||
    raw === "technician" ||
    raw === "cashier"
  ) {
    return raw;
  }
  return "cashier";
}

function migrateEmployeeSession(raw: unknown): EmployeeSession | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  return {
    id: o.id,
    name: o.name,
    role: migrateSessionRole(o.role),
  };
}

type SessionState = {
  employee: EmployeeSession | null;
};

type SessionActions = {
  setEmployee: (employee: EmployeeSession | null) => void;
  logout: () => void;
};

export type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      employee: null,

      setEmployee: (employee) => set({ employee }),

      logout: () => set({ employee: null }),
    }),
    {
      name: "fixlytiq-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ employee: state.employee }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<SessionState> | undefined;
        if (!p || typeof p !== "object") return current as SessionStore;
        const employee =
          p.employee === undefined
            ? current.employee
            : migrateEmployeeSession(p.employee);
        return { ...current, employee };
      },
    },
  ),
);
