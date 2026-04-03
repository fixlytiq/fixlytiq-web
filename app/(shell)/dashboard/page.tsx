import type { Metadata } from "next";
import { DashboardView } from "./DashboardView";

export const metadata: Metadata = {
  title: "Overview",
};

export default function DashboardPage() {
  return <DashboardView />;
}
