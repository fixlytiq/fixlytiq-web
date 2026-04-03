import type { RepairStatus, RepairTicket } from "@/types/repairs";

export type RepairSortKey =
  | "updated_desc"
  | "created_desc"
  | "customer_asc"
  | "status_asc"
  | "price_desc";

export type RepairQuickFilter = "all" | "mine" | "today" | "waiting_parts";

export type RepairListQuery = {
  search: string;
  statusFilter: RepairStatus | "all";
  quickFilter: RepairQuickFilter;
  currentEmployeeId: string | null;
};

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchesSearch(t: RepairTicket, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const hay = [
    t.id,
    t.customerName,
    t.phone,
    t.email,
    t.brandModel,
    t.issueDescription,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

function matchesQuick(
  t: RepairTicket,
  quick: RepairQuickFilter,
  employeeId: string | null,
  today: string,
): boolean {
  switch (quick) {
    case "all":
      return true;
    case "mine":
      return (
        employeeId !== null && t.assignment?.technicianId === employeeId
      );
    case "today":
      return t.intakeDate === today;
    case "waiting_parts":
      return t.status === "waiting_parts";
    default:
      return true;
  }
}

export function filterRepairTickets(
  tickets: RepairTicket[],
  query: RepairListQuery,
  now: Date = new Date(),
): RepairTicket[] {
  const today = localDateString(now);
  return tickets.filter((t) => {
    if (!matchesQuick(t, query.quickFilter, query.currentEmployeeId, today)) {
      return false;
    }
    if (query.statusFilter !== "all" && t.status !== query.statusFilter) {
      return false;
    }
    return matchesSearch(t, query.search);
  });
}

const statusOrder: Record<RepairStatus, number> = {
  intake: 0,
  diagnostics: 1,
  waiting_parts: 2,
  in_repair: 3,
  qa: 4,
  ready: 5,
  closed: 6,
};

export function sortRepairTickets(
  tickets: RepairTicket[],
  key: RepairSortKey,
): RepairTicket[] {
  const copy = [...tickets];
  switch (key) {
    case "updated_desc":
      return copy.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    case "created_desc":
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "customer_asc":
      return copy.sort((a, b) =>
        a.customerName.localeCompare(b.customerName, undefined, {
          sensitivity: "base",
        }),
      );
    case "status_asc":
      return copy.sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status],
      );
    case "price_desc":
      return copy.sort((a, b) => b.estimatedPrice - a.estimatedPrice);
    default:
      return copy;
  }
}
