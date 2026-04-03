import type { Metadata } from "next";
import { EmployeesWorkspace } from "@/components/operations/EmployeesWorkspace";

export const metadata: Metadata = {
  title: "Team",
};

export default function EmployeesPage() {
  return <EmployeesWorkspace />;
}
