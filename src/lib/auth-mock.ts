import { useEmployeesStore } from "@/stores/employees-store";
import type { Employee, EmployeeSession } from "@/types/employee";

/**
 * Mock PIN check — returns a public session or null.
 * Replace with API + device agent later.
 */
export function validatePin(pin: string): EmployeeSession | null {
  const normalized = pin.trim();
  const found = useEmployeesStore
    .getState()
    .employees.find((e) => e.active && e.pin === normalized);
  if (!found) return null;
  return toSession(found);
}

export function toSession(employee: Employee): EmployeeSession {
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
  };
}
