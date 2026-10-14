import type { ReactNode } from "react";
import { BranchTheme } from "@/components/BranchTheme";

export default function Layout({ children }: { children: ReactNode }) {
  return <BranchTheme branch="supreme-court">{children}</BranchTheme>;
}
