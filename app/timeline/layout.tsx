import type { ReactNode } from "react";
import { BranchTheme } from "@/components/BranchTheme";

/** /timeline spans all three branches, so it gets its own slate-and-gold theme (the homepage Timeline card's colours), not a branch's. */
export default function Layout({ children }: { children: ReactNode }) {
  return <BranchTheme branch="timeline">{children}</BranchTheme>;
}
