/** Operations core — shifts & store profile (local-first). */

export type WorkShift = {
  id: string;
  employeeId: string;
  /** Snapshot at clock-in for stable history */
  employeeName: string;
  clockInAt: string;
  clockOutAt: string | null;
};

export type StoreSettings = {
  storeName: string;
  address: string;
  phone: string;
  /** Decimal rate e.g. 0.0825 for 8.25% */
  taxRate: string;
  /** ISO 4217 code */
  currency: string;
  receiptFooter: string;
  /** Free-form hours copy for receipts / footer */
  businessHours: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "Fixlytiq Demo Store",
  address: "100 Main St, Austin, TX",
  phone: "+1 555-0100",
  taxRate: "0.0825",
  currency: "USD",
  receiptFooter: "Thank you — see you again soon.",
  businessHours: "Mon–Sat 9–7 · Sun 10–5",
};
