import type { Sale } from "@/types/pos";

/** Start of "today" in local timezone */
export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function salesInRange(sales: Sale[], start: Date, end: Date): Sale[] {
  const t0 = start.getTime();
  const t1 = end.getTime();
  return sales.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= t0 && t <= t1;
  });
}

export function aggregateSales(sales: Sale[]): {
  count: number;
  revenue: number;
  tax: number;
} {
  return sales.reduce(
    (acc, s) => ({
      count: acc.count + 1,
      revenue: acc.revenue + s.total,
      tax: acc.tax + s.tax,
    }),
    { count: 0, revenue: 0, tax: 0 },
  );
}
