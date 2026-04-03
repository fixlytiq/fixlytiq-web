"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLocalStoresHydrated } from "@/hooks/useLocalStoresHydrated";
import { useSessionStore } from "@/stores/session-store";

/**
 * Rehydrates local stores, then requires a logged-in employee for shell routes.
 */
export function ShellProviders({ children }: { children: React.ReactNode }) {
  const ready = useLocalStoresHydrated();
  const employee = useSessionStore((s) => s.employee);
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!employee) router.replace("/login");
  }, [ready, employee, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[50dvh] flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  return <>{children}</>;
}
