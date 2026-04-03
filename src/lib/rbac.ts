import type { EmployeeRole, EmployeeSession } from "@/types/employee";

/**
 * Route access matrix (local-first shell).
 * - cashier: POS only (+ shifts for time clock)
 * - technician: repairs + shifts
 * - manager: operational modules, employees, settings
 * - owner: full
 */
const PATH_RULES: {
  prefix: string;
  roles: readonly EmployeeRole[];
}[] = [
  { prefix: "/pos", roles: ["owner", "manager", "cashier"] },
  { prefix: "/dashboard", roles: ["owner", "manager"] },
  { prefix: "/repairs", roles: ["owner", "manager", "technician"] },
  {
    prefix: "/transactions",
    roles: ["owner", "manager", "cashier"],
  },
  {
    prefix: "/orders",
    roles: ["owner", "manager", "cashier"],
  },
  {
    prefix: "/customers",
    roles: ["owner", "manager", "cashier"],
  },
  { prefix: "/inventory", roles: ["owner", "manager"] },
  { prefix: "/employees", roles: ["owner", "manager"] },
  { prefix: "/settings", roles: ["owner", "manager"] },
  { prefix: "/shifts", roles: ["owner", "manager", "technician", "cashier"] },
];

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const i = pathname.indexOf("?", 0);
  const base = i === -1 ? pathname : pathname.slice(0, i);
  return base.endsWith("/") && base.length > 1 ? base.slice(0, -1) : base;
}

export function canAccessPathname(
  role: EmployeeRole,
  pathname: string,
): boolean {
  const path = normalizePath(pathname);
  const rule = PATH_RULES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
  if (!rule) return true;
  return rule.roles.includes(role);
}

export function defaultHomeRoute(role: EmployeeRole): string {
  switch (role) {
    case "cashier":
      return "/pos";
    case "technician":
      return "/repairs";
    case "manager":
    case "owner":
      return "/dashboard";
  }
}

export function roleCanManageEmployees(role: EmployeeRole): boolean {
  return role === "owner" || role === "manager";
}

export function roleCanEditStoreSettings(role: EmployeeRole): boolean {
  return role === "owner" || role === "manager";
}

/** Repair ticket waiver checklist (intake corrections) — same roles as /repairs. */
export function roleCanEditRepairLiabilityWaiver(role: EmployeeRole): boolean {
  return role === "owner" || role === "manager" || role === "technician";
}

/** Shown when cashier/technician (or unsigned session) cannot issue refunds. */
export const REFUND_MANAGER_APPROVAL_REQUIRED_MESSAGE =
  "Manager approval required" as const;

/** POS refunds — owner and manager only (local-first; enforced in refunds store). */
export function canIssueRefund(role: EmployeeRole): boolean {
  return role === "owner" || role === "manager";
}

/**
 * When non-null, the refund entry control should stay disabled (no signed-in employee).
 * Cashier/technician may open the refund flow; manager PIN is collected in the modal.
 */
export function refundSignInBlockedMessage(
  employee: EmployeeSession | null,
): string | null {
  if (!employee) return "Sign in to issue refunds.";
  return null;
}

/** Shown near the refund button when a PIN will be required in the dialog. */
export function refundManagerPinHint(
  employee: EmployeeSession | null,
): string | null {
  if (!employee) return null;
  if (!canIssueRefund(employee.role)) {
    return "Manager or owner PIN is required in the refund dialog.";
  }
  return null;
}

/**
 * @deprecated Prefer `refundSignInBlockedMessage` + `refundManagerPinHint` for entry points.
 * Full-block message (sign-in or role) — still used where a single string is needed.
 */
export function refundAuthorizationBlockedMessage(
  employee: EmployeeSession | null,
): string | null {
  const signIn = refundSignInBlockedMessage(employee);
  if (signIn) return signIn;
  if (!employee) return null;
  if (!canIssueRefund(employee.role)) {
    return REFUND_MANAGER_APPROVAL_REQUIRED_MESSAGE;
  }
  return null;
}
