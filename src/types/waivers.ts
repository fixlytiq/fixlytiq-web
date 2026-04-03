/** Waiver template domain types — local-first; backend will align later */

import type { SignatureCapture } from "@/types/repair-workflow";

export type WaiverTemplateCategory =
  | "repair"
  | "diagnostics"
  | "water_damage"
  | "data_loss"
  | "storage_policy"
  | "custom";

/** Template version number (increments on meaningful edits). */
export type WaiverTemplateVersion = number;

export type WaiverTemplate = {
  id: string;
  /** Tenant scoping for local-first multi-store deployments. */
  storeId: string;
  organizationId: string;
  title: string;
  category: WaiverTemplateCategory;
  /** Full legal waiver content to be rendered during intake. */
  body: string;
  /** Version number captured in ticket snapshots. */
  version: WaiverTemplateVersion;
  /** Used by the intake UI and stored selection rules. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Frozen waiver acceptance snapshot stored on the repair ticket.
 * This is intentionally redundant for legal/history reasons.
 */
export type TicketWaiverSnapshot = {
  templateId: string;
  templateVersion: WaiverTemplateVersion;
  title: string;
  category: WaiverTemplateCategory;
  body: string;
  acceptedAt: string;
  signature: SignatureCapture;
};

