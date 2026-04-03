import type { Metadata } from "next";
import { LoginClient } from "@/components/auth/LoginClient";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <LoginClient />
    </div>
  );
}
