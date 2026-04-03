import type { Employee } from "@/types/employee";

/** Staff eligible for repair assignment (bench + leads). */
export function repairTechnicianCandidates(
  employees: Employee[],
): { id: string; name: string }[] {
  return employees
    .filter(
      (e) =>
        e.active &&
        (e.role === "technician" ||
          e.role === "manager" ||
          e.role === "owner"),
    )
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}
