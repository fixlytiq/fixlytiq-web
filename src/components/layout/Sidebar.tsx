"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { canAccessPathname } from "@/lib/rbac";
import { formatEmployeeRole } from "@/lib/format-role";
import { useSessionStore } from "@/stores/session-store";
import type { EmployeeRole } from "@/types/employee";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string }>;
};

const ALL_NAV: NavItem[] = [
  { href: "/pos", label: "Register", short: "POS", icon: PosIcon },
  { href: "/dashboard", label: "Overview", short: "Home", icon: LayoutIcon },
  { href: "/repairs", label: "Repairs", short: "Fix", icon: WrenchIcon },
  {
    href: "/transactions",
    label: "Transactions",
    short: "Txns",
    icon: ReceiptIcon,
  },
  {
    href: "/orders",
    label: "Orders",
    short: "Ord",
    icon: ReceiptIcon,
  },
  {
    href: "/customers",
    label: "Customers",
    short: "Cust",
    icon: UserCircleIcon,
  },
  { href: "/inventory", label: "Stock", short: "Inv", icon: CubeIcon },
  { href: "/shifts", label: "Shifts", short: "Time", icon: ClockIcon },
  { href: "/employees", label: "Team", short: "HR", icon: UsersIcon },
  { href: "/settings", label: "Settings", short: "Cfg", icon: GearIcon },
];

function navForRole(role: EmployeeRole): NavItem[] {
  return ALL_NAV.filter((item) => canAccessPathname(role, item.href));
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const employee = useSessionStore((s) => s.employee);
  const logout = useSessionStore((s) => s.logout);

  const lock = () => {
    logout();
    router.push("/login");
  };

  const items = employee ? navForRole(employee.role) : [];

  return (
    <aside
      className="flex h-full w-[4.75rem] shrink-0 flex-col border-r border-zinc-800/95 bg-zinc-950 pt-[env(safe-area-inset-top)] sm:w-24 lg:w-56"
      aria-label="Primary"
    >
      <div className="flex shrink-0 flex-col items-center gap-1 border-b border-zinc-800/90 px-1 py-3 lg:flex-row lg:items-center lg:gap-3 lg:px-3 lg:py-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
          <span className="font-mono text-base font-bold text-emerald-400">F</span>
        </div>
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="truncate text-sm font-semibold leading-tight text-zinc-100">
            Fixlytiq
          </p>
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-zinc-600">
            Device
          </p>
        </div>
      </div>

      {employee ? (
        <div className="border-b border-zinc-800/90 px-2 py-3 text-center lg:px-3 lg:text-left">
          <p className="truncate text-xs font-semibold text-zinc-200">
            {employee.name}
          </p>
          <p className="truncate text-[11px] text-zinc-500">
            {formatEmployeeRole(employee.role)}
          </p>
        </div>
      ) : null}

      <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-2 pt-4 lg:gap-2 lg:px-2 lg:pb-3 lg:pt-5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition active:scale-[0.98] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3.5 lg:text-left lg:text-sm lg:normal-case lg:tracking-normal ${
                active
                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-inset ring-emerald-500/35"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <item.icon className="h-6 w-6 shrink-0 lg:h-5 lg:w-5" />
              <span className="leading-none lg:hidden">{item.short}</span>
              <span className="hidden leading-tight lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800/90 p-1.5 lg:p-2">
        <button
          type="button"
          title="Lock station"
          onClick={lock}
          className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-zinc-800/90 bg-zinc-900/40 py-2 text-[10px] font-semibold uppercase text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300 lg:flex-row lg:justify-start lg:gap-2 lg:px-3 lg:py-3 lg:text-xs lg:normal-case"
        >
          <LockIcon className="h-5 w-5 shrink-0" />
          <span className="lg:hidden">Lock</span>
          <span className="hidden lg:inline">Lock station</span>
        </button>
      </div>
    </aside>
  );
}

function LayoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5a2 2 0 012-2h7a2 2 0 012 2v4H4V5zM4 11h11v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8zM15 7h3a2 2 0 012 2v10a2 2 0 01-2 2h-3V7z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PosIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7h10M7 11h6M7 15h4M6 3h12a2 2 0 012 2v14l-3-2-3 2-3-2-3 2-3-2-3 2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.35 6.35a2 2 0 01-2.83-2.83l6.35-6.35a6 6 0 017.94-7.94l-3.76 3.76z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 12l8-4.5M12 12v9M12 12L4 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3l2 2 2-2 2 2 2-2 2 2v16l-2-2-2 2-2-2-2 2-2-2-2 2V5l2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 9h6M9 13h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
