import { canIssueRefund } from "@/lib/rbac";
import { useEmployeesStore } from "@/stores/employees-store";
import type { Employee, EmployeeSession } from "@/types/employee";
import type {
  ManagerPinRefundOverride,
  RefundAuthorizationKind,
} from "@/types/refunds";

export type VerifyManagerPinResult =
  | { ok: true; approver: Employee }
  | { ok: false; error: string };

/**
 * Validates a manager/owner PIN for refund override (local mock employees).
 * Does not persist the PIN. Call again at `createRefund` — never trust UI-only state.
 */
export function verifyManagerApprovalPinForRefund(args: {
  pinRaw: string;
  sessionEmployee: EmployeeSession;
}): VerifyManagerPinResult {
  const pin = args.pinRaw.trim();
  if (!pin) {
    return { ok: false, error: "Enter a manager or owner PIN." };
  }

  const approver =
    useEmployeesStore
      .getState()
      .employees.find((e) => e.active && e.pin === pin) ?? null;

  if (!approver) {
    return { ok: false, error: "PIN not recognized or inactive." };
  }

  if (!canIssueRefund(approver.role)) {
    return {
      ok: false,
      error: "That PIN is not authorized to approve refunds.",
    };
  }

  if (approver.id === args.sessionEmployee.id) {
    return {
      ok: false,
      error: "Use a different manager or owner PIN to approve this refund.",
    };
  }

  return { ok: true, approver };
}

/** Build persisted audit payload after PIN has been verified in the store. */
export function buildManagerPinRefundOverride(args: {
  approver: Employee;
  sessionEmployee: EmployeeSession;
  verifiedAt: string;
}): ManagerPinRefundOverride {
  return {
    managerEmployeeId: args.approver.id,
    managerName: args.approver.name,
    managerRole: args.approver.role,
    verifiedAt: args.verifiedAt,
    approvalMethod: "pin",
    initiatedByEmployeeId: args.sessionEmployee.id,
    initiatedByName: args.sessionEmployee.name,
    approvedBySessionEmployeeId: args.sessionEmployee.id,
  };
}

/** Human-readable order history note (no PIN). */
export function refundOrderHistoryAuditNote(
  authorizationKind: RefundAuthorizationKind,
  managerPinApproval: ManagerPinRefundOverride | null,
): string | null {
  if (authorizationKind !== "manager_pin" || !managerPinApproval) return null;
  return `Refund PIN-approved by ${managerPinApproval.managerName} (${managerPinApproval.managerRole}).`;
}
