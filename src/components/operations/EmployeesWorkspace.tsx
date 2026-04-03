"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatEmployeeRole } from "@/lib/format-role";
import { roleCanManageEmployees } from "@/lib/rbac";
import {
  useEmployeesStore,
  type SaveEmployeeInput,
} from "@/stores/employees-store";
import { useSessionStore } from "@/stores/session-store";
import {
  type Employee,
  type EmployeeRole,
} from "@/types/employee";

const ROLES: readonly EmployeeRole[] = [
  "owner",
  "manager",
  "technician",
  "cashier",
] as const;

export function EmployeesWorkspace() {
  const employee = useSessionStore((s) => s.employee);
  const employees = useEmployeesStore((s) => s.employees);
  const createEmployee = useEmployeesStore((s) => s.createEmployee);
  const updateEmployee = useEmployeesStore((s) => s.updateEmployee);

  const [modal, setModal] = useState<Employee | "new" | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const canManage = employee && roleCanManageEmployees(employee.role);

  const sorted = useMemo(
    () =>
      [...employees].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [employees],
  );

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-500">
        You don&apos;t have access to employee management.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        variant="device"
        title="Team"
        actions={
          <button
            type="button"
            onClick={() => {
              setFormErr(null);
              setModal("new");
            }}
            className="touch-pad rounded-xl bg-emerald-600 px-5 text-base font-semibold text-white active:bg-emerald-500"
          >
            + Employee
          </button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/90">
              {sorted.map((e) => (
                <tr key={e.id} className="bg-zinc-900/20">
                  <td className="px-4 py-3 font-medium text-zinc-200">
                    {e.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {formatEmployeeRole(e.role)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        e.active
                          ? "text-emerald-400/90"
                          : "text-zinc-500 line-through"
                      }
                    >
                      {e.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setFormErr(null);
                        setModal(e);
                      }}
                      className="touch-pad rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 active:bg-zinc-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal ? (
        <EmployeeFormModal
          mode={modal === "new" ? "create" : "edit"}
          initial={modal === "new" ? null : modal}
          error={formErr}
          onDismiss={() => setModal(null)}
          onSave={(input) => {
            if (modal === "new") {
              if (!input.pin.trim()) {
                setFormErr("PIN is required for new employees.");
                return;
              }
              const r = createEmployee(input);
              if (!r.ok) {
                setFormErr(r.error);
                return;
              }
            } else {
              const r = updateEmployee(modal.id, input);
              if (!r.ok) {
                setFormErr(r.error);
                return;
              }
            }
            setModal(null);
            setFormErr(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EmployeeFormModal({
  mode,
  initial,
  error,
  onDismiss,
  onSave,
}: {
  mode: "create" | "edit";
  initial: Employee | null;
  error: string | null;
  onDismiss: () => void;
  onSave: (input: SaveEmployeeInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<EmployeeRole>(initial?.role ?? "cashier");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(initial?.active ?? true);

  const fieldClass =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onDismiss}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-zinc-50">
          {mode === "create" ? "New employee" : "Edit employee"}
        </h2>
        {error ? (
          <p className="mt-2 text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
        <label className="mt-4 block text-sm">
          <span className="text-zinc-500">Name</span>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-zinc-500">Role</span>
          <select
            className={fieldClass}
            value={role}
            onChange={(e) => setRole(e.target.value as EmployeeRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {formatEmployeeRole(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-zinc-500">
            PIN (4–8 digits){mode === "edit" ? " — leave blank to keep" : ""}
          </span>
          <input
            className={`${fieldClass} font-mono`}
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder={mode === "edit" ? "••••••••" : ""}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-600"
          />
          Active (can sign in)
        </label>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="touch-pad min-h-11 rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                name,
                role,
                pin,
                active,
              })
            }
            className="touch-pad min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
