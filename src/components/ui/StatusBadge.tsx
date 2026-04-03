import { REPAIR_STATUS_LABELS, type RepairStatus } from "@/types/repairs";

export type { RepairStatus };

const styles: Record<RepairStatus, { className: string }> = {
  intake: {
    className:
      "border-zinc-700 bg-zinc-800/80 text-zinc-200 ring-zinc-700/40",
  },
  diagnostics: {
    className:
      "border-amber-500/35 bg-amber-500/10 text-amber-200 ring-amber-500/20",
  },
  waiting_parts: {
    className:
      "border-orange-500/35 bg-orange-500/10 text-orange-200 ring-orange-500/20",
  },
  in_repair: {
    className:
      "border-sky-500/35 bg-sky-500/10 text-sky-200 ring-sky-500/20",
  },
  qa: {
    className:
      "border-violet-500/35 bg-violet-500/10 text-violet-200 ring-violet-500/20",
  },
  ready: {
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 ring-emerald-500/25",
  },
  closed: {
    className:
      "border-zinc-600 bg-zinc-900 text-zinc-400 ring-zinc-700/30",
  },
};

export type StatusBadgeProps = {
  status: RepairStatus;
  className?: string;
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ring-1 ring-inset ${s.className} ${className}`}
    >
      {REPAIR_STATUS_LABELS[status]}
    </span>
  );
}
