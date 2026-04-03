import type { Metadata } from "next";
import { TransactionsWorkspace } from "@/components/transactions/TransactionsWorkspace";

export const metadata: Metadata = {
  title: "Transactions",
};

export default function TransactionsPage() {
  return <TransactionsWorkspace />;
}

