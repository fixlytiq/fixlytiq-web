import { repairPartsSubtotal } from "@/lib/repair-pricing";
import type { RepairLaborEstimate, RepairPartUsage } from "@/types/repair-parts";
import type { RepairPaymentState, RepairRefundLedgerEntry, RepairTicket } from "@/types/repairs";
import type {
  LiabilityWaiverAcceptance,
  PostInspectionChecklist,
  PreInspectionChecklist,
  SignatureCapture,
} from "@/types/repair-workflow";
import type { TicketWaiverSnapshot } from "@/types/waivers";

export function emptyPreInspection(): PreInspectionChecklist {
  return {
    screenCondition: "not_tested",
    frameCondition: "not_tested",
    backGlassCondition: "not_tested",
    cameraCondition: "not_tested",
    speakerCondition: "not_tested",
    microphoneCondition: "not_tested",
    chargingPortCondition: "not_tested",
    buttonsCondition: "not_tested",
    biometricsStatus: "not_tested",
    batteryChargingStatus: "not_tested",
    powersOn: "unknown",
    liquidDamage: "unknown",
    passcodeProvided: "unknown",
    simPresent: "unknown",
    accessoriesReceived: "",
    visibleDamageNotes: "",
    technicianIntakeNotes: "",
  };
}

export function emptyPostInspection(): PostInspectionChecklist {
  return {
    repairCompleted: "unknown",
    powersOn: "unknown",
    displayTested: "unknown",
    touchTested: "unknown",
    camerasTested: "unknown",
    speakersTested: "unknown",
    microphoneTested: "unknown",
    chargingTested: "unknown",
    buttonsTested: "unknown",
    biometricsTested: "unknown",
    finalCosmeticCondition: "not_tested",
    technicianFinalNotes: "",
    readyForPickup: "unknown",
  };
}

export function emptyLiabilityWaiver(): LiabilityWaiverAcceptance {
  return {
    dataLossDisclaimer: false,
    preExistingDamageDisclaimer: false,
    waterproofingDisclaimer: false,
    partsDisclaimer: false,
    warrantyPolicyAck: false,
    accepted: false,
    acceptedAt: null,
  };
}

export function emptySignatureCapture(): SignatureCapture {
  return {
    mode: "drawn",
    dataUrl: null,
    typedFullName: null,
  };
}

type TicketCore = Omit<
  RepairTicket,
  | "preInspection"
  | "postInspection"
  | "liabilityWaiver"
  | "waiverTemplateSnapshot"
  | "customerSignature"
  | "signedAt"
  | "partsUsage"
  | "laborEstimate"
  | "repairPaymentState"
  | "paidAt"
  | "linkedSaleId"
  | "paymentSummary"
  | "paymentHistory"
  | "refundHistory"
>;

/** Attach default workflow blocks to seed / legacy rows. */
export function withRepairWorkflowDefaults(
  core: TicketCore,
  overrides?: Partial<{
    preInspection: PreInspectionChecklist;
    postInspection: PostInspectionChecklist;
    liabilityWaiver: LiabilityWaiverAcceptance;
    waiverTemplateSnapshot: TicketWaiverSnapshot | null;
    customerSignature: SignatureCapture;
    signedAt: string | null;
    partsUsage: RepairPartUsage[];
    laborEstimate: RepairLaborEstimate;
    repairPaymentState: RepairPaymentState;
    paidAt: string | null;
    linkedSaleId: string | null;
    refundHistory: RepairRefundLedgerEntry[];
  }>,
): RepairTicket {
  const labor: RepairLaborEstimate =
    overrides?.laborEstimate ?? {
      amount: core.estimatedPrice,
      note: "",
    };
  const parts = overrides?.partsUsage ?? [];
  const partsSub = repairPartsSubtotal(parts);
  return {
    ...core,
    estimatedPrice: labor.amount + partsSub,
    laborEstimate: labor,
    partsUsage: parts,
    repairPaymentState: overrides?.repairPaymentState ?? "unpaid",
    paidAt: overrides?.paidAt ?? null,
    linkedSaleId: overrides?.linkedSaleId ?? null,
    paymentSummary: null,
    paymentHistory: [],
    preInspection: overrides?.preInspection ?? emptyPreInspection(),
    postInspection: overrides?.postInspection ?? emptyPostInspection(),
    liabilityWaiver: overrides?.liabilityWaiver ?? emptyLiabilityWaiver(),
    waiverTemplateSnapshot:
      overrides?.waiverTemplateSnapshot ?? null,
    customerSignature: overrides?.customerSignature ?? emptySignatureCapture(),
    signedAt: overrides?.signedAt ?? null,
    refundHistory: overrides?.refundHistory ?? [],
  };
}
