import type { CustomerSummaryMetrics } from "@/types/customers";
import type { Order } from "@/types/orders";
import type { Sale } from "@/types/pos";
import type { Refund } from "@/types/refunds";
import type { RepairTicket } from "@/types/repairs";

export function repairTicketsForCustomer(
  tickets: RepairTicket[],
  customerId: string,
): RepairTicket[] {
  return tickets
    .filter((t) => t.linkedCustomerId === customerId)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export function ordersForCustomer(orders: Order[], customerId: string): Order[] {
  return orders
    .filter((o) => o.customer?.customerId === customerId)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export function salesForCustomer(sales: Sale[], customerId: string): Sale[] {
  return sales
    .filter((s) => s.customerId === customerId)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function refundsForCustomer(
  refunds: Refund[],
  salesById: Map<string, Sale>,
  customerId: string,
): Refund[] {
  return refunds
    .filter((r) => {
      const sale = salesById.get(r.saleId);
      return sale?.customerId === customerId;
    })
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function computeCustomerSummaryMetrics(input: {
  customerId: string;
  tickets: RepairTicket[];
  orders: Order[];
  sales: Sale[];
  refunds: Refund[];
}): CustomerSummaryMetrics {
  const { customerId, tickets, orders, sales, refunds } = input;
  const tix = repairTicketsForCustomer(tickets, customerId);
  const ords = ordersForCustomer(orders, customerId);
  const sls = salesForCustomer(sales, customerId);
  const saleIds = new Set(sls.map((s) => s.id));
  const rf = refunds.filter((r) => saleIds.has(r.saleId));
  return {
    repairTicketCount: tix.length,
    orderCount: ords.length,
    saleCount: sls.length,
    refundCount: rf.length,
    ordersTotal: ords.reduce((s, o) => s + o.total, 0),
    salesTotal: sls.reduce((s, x) => s + x.totalDue, 0),
  };
}
