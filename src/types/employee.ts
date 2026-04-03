export type EmployeeRole = "owner" | "manager" | "technician" | "cashier";

/** Full employee record (includes PIN — mock auth only, never send to API as-is) */
export type Employee = {
  id: string;
  name: string;
  role: EmployeeRole;
  /** Mock: plain digit PIN for local validation (typically 8 digits) */
  pin: string;
  active: boolean;
};

/** Stored in session + persisted — no PIN */
export type EmployeeSession = {
  id: string;
  name: string;
  role: EmployeeRole;
};
