import type { Employee, EmployeeRole } from "@/types/employee";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const ROLES: readonly EmployeeRole[] = [
  "owner",
  "manager",
  "technician",
  "cashier",
] as const;

function parseRole(raw: unknown): EmployeeRole {
  if (raw === "tech") return "technician";
  if (ROLES.includes(raw as EmployeeRole)) return raw as EmployeeRole;
  return "cashier";
}

/** Normalize employees loaded from persisted JSON (legacy `tech` role, missing `active`). */
export function migrateEmployee(raw: unknown): Employee | null {
  if (!isRecord(raw)) return null;
  const o = raw;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const pin = typeof o.pin === "string" ? o.pin : "";
  const name = typeof o.name === "string" ? o.name.trim() : "User";
  const role = parseRole(o.role);
  const active = typeof o.active === "boolean" ? o.active : true;
  return { id, name, role, pin, active };
}
