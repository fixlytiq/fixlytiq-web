import type {
  LiabilityWaiverAcceptance,
  SignatureCapture,
} from "@/types/repair-workflow";

export function waiverFullyAcknowledged(w: LiabilityWaiverAcceptance): boolean {
  return (
    w.dataLossDisclaimer &&
    w.preExistingDamageDisclaimer &&
    w.waterproofingDisclaimer &&
    w.partsDisclaimer &&
    w.warrantyPolicyAck
  );
}

export function signatureIsValid(sig: SignatureCapture): boolean {
  if (sig.mode === "typed") {
    return Boolean(sig.typedFullName && sig.typedFullName.trim().length > 1);
  }
  return Boolean(
    sig.dataUrl &&
      sig.dataUrl.startsWith("data:image") &&
      sig.dataUrl.length > 80,
  );
}
