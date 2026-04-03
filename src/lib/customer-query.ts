import type { Customer } from "@/types/customers";

export type CustomerListFilter = {
  query: string;
  /** When "active", only `active`; "archived" only inactive; "all" both */
  status: "active" | "archived" | "all";
  tagLabel?: string | null;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function customerMatchesQuery(c: Customer, q: string): boolean {
  const s = norm(q);
  if (!s) return true;
  if (norm(c.fullName).includes(s)) return true;
  if (norm(c.firstName).includes(s)) return true;
  if (norm(c.lastName).includes(s)) return true;
  if (norm(c.phone).includes(s)) return true;
  if (norm(c.email).includes(s)) return true;
  if (c.company && norm(c.company).includes(s)) return true;
  if (c.id.toLowerCase().includes(s)) return true;
  if (c.notes && norm(c.notes).includes(s)) return true;
  for (const t of c.tags) {
    if (norm(t.label).includes(s)) return true;
  }
  return false;
}

export function filterCustomers(
  customers: Customer[],
  filter: CustomerListFilter,
): Customer[] {
  return customers.filter((c) => {
    if (filter.status === "active" && !c.active) return false;
    if (filter.status === "archived" && c.active) return false;
    if (filter.tagLabel?.trim()) {
      const tl = norm(filter.tagLabel);
      if (!c.tags.some((t) => norm(t.label) === tl)) return false;
    }
    return customerMatchesQuery(c, filter.query);
  });
}
