import type { Metadata } from "next";
import { OrdersWorkspace } from "@/components/orders/OrdersWorkspace";

export const metadata: Metadata = {
  title: "Orders",
};

export default function OrdersPage() {
  return <OrdersWorkspace />;
}

