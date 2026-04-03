import type { Customer, CustomerLinkSnapshot } from "@/types/customers";
import type { OrderCustomerSnapshot } from "@/types/orders";

export function buildCustomerFullName(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const l = lastName.trim();
  if (f && l) return `${f} ${l}`;
  return f || l || "Customer";
}

export function customerLinkSnapshot(c: Customer): CustomerLinkSnapshot {
  return {
    customerId: c.id,
    fullName: c.fullName,
    phone: (c.phone ?? "").trim(),
    email: (c.email ?? "").trim(),
    company: c.company?.trim() ? c.company.trim() : null,
  };
}

/** POS / orders — nullable when no walk-in profile linked. */
export function orderCustomerSnapshotFromCustomer(
  c: Customer | null,
): OrderCustomerSnapshot {
  if (!c || !c.active) return null;
  return {
    customerId: c.id,
    name: c.fullName,
    phone: c.phone.trim() || undefined,
    email: c.email.trim() || undefined,
    company: c.company?.trim() ? c.company.trim() : undefined,
  };
}

export function orderCustomerSnapshotFromLink(
  snap: CustomerLinkSnapshot | null,
): OrderCustomerSnapshot {
  if (!snap?.customerId) return null;
  return {
    customerId: snap.customerId,
    name: snap.fullName,
    phone: snap.phone || undefined,
    email: snap.email || undefined,
    company: snap.company ?? undefined,
  };
}
