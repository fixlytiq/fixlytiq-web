/**
 * Shell chrome height comes from `app/globals.css` (`--shell-header-h`).
 * Use these classes on `DeviceChrome` only — main content must NOT add extra
 * top padding; the header is a flex sibling, not fixed.
 */
export const SHELL_HEADER_HEIGHT =
  "h-[var(--shell-header-h)] min-h-[var(--shell-header-h)]";
