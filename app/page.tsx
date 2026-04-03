import Link from "next/link";

/** Station boot — not a marketing site; entry points for locked-down POS hardware */
export default function StationBootPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-2 ring-emerald-500/40">
            <span className="font-mono text-2xl font-bold text-emerald-400">F</span>
          </div>
          <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Fixlytiq · Station
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-4">
          <Link
            href="/pos"
            className="touch-pad flex w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white shadow-lg shadow-emerald-950/40 active:bg-emerald-500"
          >
            Open register
          </Link>
          <Link
            href="/login"
            className="touch-pad flex w-full items-center justify-center rounded-2xl border-2 border-zinc-700 bg-zinc-900/80 text-lg font-semibold text-zinc-200 active:bg-zinc-800"
          >
            Staff sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
