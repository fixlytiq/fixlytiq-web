/**
 * Repair intake / service workflow types — inspections, waiver, signature.
 * Local-first; backend will align later.
 */

/** Cosmetic / functional condition for device areas (pre-inspection + post cosmetic). */
export type DeviceConditionOption =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "damaged"
  | "not_tested"
  | "not_applicable";

export const DEVICE_CONDITION_OPTIONS: readonly {
  value: DeviceConditionOption;
  label: string;
}[] = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "damaged", label: "Damaged" },
  { value: "not_tested", label: "Not tested" },
  { value: "not_applicable", label: "N/A" },
] as const;

export type YesNoUnknown = "yes" | "no" | "unknown";

export const YES_NO_UNKNOWN_OPTIONS: readonly {
  value: YesNoUnknown;
  label: string;
}[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
] as const;

/** Recorded at device intake before service. */
export type PreInspectionChecklist = {
  screenCondition: DeviceConditionOption;
  frameCondition: DeviceConditionOption;
  backGlassCondition: DeviceConditionOption;
  cameraCondition: DeviceConditionOption;
  speakerCondition: DeviceConditionOption;
  microphoneCondition: DeviceConditionOption;
  chargingPortCondition: DeviceConditionOption;
  buttonsCondition: DeviceConditionOption;
  /** Face ID / Touch ID */
  biometricsStatus: DeviceConditionOption;
  batteryChargingStatus: DeviceConditionOption;
  powersOn: YesNoUnknown;
  liquidDamage: YesNoUnknown;
  passcodeProvided: YesNoUnknown;
  simPresent: YesNoUnknown;
  accessoriesReceived: string;
  visibleDamageNotes: string;
  technicianIntakeNotes: string;
};

/** Completed after repair, before pickup / close. */
export type PostInspectionChecklist = {
  repairCompleted: YesNoUnknown;
  powersOn: YesNoUnknown;
  displayTested: YesNoUnknown;
  touchTested: YesNoUnknown;
  camerasTested: YesNoUnknown;
  speakersTested: YesNoUnknown;
  microphoneTested: YesNoUnknown;
  chargingTested: YesNoUnknown;
  buttonsTested: YesNoUnknown;
  biometricsTested: YesNoUnknown;
  finalCosmeticCondition: DeviceConditionOption;
  technicianFinalNotes: string;
  readyForPickup: YesNoUnknown;
};

/** Customer acknowledgement of shop policies (intake). */
export type LiabilityWaiverAcceptance = {
  dataLossDisclaimer: boolean;
  preExistingDamageDisclaimer: boolean;
  waterproofingDisclaimer: boolean;
  partsDisclaimer: boolean;
  warrantyPolicyAck: boolean;
  accepted: boolean;
  acceptedAt: string | null;
};

export type SignatureMode = "drawn" | "typed";

/** Captured customer authorization signature at intake. */
export type SignatureCapture = {
  mode: SignatureMode;
  /** PNG data URL when `mode === "drawn"` */
  dataUrl: string | null;
  typedFullName: string | null;
};

export function deviceConditionLabel(v: DeviceConditionOption): string {
  return DEVICE_CONDITION_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function yesNoUnknownLabel(v: YesNoUnknown): string {
  return YES_NO_UNKNOWN_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
