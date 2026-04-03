/**
 * Parked register sale — no payment, no inventory movement, resumable later.
 */

import type { CartItem } from "@/types/pos";
import type { PaymentProcessorSnapshot } from "@/types/payment";

export type OpenOrderCustomerSnapshot = {
  name: string;
  phone?: string;
  email?: string;
} | null;

export type OpenOrder = {
  id: string;
  createdAt: string;
  updatedAt: string;
  stationId: string;
  storeId: string;
  createdBy: PaymentProcessorSnapshot | null;
  cart: CartItem[];
  /** First repair ticket id on the cart, if any (POS repair line). */
  linkedRepairTicketId: string | null;
  customer: OpenOrderCustomerSnapshot;
  subtotal: number;
  tax: number;
  total: number;
  status: "open";
  note: string | null;
  /** Short cashier-facing title */
  label: string | null;
};
