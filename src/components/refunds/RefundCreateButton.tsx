"use client";

const BTN_CLASS =
  "touch-pad rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-200 active:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-40";

export type RefundCreateButtonProps = {
  onClick: () => void;
  /**
   * When non-null, user is not signed in — refund entry is disabled.
   */
  signInBlockedMessage: string | null;
  /**
   * Optional hint when signed in but PIN will be required in the modal (cashier / technician).
   */
  managerPinHint?: string | null;
  /** Contextual gate, e.g. linked sale exists. */
  prereqMet: boolean;
  /** Native tooltip when `prereqMet` is false (e.g. no linked sale). */
  prereqBlockedTitle?: string;
  /** Slightly smaller label/spacing for dense drawers. */
  compact?: boolean;
};

/**
 * Refund entry control: disables when not signed in or contextual prereqs fail.
 */
export function RefundCreateButton({
  onClick,
  signInBlockedMessage,
  managerPinHint,
  prereqMet,
  prereqBlockedTitle = "No linked transaction to refund.",
  compact,
}: RefundCreateButtonProps) {
  const disabled = signInBlockedMessage !== null || !prereqMet;
  const title = !prereqMet
    ? prereqBlockedTitle
    : (signInBlockedMessage ?? undefined);

  return (
    <div
      className={
        compact
          ? "flex flex-col items-end gap-1"
          : "flex flex-col items-end gap-1.5"
      }
    >
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={
          disabled && title ? `${title} Create refund` : "Create refund"
        }
        onClick={onClick}
        className={BTN_CLASS}
      >
        + Create refund
      </button>
      {signInBlockedMessage !== null && prereqMet ? (
        <p
          className={
            compact
              ? "max-w-[11rem] text-right text-[10px] leading-snug text-zinc-500"
              : "max-w-[14rem] text-right text-xs text-zinc-500"
          }
        >
          {signInBlockedMessage}
        </p>
      ) : null}
      {signInBlockedMessage === null &&
      managerPinHint &&
      prereqMet ? (
        <p
          className={
            compact
              ? "max-w-[11rem] text-right text-[10px] leading-snug text-zinc-500"
              : "max-w-[14rem] text-right text-xs text-zinc-500"
          }
        >
          {managerPinHint}
        </p>
      ) : null}
    </div>
  );
}
