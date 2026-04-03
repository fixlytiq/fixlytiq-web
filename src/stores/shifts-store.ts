import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WorkShift } from "@/types/operations";

const MAX_SHIFTS = 500;

export type ClockResult = { ok: true } | { ok: false; error: string };

export type ShiftsStoreState = {
  shifts: WorkShift[];
};

export type ShiftsStoreActions = {
  clockIn: (employeeId: string, employeeName: string) => ClockResult;
  clockOut: (employeeId: string) => ClockResult;
  /** Open shift for employee, if any */
  getOpenShift: (employeeId: string) => WorkShift | undefined;
};

export type ShiftsStore = ShiftsStoreState & ShiftsStoreActions;

function trimShifts(list: WorkShift[]): WorkShift[] {
  if (list.length <= MAX_SHIFTS) return list;
  return [...list]
    .sort(
      (a, b) =>
        new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime(),
    )
    .slice(0, MAX_SHIFTS);
}

export const useShiftsStore = create<ShiftsStore>()(
  persist(
    (set, get) => ({
      shifts: [],

      getOpenShift: (employeeId) =>
        get().shifts.find(
          (s) => s.employeeId === employeeId && s.clockOutAt === null,
        ),

      clockIn: (employeeId, employeeName) => {
        if (get().getOpenShift(employeeId)) {
          return { ok: false, error: "Already clocked in." };
        }
        const shift: WorkShift = {
          id: crypto.randomUUID(),
          employeeId,
          employeeName: employeeName.trim() || "User",
          clockInAt: new Date().toISOString(),
          clockOutAt: null,
        };
        set((s) => ({ shifts: trimShifts([shift, ...s.shifts]) }));
        return { ok: true };
      },

      clockOut: (employeeId) => {
        const open = get().getOpenShift(employeeId);
        if (!open) {
          return { ok: false, error: "No open shift to end." };
        }
        const out = new Date().toISOString();
        set((s) => ({
          shifts: s.shifts.map((sh) =>
            sh.id === open.id ? { ...sh, clockOutAt: out } : sh,
          ),
        }));
        return { ok: true };
      },
    }),
    {
      name: "fixlytiq-shifts",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ shifts: state.shifts }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<ShiftsStoreState> | undefined;
        const raw = p?.shifts;
        const shifts = Array.isArray(raw) ? raw : current.shifts;
        return { ...current, shifts };
      },
    },
  ),
);
