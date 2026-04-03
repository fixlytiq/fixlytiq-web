import { AppShell } from "@/components/layout/AppShell";
import { ShellProviders } from "@/components/providers/ShellProviders";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShellProviders>
      <AppShell>{children}</AppShell>
    </ShellProviders>
  );
}
