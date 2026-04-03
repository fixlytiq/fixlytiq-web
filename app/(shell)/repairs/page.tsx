import type { Metadata } from "next";
import { RepairsWorkspace } from "@/components/repairs/RepairsWorkspace";

export const metadata: Metadata = {
  title: "Repairs",
};

export default function RepairsPage() {
  return <RepairsWorkspace />;
}
