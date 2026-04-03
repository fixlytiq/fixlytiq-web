"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSessionStore } from "@/stores/session-store";
import { useShiftsStore } from "@/stores/shifts-store";
import type { WorkShift } from "@/types/operations";

export function ShiftsWorkspace() {
  const employee = useSessionStore((s) => s.employee);
  const shifts = useShiftsStore((s) => s.shifts);
  const clockIn = useShiftsStore((s) => s.clockIn);
  const clockOut = useShiftsStore((s) => s.clockOut);
  const getOpenShift = useShiftsStore((s) => s.getOpenShift);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const open = employee ? getOpenShift(employee.id) : undefined;

  const history = useMemo(
    () =>
      [...shifts].sort(
        (a, b) =>
          new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime(),
      ),
    [shifts],
  );

  if (!employee) return null;

  const doIn = () => {
    setErr(null);
    setMsg(null);
    const r = clockIn(employee.id, employee.name);
    if (!r.ok) setErr(r.error);
    else setMsg("Clocked in.");
  };

  const doOut = () => {
    setErr(null);
    setMsg(null);
    const r = clockOut(employee.id);
    if (!r.ok) setErr(r.error);
    else setMsg("Clocked out.");
  };

  return (
    <div className="space-y-4">
      <PageHeader variant="device" title="Shifts" />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Current session
        </p>
        <p className="mt-1 text-lg font-medium text-zinc-100">{employee.name}</p>
        {open ? (
          <p className="mt-2 font-mono text-sm text-emerald-400/90">
            On shift since{" "}
            {new Date(open.clockInAt).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No open shift.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={doIn}
            disabled={Boolean(open)}
            className="touch-pad min-h-11 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clock in
          </button>
          <button
            type="button"
            onClick={doOut}
            disabled={!open}
            className="touch-pad min-h-11 rounded-xl border border-zinc-600 px-6 text-sm font-semibold text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clock out
          </button>
        </div>
        {msg ? (
          <p className="mt-3 text-sm text-emerald-400/90" role="status">
            {msg}
          </p>
        ) : null}
        {err ? (
          <p className="mt-3 text-sm text-rose-400" role="alert">
            {err}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <div className="border-b border-zinc-800 bg-zinc-950/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Shift history
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">In</th>
                <th className="px-4 py-3">Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/90">
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No shifts recorded yet.
                  </td>
                </tr>
              ) : (
                history.slice(0, 80).map((s) => (
                  <ShiftRow key={s.id} shift={s} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ShiftRow({ shift }: { shift: WorkShift }) {
  return (
    <tr className="bg-zinc-900/20">
      <td className="px-4 py-3 text-zinc-200">{shift.employeeName}</td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
        {new Date(shift.clockInAt).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
        {shift.clockOutAt
          ? new Date(shift.clockOutAt).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—"}
      </td>
    </tr>
  );
}
