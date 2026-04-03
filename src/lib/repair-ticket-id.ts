export function newRepairTicketId(): string {
  const part = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `RQ-${part}`;
}
