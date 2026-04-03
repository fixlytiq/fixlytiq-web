import type { Metadata } from "next";
import { PosWorkspace } from "./PosWorkspace";

export const metadata: Metadata = {
  title: "Register",
};

export default function PosPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PosWorkspace />
    </div>
  );
}
