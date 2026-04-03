"use client";

import { useEffect, useState } from "react";
import {
  useCustomersStore,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/stores/customers-store";
import type { Customer } from "@/types/customers";

const fieldClass =
  "mt-1 w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

export type CustomerFormModalProps = {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  customer?: Customer | null;
  createdBy: { employeeId: string; name: string } | null;
  onSaved?: (customerId: string) => void;
};

export function CustomerFormModal({
  open,
  onClose,
  mode,
  customer,
  createdBy,
  onSaved,
}: CustomerFormModalProps) {
  const createCustomer = useCustomersStore((s) => s.createCustomer);
  const updateCustomer = useCustomersStore((s) => s.updateCustomer);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (mode === "edit" && customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setPhone(customer.phone);
      setEmail(customer.email);
      setCompany(customer.company ?? "");
      setNotes(customer.notes);
      setTagsStr(customer.tags.map((t) => t.label).join(", "));
      setMarketingOptIn(customer.marketingOptIn);
      setLine1(customer.address?.line1 ?? "");
      setCity(customer.address?.city ?? "");
      setRegion(customer.address?.region ?? "");
      setPostal(customer.address?.postalCode ?? "");
    } else {
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setCompany("");
      setNotes("");
      setTagsStr("");
      setMarketingOptIn(false);
      setLine1("");
      setCity("");
      setRegion("");
      setPostal("");
    }
  }, [open, mode, customer]);

  if (!open) return null;

  const submit = () => {
    setErr(null);
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((label) => ({ id: crypto.randomUUID(), label }));

    const address =
      line1.trim() && city.trim()
        ? {
            line1: line1.trim(),
            line2: null as string | null,
            city: city.trim(),
            region: region.trim() || null,
            postalCode: postal.trim() || null,
            country: "US",
          }
        : null;

    if (mode === "create") {
      const input: CreateCustomerInput = {
        firstName,
        lastName,
        phone,
        email,
        company: company.trim() || null,
        address,
        notes,
        tags,
        marketingOptIn,
        createdBy,
      };
      const r = createCustomer(input);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onSaved?.(r.customerId);
      onClose();
      return;
    }

    if (!customer) {
      setErr("No customer to update.");
      return;
    }
    const patch: UpdateCustomerInput = {
      firstName,
      lastName,
      phone,
      email,
      company: company.trim() || null,
      address,
      notes,
      tags,
      marketingOptIn,
    };
    const r = updateCustomer(customer.id, patch);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    onSaved?.(customer.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(100dvh,880px)] w-full max-w-lg flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <h2 className="text-lg font-semibold text-zinc-50">
            {mode === "create" ? "New customer" : "Edit customer"}
          </h2>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {err ? (
            <p className="text-sm text-rose-400" role="alert">
              {err}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                First name
              </span>
              <input
                className={fieldClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Last name
              </span>
              <input
                className={fieldClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Phone
              </span>
              <input
                className={`${fieldClass} font-mono`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Email
              </span>
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Company (optional)
              </span>
              <input
                className={fieldClass}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Tags (comma-separated)
              </span>
              <input
                className={fieldClass}
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="VIP, trade-in"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600"
              />
              <span className="text-sm text-zinc-300">Marketing opt-in</span>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Profile notes
              </span>
              <textarea
                className={`${fieldClass} min-h-[5rem] resize-y`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 sm:col-span-2">
              Address (optional)
            </p>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs text-zinc-500">Street</span>
              <input
                className={fieldClass}
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-zinc-500">City</span>
              <input
                className={fieldClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-zinc-500">Region</span>
              <input
                className={fieldClass}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs text-zinc-500">Postal</span>
              <input
                className={fieldClass}
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="shrink-0 border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={submit}
            className="touch-pad w-full min-h-12 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
          >
            {mode === "create" ? "Create customer" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
