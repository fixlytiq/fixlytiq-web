"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { validatePin } from "@/lib/auth-mock";
import { defaultHomeRoute } from "@/lib/rbac";
import { useSessionStore } from "@/stores/session-store";

const MIN_PIN = 4;
const MAX_PIN = 8;

export function PinLoginForm() {
  const router = useRouter();
  const setEmployee = useSessionStore((s) => s.setEmployee);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const append = useCallback((d: string) => {
    setPin((p) => (p.length >= MAX_PIN ? p : p + d));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setPin("");
    setError(null);
  }, []);

  const backspace = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError(null);
  }, []);

  const submit = useCallback(() => {
    if (pin.length < MIN_PIN || pin.length > MAX_PIN) return;
    const session = validatePin(pin);
    if (!session) {
      setError("Invalid PIN");
      return;
    }
    setError(null);
    setEmployee(session);
    router.push(defaultHomeRoute(session.role));
  }, [pin, router, setEmployee]);

  return (
    <div className="w-full max-w-lg">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-50">
          PIN
        </h2>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Enter {MIN_PIN}–{MAX_PIN} digits
        </p>

        {error ? (
          <p className="mt-3 text-center text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className="mt-8 flex justify-center gap-2.5"
          role="status"
          aria-live="polite"
          aria-label="PIN length"
        >
          {Array.from({ length: MAX_PIN }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 ${
                i < pin.length
                  ? "border-emerald-500/70 bg-emerald-500/50"
                  : "border-zinc-700 bg-zinc-950/80"
              }`}
            />
          ))}
          <span className="sr-only">
            {pin.length} of {MIN_PIN}–{MAX_PIN} digits
          </span>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3 md:gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => append(n)}
              className="touch-pad flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950/90 text-2xl font-semibold text-zinc-100 active:bg-zinc-800"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={clear}
            className="touch-pad rounded-2xl border border-zinc-800 bg-zinc-900/60 text-base font-medium text-zinc-400 active:bg-zinc-800"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => append("0")}
            className="touch-pad flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950/90 text-2xl font-semibold text-zinc-100 active:bg-zinc-800"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            className="touch-pad rounded-2xl border border-zinc-800 bg-zinc-900/60 text-lg font-medium text-zinc-400 active:bg-zinc-800"
          >
            ⌫
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pin.length < MIN_PIN || pin.length > MAX_PIN}
          className="touch-pad mt-8 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white shadow-lg shadow-emerald-950/40 active:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
