import { AVATAR_COLORS, defaultState } from "./constants";

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function round2(n) {
  // Number.EPSILON nudge avoids float-representation misrounds, e.g. plain
  // Math.round(1.005 * 100) is 100 (not 101) because 1.005 is actually
  // stored as 1.00499999999999989... in IEEE-754 double precision.
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
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

// ---- UPI ID validation ------------------------------------------------------
export function isValidUpi(upiId) {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test((upiId || "").trim());
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
      electricity: { total: 0, history: [], verification: {} },
      grocery: { total: 0, history: [], carryover: round2(leftover), verification: {} },
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
    upiId: m.upiId || "",
  }));

  // deposits: keep history clean, ensure grocery.carryover, sanitize any
  // in-flight "I've paid, awaiting verification" claims per member.
  const deposits = {};
  for (const cat of Object.keys(defaultState.deposits)) {
    const cd = next.deposits[cat] || { total: 0, history: [] };
    const total = Number(cd.total) || 0;
    const history = Array.isArray(cd.history)
      ? cd.history.filter((h) => h && h.memberId && Number.isFinite(h.amount))
      : [];
    const verification = {};
    if (cd.verification && typeof cd.verification === "object") {
      for (const [mid, v] of Object.entries(cd.verification)) {
        if (v && members.some((m) => m.id === mid) && Number.isFinite(v.amount) && v.amount > 0) {
          verification[mid] = { amount: round2(v.amount), reference: v.reference || "", requestedAt: v.requestedAt || new Date().toISOString() };
        }
      }
    }
    deposits[cat] = cat === "grocery"
      ? { total, history, carryover: Number(cd.carryover) || 0, verification }
      : { total, history, verification };
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

// ---- equal splitting --------------------------------------------------
// Splits `amount` into `memberCount` shares that sum EXACTLY back to it (to
// the paisa), unlike a flat average (amount / memberCount) which can leave a
// rounding remainder uncollected on non-divisible splits (e.g. ₹1000 / 3 =
// ₹333.33 each, totalling ₹999.99). Works in integer paise to avoid float
// drift, and hands the leftover paise to the first few members in order.
export function splitBillShares(amount, memberCount) {
  if (!(memberCount > 0)) return [];
  const totalPaise = Math.round(round2(amount) * 100);
  const basePaise = Math.floor(totalPaise / memberCount);
  const remainder = totalPaise - basePaise * memberCount;
  return Array.from({ length: memberCount }, (_, i) => round2((basePaise + (i < remainder ? 1 : 0)) / 100));
}

// Clamps a member's incoming payment increment so it never pushes their
// cumulative paid amount past their share (over-collection is rejected
// rather than silently accepted). Returns 0 (meaning "no-op") once fully paid.
export function clampPaymentAmount(increment, share, alreadyPaid) {
  return round2(Math.max(0, Math.min(increment, share - alreadyPaid)));
}

// ---- deposits: exact per-member shares -------------------------------------
// Splits a deposit `total` equally across `memberIds` using splitBillShares,
// so that if every member pays their own assigned share in full, the total
// collected lands EXACTLY on `total` (never a paisa short). A flat average
// (total / memberIds.length) can't guarantee this on non-divisible splits —
// e.g. ₹13000 / 3 members rounds each member's due to ₹4333.33, which sums to
// ₹12999.99, permanently leaving ₹0.01 uncollectable and making the last
// ₹13000 expense entry look like it "exceeds the available balance". Returns
// a {memberId: share} map; ids are matched in the given array's order.
export function equalShares(total, memberIds) {
  const ids = Array.isArray(memberIds) ? memberIds : [];
  const shares = splitBillShares(total, ids.length);
  const map = {};
  ids.forEach((id, i) => { map[id] = shares[i]; });
  return map;
}

// "pa" must be a real VPA (name@bank) — a bare mobile number isn't valid
// syntax to every UPI app. Google Pay, in particular, silently drops the
// link (opens its home screen) rather than resolving a numeric payee the
// way Paytm's own "pay by number" flow does, so the payee address needs to
// be the admin's actual UPI ID for the deep link to work across apps.
export function buildUpiPaymentLink({ payeeUpi, payeeName, amount, note, reference }) {
  const parts = [
    "pa=" + encodeURIComponent(payeeUpi || ""),
    "pn=" + encodeURIComponent(payeeName || ""),
    // "mc" (merchant code) is spec-optional for peer-to-peer, but some UPI
    // apps validate more strictly when it's present outright vs. omitted —
    // "0000" is the standard NPCI code meaning "not a merchant transaction".
    "mc=0000",
    "am=" + encodeURIComponent(round2(amount).toFixed(2)),
    "cu=INR",
    "tn=" + encodeURIComponent(note || ""),
    "tr=" + encodeURIComponent(reference || ""),
  ];
  return "upi://pay?" + parts.join("&");
}

// Random (not deterministic) — reusing the same "tr" across retries/partial
// payments within a month reads as a duplicate/replayed transaction to some
// PSPs and can get bounced with a generic error. Callers must persist the
// value generated at "Pay Now" time and reuse it at "I've Paid" time rather
// than recomputing it, so the admin's record still matches what the bank
// narration shows. Not cryptographic, just short and human-typeable.
export function generatePaymentReference() {
  return "RM" + uid().toUpperCase();
}

// A member's payment status for one deposit category, folding in the
// "I've paid, awaiting admin verification" claim (which paymentBreakdown
// alone has no concept of — it only compares confirmed amounts).
export function depositMemberStatus(deposit, transactions, category, memberId, share) {
  if (deposit.verification && deposit.verification[memberId]) return "pending_verification";
  return paymentBreakdown(netPaidBy(deposit, transactions, category, memberId), share).status;
}

// ---- ledger ------------------------------------------------------------
// Merges expense/refund transactions with confirmed deposit payments
// (deposit.history — only ever written once the admin marks a member paid,
// never from a member's own "I've Paid" claim) into one chronological list
// for the Ledger tab, so admins never have to check two separate places to
// see everything that moved money. Each item is tagged with `kind` so the
// UI/delete logic can tell what it's looking at without re-deriving it.
export function buildLedgerItems(state) {
  const transactions = (state.transactions || []).map((t) => ({
    id: t.id, kind: t.type === "refund" ? "refund" : "expense", category: t.category,
    amount: t.amount, description: t.description, paidBy: t.paidBy, refundTo: t.refundTo,
    date: t.date, orderNo: t.orderNo,
  }));
  const received = [];
  for (const cat of Object.keys(state.deposits || {})) {
    for (const h of (state.deposits[cat].history || [])) {
      received.push({ id: h.id, kind: "received", category: cat, amount: h.amount, memberId: h.memberId, date: h.date });
    }
  }
  return [...transactions, ...received].sort((a, b) => new Date(b.date) - new Date(a.date));
}
