import type { EmployeeRole } from "@/types/employee";

export function formatEmployeeRole(role: EmployeeRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "manager":
      return "Manager";
    case "technician":
      return "Technician";
    case "cashier":
      return "Cashier";
    default:
      return role;
  }
}
