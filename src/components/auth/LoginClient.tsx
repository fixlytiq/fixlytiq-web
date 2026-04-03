"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLocalStoresHydrated } from "@/hooks/useLocalStoresHydrated";
import { defaultHomeRoute } from "@/lib/rbac";
import { useSessionStore } from "@/stores/session-store";
import { PinLoginForm } from "@/components/auth/PinLoginForm";

export function LoginClient() {
  const ready = useLocalStoresHydrated();
  const employee = useSessionStore((s) => s.employee);
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (employee) router.replace("/pos");
  }, [ready, employee, router]);

  if (!ready) {
    return (
      <div className="text-sm text-zinc-500">Loading…</div>
    );
  }

  if (employee) {
    return null;
  }

  return (
    <>
      <Link
        href="/"
        className="mb-6 min-h-11 text-sm text-zinc-500 active:text-zinc-300"
      >
        ← Station
      </Link>
      <PinLoginForm />
      <p className="mt-6 max-w-md text-center text-xs text-zinc-600">
        Demo PINs (4–8 digits): owner 99999999 · manager 42424242 · tech
        55667788 · cashiers 10000000 / 20262026
      </p>
    </>
  );
}
