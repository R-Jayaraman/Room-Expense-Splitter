import { Home, Zap, ShoppingCart } from "lucide-react";

export const T = {
  bg: "var(--rex-bg)", bgTranslucent: "var(--rex-bg-translucent)", subtleBg: "var(--rex-subtle-bg)",
  surface: "var(--rex-surface)", ink: "var(--rex-ink)", inkSoft: "var(--rex-ink-soft)", muted: "var(--rex-muted)",
  border: "var(--rex-border)", textOnDark: "var(--rex-shell-text)", textOnDarkMuted: "var(--rex-shell-text-muted)",
  primary: "var(--rex-primary)", primarySoft: "var(--rex-primary-soft)", rent: "var(--rex-rent)", rentSoft: "var(--rex-rent-soft)",
  power: "var(--rex-power)", powerSoft: "var(--rex-power-soft)", grocery: "var(--rex-grocery)", grocerySoft: "var(--rex-grocery-soft)",
  success: "var(--rex-success)", successSoft: "var(--rex-success-soft)", warning: "var(--rex-warning)", warningSoft: "var(--rex-warning-soft)",
  danger: "var(--rex-danger)", dangerSoft: "var(--rex-danger-soft)",
  fontDisplay: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontMono: "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, monospace",
};

export const CATEGORY_META = {
  rent: { label: "Room Rent", full: "Room Rent Deposit", icon: Home, accent: T.rent, soft: T.rentSoft, monthly: false, notePlaceholder: "e.g. Rent paid to the owner" },
  electricity: { label: "Electricity", full: "Electricity Deposit", icon: Zap, accent: T.power, soft: T.powerSoft, monthly: true, notePlaceholder: "e.g. Electricity bill paid to the government/EB" },
  grocery: { label: "Grocery", full: "Grocery Deposit", icon: ShoppingCart, accent: T.grocery, soft: T.grocerySoft, monthly: true, notePlaceholder: "e.g. Vegetables, rice, milk" },
};

export const AVATAR_COLORS = ["#E23744", "#5B4FE9", "#E08A00", "#1DA750", "#D8478B", "#2E8FE0", "#8A5B3D"];

export const defaultState = {
  period: "",
  members: [],
  deposits: {
    rent: { total: 0, history: [] },
    electricity: { total: 0, history: [] },
    grocery: { total: 0, history: [], carryover: 0 },
  },
  transactions: [],
};

export const MAX_DEPOSIT = 10000000;
export const MAX_DESC_LENGTH = 120;
