"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  canAccessPathname,
  defaultHomeRoute,
} from "@/lib/rbac";
import { useEmployeesStore } from "@/stores/employees-store";
import { useSessionStore } from "@/stores/session-store";

/**
 * Enforces RBAC for shell routes and boots session if employee was deactivated.
 */
export function RouteAccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const employee = useSessionStore((s) => s.employee);
  const roster = useEmployeesStore((s) => s.employees);
  const logout = useSessionStore((s) => s.logout);

  useEffect(() => {
    if (!employee) return;
    const row = roster.find((e) => e.id === employee.id);
    if (!row?.active) {
      logout();
      router.replace("/login");
      return;
    }
    if (!canAccessPathname(employee.role, pathname)) {
      router.replace(defaultHomeRoute(employee.role));
    }
  }, [employee, logout, pathname, roster, router]);

  return <>{children}</>;
}
