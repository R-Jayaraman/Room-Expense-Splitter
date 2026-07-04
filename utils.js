import { AVATAR_COLORS, defaultState } from "./constants";

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatINR(n) {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v < 0 ? "-" : "";
  return sign + "₹" + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function colorForName(name) {
  let hash = 0;
  const s = name || "?";
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ---- period (month) helpers ------------------------------------------------
export function currentPeriod(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export function periodLabel(period) {
  if (!period) return "";
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function nextPeriod(period) {
  const [y, m] = (period || currentPeriod()).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1 + 1, 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

// ---- email validation ------------------------------------------------------
export function isValidGmail(email) {
  return /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@(?:gmail|googlemail)\.com$/i.test((email || "").trim());
}

// ---- mobile validation ------------------------------------------------------
export function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test((mobile || "").trim());
}

// ---- payment helpers -------------------------------------------------------
export function amountPaidBy(deposit, memberId) {
  return (deposit.history || []).filter((h) => h.memberId === memberId).reduce((s, h) => s + h.amount, 0);
}

// Refund-type ledger transactions already paid back to a specific member for a category.
export function refundedTo(transactions, category, memberId) {
  return (transactions || [])
    .filter((t) => t.category === category && t.type === "refund" && t.refundTo === memberId)
    .reduce((s, t) => s + t.amount, 0);
}

// A member's paid amount net of any refunds already booked back to them in the
// ledger — this, not the raw deposit total, is what should be compared to their share.
export function netPaidBy(deposit, transactions, category, memberId) {
  return amountPaidBy(deposit, memberId) - refundedTo(transactions, category, memberId);
}

export function totalCollected(deposit) {
  return (deposit.history || []).reduce((s, h) => s + h.amount, 0);
}

export function paymentStatus(paidAmount, share) {
  if (share <= 0) return "pending";
  // Shares can be fractional (13000/7 = 1857.14…) while payments round to paise.
  if (paidAmount >= share - 0.01) return "paid";
  if (paidAmount > 0) return "partial";
  return "pending";
}

// Compares a member's cumulative paid amount against the CURRENT share.
// If the admin later lowers the total, any excess shows as "carried" credit;
// if raised, only the shortfall remains due.
export function paymentBreakdown(paid, share) {
  const p = Math.max(0, paid), s = Math.max(0, share);
  const applied = round2(Math.min(p, s));
  const credit = round2(Math.max(0, p - s));
  const remaining = round2(Math.max(0, s - p));
  let status = "pending";
  if (s > 0 && p >= s - 0.01) status = "paid";
  else if (p > 0) status = "partial";
  return { paid: round2(p), applied, credit, remaining, status };
}

// Sums expenses recorded for a category. Pass period=null for an all-time
// total (used for rent, which never resets); pass a period string to scope
// it to one cycle (used for electricity/grocery, which reset each month).
export function categorySpent(transactions, category, period) {
  return (transactions || [])
    .filter((t) => t.category === category && (period == null || (t.period || "") === period))
    .reduce((s, t) => s + t.amount, 0);
}

// Money available to spend against a category = carryover (grocery only) +
// collected − spent. Rent's spend is all-time since its deposit never resets;
// electricity/grocery are scoped to the current period.
export function categoryBalance(state, cat) {
  const deposit = state.deposits[cat];
  const collected = totalCollected(deposit);
  const carryover = cat === "grocery" ? (deposit.carryover || 0) : 0;
  const period = cat === "rent" ? null : state.period;
  const spent = categorySpent(state.transactions, cat, period);
  return round2(carryover + collected - spent);
}

// ---- monthly rollover ------------------------------------------------------
// Reset electricity + grocery collection to zero and carry any leftover
// grocery money into the given new period. Rent carries as-is.
function rolloverToPeriod(state, newPeriod) {
  const leftover = Math.max(0, categoryBalance(state, "grocery"));
  return {
    ...state,
    period: newPeriod,
    deposits: {
      ...state.deposits,
      electricity: { total: 0, history: [] },
      grocery: { total: 0, history: [], carryover: round2(leftover) },
    },
  };
}

// If the stored period is behind the real month, roll over automatically.
export function applyMonthlyRollover(state) {
  const now = currentPeriod();
  if (!state.period) return { state: { ...state, period: now }, changed: true };
  if (state.period === now) return { state, changed: false };
  return { state: rolloverToPeriod(state, now), changed: true };
}

// Admin-triggered early rollover — moves straight to the month after the
// current stored period, carrying over the grocery balance.
export function startNewMonth(state) {
  return rolloverToPeriod(state, nextPeriod(state.period));
}

// ---- normalize / migrate ---------------------------------------------------
export function normalizeState(parsed) {
  const base = parsed || {};
  const next = {
    ...defaultState,
    ...base,
    deposits: { ...defaultState.deposits, ...(base.deposits || {}) },
  };
  delete next.groceryTransactions; // migrated into the unified `transactions` list below

  // members: ensure id/name/email/role
  const members = (next.members || []).map((m, i) => ({
    id: m.id || uid(),
    name: m.name || "Member",
    email: m.email || "",
    role: m.role || (i === 0 ? "admin" : "member"),
    gender: m.gender || "",
    mobile: m.mobile || "",
  }));

  // deposits: keep history clean, ensure grocery.carryover
  const deposits = {};
  for (const cat of Object.keys(defaultState.deposits)) {
    const cd = next.deposits[cat] || { total: 0, history: [] };
    const total = Number(cd.total) || 0;
    const history = Array.isArray(cd.history)
      ? cd.history.filter((h) => h && h.memberId && Number.isFinite(h.amount))
      : [];
    deposits[cat] = cat === "grocery"
      ? { total, history, carryover: Number(cd.carryover) || 0 }
      : { total, history };
  }

  // expenses: ensure category/paidBy/period/orderNo. Old rooms only ever had
  // grocery purchases under `groceryTransactions` with an `addedBy` field —
  // migrate those into the unified, per-category `transactions` list.
  const period = next.period || currentPeriod();
  const rawTransactions = next.transactions && next.transactions.length ? next.transactions : (base.groceryTransactions || []);
  const transactions = rawTransactions
    .filter((t) => t && Number.isFinite(t.amount))
    .map((t) => ({
      id: t.id || uid(),
      category: t.category || "grocery",
      type: t.type || "expense",
      amount: t.amount,
      description: t.description || "Expense",
      paidBy: t.paidBy || t.addedBy || "",
      refundTo: t.refundTo || "",
      date: t.date || new Date().toISOString(),
      period: t.period || period,
      orderNo: t.orderNo || 0,
    }));
  // backfill order numbers oldest→newest if missing, scoped per category
  for (const cat of Object.keys(defaultState.deposits)) {
    const chrono = transactions.filter((t) => t.category === cat && !t.orderNo).sort((a, b) => new Date(a.date) - new Date(b.date));
    let order = transactions.filter((t) => t.category === cat && t.orderNo).reduce((mx, t) => Math.max(mx, t.orderNo), 0);
    for (const t of chrono) { order += 1; t.orderNo = order; }
  }

  return { ...next, period, members, deposits, transactions };
}

export function nextOrderNo(transactions, category) {
  return (transactions || []).filter((t) => t.category === category).reduce((mx, t) => Math.max(mx, t.orderNo || 0), 0) + 1;
}
