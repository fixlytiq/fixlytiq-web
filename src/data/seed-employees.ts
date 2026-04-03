import type { Employee } from "@/types/employee";

/** Initial roster when localStorage is empty */
export const seedEmployees: Employee[] = [
  {
    id: "emp-owner",
    name: "Jamie Ortiz",
    role: "owner",
    pin: "99999999",
    active: true,
  },
  {
    id: "emp-01",
    name: "Alex Kim",
    role: "manager",
    pin: "42424242",
    active: true,
  },
  {
    id: "emp-02",
    name: "Sam Lee",
    role: "cashier",
    pin: "10000000",
    active: true,
  },
  {
    id: "emp-03",
    name: "Jordan Park",
    role: "technician",
    pin: "55667788",
    active: true,
  },
  {
    id: "emp-04",
    name: "Riley Chen",
    role: "cashier",
    pin: "20262026",
    active: true,
  },
];
