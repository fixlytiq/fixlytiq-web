"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { repairTechnicianCandidates } from "@/lib/repair-technician-options";
import {
  signatureIsValid,
  waiverFullyAcknowledged,
} from "@/lib/repair-intake-validation";
import type { CreateRepairTicketInput } from "@/stores/repairs-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { useRepairsStore } from "@/stores/repairs-store";
import { usePosStore } from "@/stores/pos-store";
import { useWaiversStore } from "@/stores/waivers-store";
import {
  DEVICE_TYPE_OPTIONS,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  type DeviceType,
  type RepairStatus,
} from "@/types/repairs";
import {
  DEVICE_CONDITION_OPTIONS,
  YES_NO_UNKNOWN_OPTIONS,
  type DeviceConditionOption,
  type LiabilityWaiverAcceptance,
  type PreInspectionChecklist,
  type SignatureCapture,
  type YesNoUnknown,
} from "@/types/repair-workflow";
import {
  emptyLiabilityWaiver,
  emptyPreInspection,
  emptySignatureCapture,
} from "@/lib/repair-workflow-defaults";
import { SignaturePad } from "@/components/repairs/SignaturePad";
import { CustomerPicker } from "@/components/customers/CustomerPicker";
import { useSessionStore } from "@/stores/session-store";

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type BasicsState = {
  linkedCustomerId: string | null;
  customerName: string;
  phone: string;
  email: string;
  deviceType: DeviceType;
  brandModel: string;
  issueDescription: string;
  intakeDate: string;
  status: RepairStatus;
  assignTechnicianId: string;
  estimatedPrice: string;
};

function emptyBasics(): BasicsState {
  return {
    linkedCustomerId: null,
    customerName: "",
    phone: "",
    email: "",
    deviceType: "phone",
    brandModel: "",
    issueDescription: "",
    intakeDate: todayLocalDate(),
    status: "intake",
    assignTechnicianId: "",
    estimatedPrice: "",
  };
}

const STEPS = [
  "Customer & device",
  "Pre-inspection",
  "Liability waiver",
  "Signature",
  "Review & create",
] as const;

export type CreateRepairTicketModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (ticketId: string) => void;
};

export function CreateRepairTicketModal({
  open,
  onClose,
  onCreated,
}: CreateRepairTicketModalProps) {
  const createTicket = useRepairsStore((s) => s.createTicket);
  const sessionEmployee = useSessionStore((s) => s.employee);
  const roster = useEmployeesStore((s) => s.employees);
  const technicianOptions = useMemo(
    () => repairTechnicianCandidates(roster),
    [roster],
  );
  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState<BasicsState>(emptyBasics);
  const [pre, setPre] = useState<PreInspectionChecklist>(emptyPreInspection);
  const [waiver, setWaiver] = useState<LiabilityWaiverAcceptance>(
    emptyLiabilityWaiver(),
  );
  const [signature, setSignature] = useState<SignatureCapture>(
    emptySignatureCapture(),
  );
  const storeId = usePosStore((s) => s.station.storeId);
  const allWaiverTemplates = useWaiversStore((s) => s.templates);
  const activeRepairWaiverTemplates = useMemo(() => {
    return allWaiverTemplates.filter(
      (t) => t.storeId === storeId && t.category === "repair" && t.active,
    );
  }, [allWaiverTemplates, storeId]);
  const defaultRepairWaiverTemplateId = useWaiversStore(
    (s) => s.defaultRepairWaiverTemplateId,
  );
  const [waiverTemplateId, setWaiverTemplateId] = useState<string | null>(
    null,
  );
  const didResetOnOpenRef = useRef(false);
  const selectedRepairWaiverTemplate = useMemo(() => {
    if (waiverTemplateId) {
      return (
        activeRepairWaiverTemplates.find((t) => t.id === waiverTemplateId) ??
        null
      );
    }
    return activeRepairWaiverTemplates[0] ?? null;
  }, [activeRepairWaiverTemplates, waiverTemplateId]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      didResetOnOpenRef.current = false;
      return;
    }

    const defaultActive =
      defaultRepairWaiverTemplateId &&
      activeRepairWaiverTemplates.some(
        (t) => t.id === defaultRepairWaiverTemplateId,
      )
        ? defaultRepairWaiverTemplateId
        : activeRepairWaiverTemplates[0]?.id ?? null;

    // Avoid maximum update depth loops: only reset the entire form
    // the moment the modal opens (not when waiver lists change).
    if (!didResetOnOpenRef.current) {
      didResetOnOpenRef.current = true;
      setStep(0);
      setBasics(emptyBasics());
      setPre(emptyPreInspection());
      setWaiver(emptyLiabilityWaiver());
      setSignature(emptySignatureCapture());
      setError(null);
    }

    // Ensure the selected template id is valid/initialized.
    const waiverTemplateIdValid =
      waiverTemplateId != null &&
      activeRepairWaiverTemplates.some((t) => t.id === waiverTemplateId);
    if (!waiverTemplateIdValid) {
      setWaiverTemplateId(defaultActive);
    }
  }, [open, defaultRepairWaiverTemplateId, activeRepairWaiverTemplates]);

  const fieldClass =
    "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  const condSelect = (
    label: string,
    value: DeviceConditionOption,
    onPick: (v: DeviceConditionOption) => void,
  ) => (
    <label className="block text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <select
        className={fieldClass}
        value={value}
        onChange={(e) => onPick(e.target.value as DeviceConditionOption)}
      >
        {DEVICE_CONDITION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const ynSelect = (
    label: string,
    value: YesNoUnknown,
    onPick: (v: YesNoUnknown) => void,
  ) => (
    <label className="block text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <select
        className={fieldClass}
        value={value}
        onChange={(e) => onPick(e.target.value as YesNoUnknown)}
      >
        {YES_NO_UNKNOWN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const next = useCallback(() => {
    setError(null);
    if (step === 0) {
      if (!basics.customerName.trim()) {
        setError("Customer name is required.");
        return;
      }
      if (!basics.brandModel.trim()) {
        setError("Brand / model is required.");
        return;
      }
      if (!basics.issueDescription.trim()) {
        setError("Issue description is required.");
        return;
      }
      const price = Number.parseFloat(basics.estimatedPrice);
      if (!Number.isFinite(price) || price < 0) {
        setError("Enter a valid estimated price (0 or more).");
        return;
      }
    }
    if (step === 2 && !waiverFullyAcknowledged(waiver)) {
      setError("Acknowledge every waiver item to continue.");
      return;
    }
    if (step === 2 && !selectedRepairWaiverTemplate) {
      setError("Select a waiver template.");
      return;
    }
    if (step === 3 && !signatureIsValid(signature)) {
      setError(
        signature.mode === "typed"
          ? "Enter the customer’s full legal name."
          : "Sign on the pad (or switch to typed name).",
      );
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [basics, step, waiver, signature, selectedRepairWaiverTemplate]);

  const back = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const submit = useCallback(() => {
    const price = Number.parseFloat(basics.estimatedPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Invalid price.");
      return;
    }
    if (!waiverFullyAcknowledged(waiver) || !signatureIsValid(signature)) {
      setError("Complete waiver and signature.");
      return;
    }
    if (!selectedRepairWaiverTemplate) {
      setError("Select a waiver template.");
      return;
    }
    const signedAt = new Date().toISOString();
    const assignedAt = signedAt;
    let assignment: CreateRepairTicketInput["assignment"] = null;
    if (basics.assignTechnicianId) {
      const tech = technicianOptions.find(
        (e) => e.id === basics.assignTechnicianId,
      );
      if (tech) {
        assignment = {
          technicianId: tech.id,
          technicianName: tech.name,
          assignedAt,
        };
      }
    }

    const input: CreateRepairTicketInput = {
      linkedCustomerId: basics.linkedCustomerId,
      customerName: basics.customerName,
      phone: basics.phone,
      email: basics.email,
      deviceType: basics.deviceType,
      brandModel: basics.brandModel,
      issueDescription: basics.issueDescription,
      intakeDate: basics.intakeDate,
      status: basics.status,
      assignment,
      estimatedPrice: price,
      preInspection: pre,
      liabilityWaiver: {
        ...waiver,
        accepted: true,
        acceptedAt: signedAt,
      },
      waiverTemplateSnapshot: {
        templateId: selectedRepairWaiverTemplate.id,
        templateVersion: selectedRepairWaiverTemplate.version,
        title: selectedRepairWaiverTemplate.title,
        category: selectedRepairWaiverTemplate.category,
        body: selectedRepairWaiverTemplate.body,
        acceptedAt: signedAt,
        signature,
      },
      customerSignature: signature,
      signedAt,
    };

    const id = createTicket(input);
    onCreated?.(id);
    onClose();
  }, [
    basics,
    createTicket,
    onClose,
    onCreated,
    pre,
    signature,
    selectedRepairWaiverTemplate,
    technicianOptions,
    waiver,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-ticket-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(100dvh,920px)] w-full max-w-2xl flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-zinc-800 px-5 py-4">
          <h2
            id="create-ticket-title"
            className="text-lg font-semibold text-zinc-50"
          >
            New repair ticket
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>
          <div className="mt-3 flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i <= step ? "bg-emerald-500/70" : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-3 text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}

          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CustomerPicker
                  selectedCustomerId={basics.linkedCustomerId}
                  createdBy={
                    sessionEmployee
                      ? {
                          employeeId: sessionEmployee.id,
                          name: sessionEmployee.name,
                        }
                      : null
                  }
                  onSelect={(c) =>
                    setBasics((b) => ({
                      ...b,
                      linkedCustomerId: c.id,
                      customerName: c.fullName,
                      phone: c.phone,
                      email: c.email,
                    }))
                  }
                  onClear={() =>
                    setBasics((b) => ({
                      ...b,
                      linkedCustomerId: null,
                    }))
                  }
                />
              </div>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Customer name *
                </span>
                <input
                  className={fieldClass}
                  value={basics.customerName}
                  onChange={(e) =>
                    setBasics((b) => ({ ...b, customerName: e.target.value }))
                  }
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Phone
                </span>
                <input
                  className={fieldClass}
                  value={basics.phone}
                  onChange={(e) =>
                    setBasics((b) => ({ ...b, phone: e.target.value }))
                  }
                  type="tel"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Email
                </span>
                <input
                  className={fieldClass}
                  value={basics.email}
                  onChange={(e) =>
                    setBasics((b) => ({ ...b, email: e.target.value }))
                  }
                  type="email"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Device type
                </span>
                <select
                  className={fieldClass}
                  value={basics.deviceType}
                  onChange={(e) =>
                    setBasics((b) => ({
                      ...b,
                      deviceType: e.target.value as DeviceType,
                    }))
                  }
                >
                  {DEVICE_TYPE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Brand / model *
                </span>
                <input
                  className={fieldClass}
                  value={basics.brandModel}
                  onChange={(e) =>
                    setBasics((b) => ({ ...b, brandModel: e.target.value }))
                  }
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Issue description *
                </span>
                <textarea
                  className={`${fieldClass} min-h-[5.5rem] resize-y py-2`}
                  value={basics.issueDescription}
                  onChange={(e) =>
                    setBasics((b) => ({
                      ...b,
                      issueDescription: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Intake date
                </span>
                <input
                  className={fieldClass}
                  type="date"
                  value={basics.intakeDate}
                  onChange={(e) =>
                    setBasics((b) => ({ ...b, intakeDate: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Initial status
                </span>
                <select
                  className={fieldClass}
                  value={basics.status}
                  onChange={(e) =>
                    setBasics((b) => ({
                      ...b,
                      status: e.target.value as RepairStatus,
                    }))
                  }
                >
                  {REPAIR_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {REPAIR_STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Assigned technician
                </span>
                <select
                  className={fieldClass}
                  value={basics.assignTechnicianId}
                  onChange={(e) =>
                    setBasics((b) => ({
                      ...b,
                      assignTechnicianId: e.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {technicianOptions.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Est. price (USD)
                </span>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={basics.estimatedPrice}
                  onChange={(e) =>
                    setBasics((b) => ({
                      ...b,
                      estimatedPrice: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {condSelect("Screen", pre.screenCondition, (v) =>
                setPre((p) => ({ ...p, screenCondition: v })),
              )}
              {condSelect("Frame", pre.frameCondition, (v) =>
                setPre((p) => ({ ...p, frameCondition: v })),
              )}
              {condSelect("Back glass", pre.backGlassCondition, (v) =>
                setPre((p) => ({ ...p, backGlassCondition: v })),
              )}
              {condSelect("Cameras", pre.cameraCondition, (v) =>
                setPre((p) => ({ ...p, cameraCondition: v })),
              )}
              {condSelect("Speakers", pre.speakerCondition, (v) =>
                setPre((p) => ({ ...p, speakerCondition: v })),
              )}
              {condSelect("Microphone", pre.microphoneCondition, (v) =>
                setPre((p) => ({ ...p, microphoneCondition: v })),
              )}
              {condSelect("Charging port", pre.chargingPortCondition, (v) =>
                setPre((p) => ({ ...p, chargingPortCondition: v })),
              )}
              {condSelect("Buttons", pre.buttonsCondition, (v) =>
                setPre((p) => ({ ...p, buttonsCondition: v })),
              )}
              {condSelect("Face ID / Touch ID", pre.biometricsStatus, (v) =>
                setPre((p) => ({ ...p, biometricsStatus: v })),
              )}
              {condSelect("Battery / charging", pre.batteryChargingStatus, (v) =>
                setPre((p) => ({ ...p, batteryChargingStatus: v })),
              )}
              {ynSelect("Powers on", pre.powersOn, (v) =>
                setPre((p) => ({ ...p, powersOn: v })),
              )}
              {ynSelect("Liquid damage", pre.liquidDamage, (v) =>
                setPre((p) => ({ ...p, liquidDamage: v })),
              )}
              {ynSelect("Passcode provided", pre.passcodeProvided, (v) =>
                setPre((p) => ({ ...p, passcodeProvided: v })),
              )}
              {ynSelect("SIM present", pre.simPresent, (v) =>
                setPre((p) => ({ ...p, simPresent: v })),
              )}
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Accessories received
                </span>
                <textarea
                  className={`${fieldClass} min-h-[4rem] resize-y py-2`}
                  value={pre.accessoriesReceived}
                  onChange={(e) =>
                    setPre((p) => ({ ...p, accessoriesReceived: e.target.value }))
                  }
                  rows={2}
                  placeholder="Case, box, cable…"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Visible damage notes
                </span>
                <textarea
                  className={`${fieldClass} min-h-[4rem] resize-y py-2`}
                  value={pre.visibleDamageNotes}
                  onChange={(e) =>
                    setPre((p) => ({ ...p, visibleDamageNotes: e.target.value }))
                  }
                  rows={2}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Technician intake notes
                </span>
                <textarea
                  className={`${fieldClass} min-h-[4rem] resize-y py-2`}
                  value={pre.technicianIntakeNotes}
                  onChange={(e) =>
                    setPre((p) => ({
                      ...p,
                      technicianIntakeNotes: e.target.value,
                    }))
                  }
                  rows={2}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <label className="block text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Waiver template *
                  </span>
                  <select
                    className={fieldClass}
                    value={waiverTemplateId ?? ""}
                    onChange={(e) => setWaiverTemplateId(e.target.value)}
                    disabled={activeRepairWaiverTemplates.length === 0}
                  >
                    {activeRepairWaiverTemplates.length === 0 ? (
                      <option value="">No active waiver templates</option>
                    ) : null}
                    {activeRepairWaiverTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · v{t.version}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedRepairWaiverTemplate ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {selectedRepairWaiverTemplate.title}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Category: {selectedRepairWaiverTemplate.category} · Version{" "}
                      {selectedRepairWaiverTemplate.version}
                    </p>
                    <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 text-sm text-zinc-300">
                      {selectedRepairWaiverTemplate.body}
                    </pre>
                  </>
                ) : null}
              </div>

              <p className="text-sm text-zinc-400">
                The customer must acknowledge each item before the ticket can be
                opened.
              </p>
              {(
                [
                  {
                    key: "dataLossDisclaimer" as const,
                    label: "Data loss",
                    body: "Repair may erase data. I am responsible for backups.",
                  },
                  {
                    key: "preExistingDamageDisclaimer",
                    label: "Pre-existing damage",
                    body: "Pre-existing cosmetic or functional issues are noted on intake.",
                  },
                  {
                    key: "waterproofingDisclaimer",
                    label: "Waterproofing",
                    body: "Water resistance cannot be guaranteed after service.",
                  },
                  {
                    key: "partsDisclaimer",
                    label: "Parts",
                    body: "OEM, aftermarket, or refurbished parts may be used as quoted.",
                  },
                  {
                    key: "warrantyPolicyAck",
                    label: "Warranty & policy",
                    body: "I accept the shop warranty and return policy as explained.",
                  },
                ] as const
              ).map((row) => (
                <label
                  key={row.key}
                  className="flex cursor-pointer gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/30"
                    checked={waiver[row.key]}
                    onChange={(e) =>
                      setWaiver((w) => ({ ...w, [row.key]: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="font-semibold text-zinc-200">
                      {row.label}
                    </span>
                    <span className="mt-1 block text-sm text-zinc-500">
                      {row.body}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSignature({
                      mode: "drawn",
                      dataUrl: signature.dataUrl,
                      typedFullName: null,
                    })
                  }
                  className={`touch-pad min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold ${
                    signature.mode === "drawn"
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                      : "border-zinc-800 bg-zinc-950/60 text-zinc-400"
                  }`}
                >
                  Sign on pad
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSignature({
                      mode: "typed",
                      dataUrl: null,
                      typedFullName: signature.typedFullName ?? "",
                    })
                  }
                  className={`touch-pad min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold ${
                    signature.mode === "typed"
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                      : "border-zinc-800 bg-zinc-950/60 text-zinc-400"
                  }`}
                >
                  Type full name
                </button>
              </div>
              {signature.mode === "drawn" ? (
                <SignaturePad value={signature} onChange={setSignature} />
              ) : (
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Full legal name *
                  </span>
                  <input
                    className={fieldClass}
                    value={signature.typedFullName ?? ""}
                    onChange={(e) =>
                      setSignature((s) => ({
                        ...s,
                        mode: "typed",
                        dataUrl: null,
                        typedFullName: e.target.value,
                      }))
                    }
                    placeholder="As on ID"
                  />
                </label>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <ul className="space-y-3 text-sm text-zinc-300">
              <li>
                <span className="text-zinc-500">Customer:</span>{" "}
                {basics.customerName}
              </li>
              <li>
                <span className="text-zinc-500">Device:</span>{" "}
                {basics.brandModel} · {basics.issueDescription.slice(0, 80)}
                {basics.issueDescription.length > 80 ? "…" : ""}
              </li>
              <li>
                <span className="text-zinc-500">Pre-inspection:</span> recorded
                ({Object.keys(pre).length} fields)
              </li>
              <li>
                <span className="text-zinc-500">Waiver:</span> all items
                acknowledged
              </li>
              <li>
                <span className="text-zinc-500">Signature:</span>{" "}
                {signature.mode === "drawn"
                  ? "Captured on pad"
                  : signature.typedFullName}
              </li>
            </ul>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="touch-pad min-h-12 rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 text-base font-semibold text-zinc-300 active:bg-zinc-900"
          >
            Cancel
          </button>
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="touch-pad min-h-12 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 text-base font-semibold text-zinc-300 active:bg-zinc-800"
            >
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="touch-pad min-h-12 flex-1 rounded-xl bg-emerald-600 text-base font-semibold text-white active:bg-emerald-500 sm:flex-none sm:px-8"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="touch-pad min-h-12 flex-1 rounded-xl bg-emerald-600 text-base font-semibold text-white active:bg-emerald-500 sm:flex-none sm:px-8"
            >
              Create ticket
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
