import type { Metadata } from "next";
import { ShiftsWorkspace } from "@/components/operations/ShiftsWorkspace";

export const metadata: Metadata = {
  title: "Shifts",
};

export default function ShiftsPage() {
  return <ShiftsWorkspace />;
}
