import type { OffenseCategory } from "@/lib/clemency-types";

export type ClemencyType = "p" | "c" | "g";
export type OffensePick = OffenseCategory | "none";
export const TYPES: readonly ClemencyType[] = ["p", "c", "g"];
export const TYPE_LABEL: Record<ClemencyType, string> = { p: "Pardons", c: "Commutations", g: "Group grants" };
export const TYPE_ROW_LABEL: Record<ClemencyType, string> = { p: "Pardon", c: "Commutation", g: "Group grant" };
export const TYPE_COLOR: Record<ClemencyType, string> = { p: "var(--clem-pardon)", c: "var(--clem-commutation)", g: "var(--clem-group)" };
export const offenseColor = (c: OffenseCategory) => `var(--offense-${c})`;
