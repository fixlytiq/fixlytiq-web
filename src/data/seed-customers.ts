import type { Customer } from "@/types/customers";

const now = "2026-03-27T12:00:00.000Z";

/** Matches demo repair seed names for linkage demos. */
export const seedCustomers: Customer[] = [
  {
    id: "cust-seed-alex",
    firstName: "Alex",
    lastName: "Rivera",
    fullName: "Alex Rivera",
    phone: "+1 555-0101",
    email: "alex.r@email.test",
    company: null,
    address: null,
    notes: "",
    customerNotes: [],
    tags: [{ id: "tag-1", label: "Walk-in" }],
    contactMethods: [],
    marketingOptIn: false,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    active: true,
  },
  {
    id: "cust-seed-jordan",
    firstName: "Jordan",
    lastName: "Lee",
    fullName: "Jordan Lee",
    phone: "+1 555-0102",
    email: "",
    company: null,
    address: {
      line1: "12 Market St",
      line2: null,
      city: "Austin",
      region: "TX",
      postalCode: "78701",
      country: "US",
    },
    notes: "Prefers SMS",
    customerNotes: [],
    tags: [],
    contactMethods: [],
    marketingOptIn: true,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    active: true,
  },
];
