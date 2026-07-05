import { describe, it, expect } from "vitest";
import {
  uid, round2, formatINR, colorForName,
  currentPeriod, periodLabel, nextPeriod,
  isValidGmail, isValidMobile, isValidUpi,
  amountPaidBy, refundedTo, netPaidBy, totalCollected,
  paymentBreakdown,
  categorySpent, categoryBalance,
  applyMonthlyRollover, startNewMonth,
  normalizeState, nextOrderNo,
  splitBillShares, clampPaymentAmount, equalShares, buildUpiPaymentLink,
  generatePaymentReference, depositMemberStatus, buildLedgerItems,
} from "./utils.js";
import { AVATAR_COLORS, defaultState } from "./constants.js";

describe("uid", () => {
  it("returns a non-empty string", () => {
    expect(typeof uid()).toBe("string");
    expect(uid().length).toBeGreaterThan(0);
  });
  it("returns different values on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => uid()));
    expect(ids.size).toBe(20);
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
  });
  it("rounds correctly despite float-representation edge cases (e.g. 1.005)", () => {
    // Math.round(1.005 * 100) naively gives 100 (not 101) because 1.005 is
    // stored as 1.00499999999999989... in IEEE-754 double precision.
    expect(round2(1.005)).toBe(1.01);
  });
  it("handles negatives", () => {
    expect(round2(-1.239)).toBe(-1.24);
  });
  it("coerces non-numeric input to 0", () => {
    expect(round2(undefined)).toBe(0);
    expect(round2(null)).toBe(0);
    expect(round2("abc")).toBe(0);
    expect(round2(NaN)).toBe(0);
  });
  it("passes through already-clean numbers", () => {
    expect(round2(0)).toBe(0);
    expect(round2(2000)).toBe(2000);
  });
});

describe("formatINR", () => {
  it("formats positive integers with the rupee sign and en-IN grouping", () => {
    expect(formatINR(2000)).toBe("₹2,000");
    expect(formatINR(100000)).toBe("₹1,00,000"); // lakh grouping
  });
  it("formats negative numbers with a leading minus before the sign", () => {
    expect(formatINR(-500)).toBe("-₹500");
  });
  it("formats zero", () => {
    expect(formatINR(0)).toBe("₹0");
  });
  it("defaults non-finite input to 0", () => {
    expect(formatINR(NaN)).toBe("₹0");
    expect(formatINR(undefined)).toBe("₹0");
    expect(formatINR(Infinity)).toBe("₹0");
  });
});

describe("colorForName", () => {
  it("is deterministic for the same name", () => {
    expect(colorForName("Alice")).toBe(colorForName("Alice"));
  });
  it("returns a color from the AVATAR_COLORS palette", () => {
    expect(AVATAR_COLORS).toContain(colorForName("Bob"));
    expect(AVATAR_COLORS).toContain(colorForName(""));
    expect(AVATAR_COLORS).toContain(colorForName(undefined));
  });
  it("generally differentiates distinct names", () => {
    // Not guaranteed collision-free, but these two shouldn't collide.
    expect(colorForName("Alice")).not.toBe(colorForName("Zzzzzzz9284"));
  });
});

describe("currentPeriod", () => {
  it("formats as YYYY-M with zero-padded month", () => {
    expect(currentPeriod(new Date(2026, 0, 15))).toBe("2026-01");
    expect(currentPeriod(new Date(2026, 10, 1))).toBe("2026-11");
  });
});

describe("periodLabel", () => {
  it("returns empty string for falsy input", () => {
    expect(periodLabel("")).toBe("");
    expect(periodLabel(undefined)).toBe("");
  });
  it("formats a period string into a human month/year label", () => {
    expect(periodLabel("2026-07")).toBe("July 2026");
    expect(periodLabel("2026-01")).toBe("January 2026");
  });
});

describe("nextPeriod", () => {
  it("increments the month", () => {
    expect(nextPeriod("2026-06")).toBe("2026-07");
  });
  it("rolls over into the next year at December", () => {
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
});

describe("isValidGmail", () => {
  it("accepts gmail and googlemail addresses", () => {
    expect(isValidGmail("someone@gmail.com")).toBe(true);
    expect(isValidGmail("someone@googlemail.com")).toBe(true);
    expect(isValidGmail("Someone.123@GMAIL.com")).toBe(true);
  });
  it("rejects non-gmail domains and malformed addresses", () => {
    expect(isValidGmail("someone@yahoo.com")).toBe(false);
    expect(isValidGmail("not-an-email")).toBe(false);
    expect(isValidGmail("")).toBe(false);
    expect(isValidGmail(undefined)).toBe(false);
  });
  it("trims surrounding whitespace before validating", () => {
    expect(isValidGmail("  someone@gmail.com  ")).toBe(true);
  });
});

describe("isValidMobile", () => {
  it("accepts a 10-digit number starting with 6-9", () => {
    expect(isValidMobile("9876543210")).toBe(true);
    expect(isValidMobile("6000000000")).toBe(true);
  });
  it("rejects numbers starting with 0-5, wrong length, or non-digits", () => {
    expect(isValidMobile("5876543210")).toBe(false);
    expect(isValidMobile("987654321")).toBe(false); // 9 digits
    expect(isValidMobile("98765432100")).toBe(false); // 11 digits
    expect(isValidMobile("98765abcde")).toBe(false);
    expect(isValidMobile("")).toBe(false);
    expect(isValidMobile(undefined)).toBe(false);
  });
});

describe("isValidUpi", () => {
  it("accepts well-formed VPAs", () => {
    expect(isValidUpi("alice@okhdfc")).toBe(true);
    expect(isValidUpi("alice.123-4_5@upi")).toBe(true);
  });
  it("rejects missing/malformed VPAs", () => {
    expect(isValidUpi("")).toBe(false);
    expect(isValidUpi(undefined)).toBe(false);
    expect(isValidUpi("no-at-sign")).toBe(false);
    expect(isValidUpi("a@b1")).toBe(false); // bank part must be letters only
    expect(isValidUpi("@bank")).toBe(false); // handle too short (min 2 chars)
  });
});

describe("amountPaidBy", () => {
  const deposit = { history: [
    { memberId: "m1", amount: 500 },
    { memberId: "m2", amount: 300 },
    { memberId: "m1", amount: 200 },
  ] };
  it("sums only the given member's history entries", () => {
    expect(amountPaidBy(deposit, "m1")).toBe(700);
    expect(amountPaidBy(deposit, "m2")).toBe(300);
  });
  it("returns 0 for a member with no entries or empty history", () => {
    expect(amountPaidBy(deposit, "m3")).toBe(0);
    expect(amountPaidBy({ history: [] }, "m1")).toBe(0);
  });
});

describe("refundedTo", () => {
  const transactions = [
    { category: "rent", type: "refund", refundTo: "m1", amount: 100 },
    { category: "rent", type: "refund", refundTo: "m1", amount: 50 },
    { category: "rent", type: "expense", refundTo: "", amount: 999 }, // not a refund
    { category: "grocery", type: "refund", refundTo: "m1", amount: 999 }, // wrong category
    { category: "rent", type: "refund", refundTo: "m2", amount: 999 }, // wrong member
  ];
  it("sums only matching category+type+refundTo entries", () => {
    expect(refundedTo(transactions, "rent", "m1")).toBe(150);
  });
  it("returns 0 when nothing matches", () => {
    expect(refundedTo(transactions, "electricity", "m1")).toBe(0);
    expect(refundedTo([], "rent", "m1")).toBe(0);
  });
});

describe("netPaidBy", () => {
  it("subtracts refunds from the raw paid amount", () => {
    const deposit = { history: [{ memberId: "m1", amount: 1000 }] };
    const transactions = [{ category: "rent", type: "refund", refundTo: "m1", amount: 200 }];
    expect(netPaidBy(deposit, transactions, "rent", "m1")).toBe(800);
  });
  it("equals the raw paid amount when there are no refunds", () => {
    const deposit = { history: [{ memberId: "m1", amount: 1000 }] };
    expect(netPaidBy(deposit, [], "rent", "m1")).toBe(1000);
  });
});

describe("totalCollected", () => {
  it("sums all history entries regardless of member", () => {
    const deposit = { history: [{ memberId: "m1", amount: 100 }, { memberId: "m2", amount: 250 }] };
    expect(totalCollected(deposit)).toBe(350);
  });
  it("returns 0 for empty history", () => {
    expect(totalCollected({ history: [] })).toBe(0);
  });
});

describe("paymentBreakdown", () => {
  it("reports remaining due when underpaid", () => {
    const bd = paymentBreakdown(300, 1000);
    expect(bd).toMatchObject({ paid: 300, applied: 300, credit: 0, remaining: 700, status: "partial" });
  });
  it("reports paid with no credit/remaining on an exact match", () => {
    const bd = paymentBreakdown(1000, 1000);
    expect(bd).toMatchObject({ paid: 1000, applied: 1000, credit: 0, remaining: 0, status: "paid" });
  });
  it("caps applied at the share and reports the excess as credit when overpaid", () => {
    const bd = paymentBreakdown(1200, 1000);
    expect(bd).toMatchObject({ paid: 1200, applied: 1000, credit: 200, remaining: 0, status: "paid" });
  });
  it("treats a zero/negative paid amount as pending with full remaining", () => {
    const bd = paymentBreakdown(0, 1000);
    expect(bd).toMatchObject({ paid: 0, applied: 0, credit: 0, remaining: 1000, status: "pending" });
    const bdNeg = paymentBreakdown(-50, 1000);
    expect(bdNeg.paid).toBe(0);
    expect(bdNeg.status).toBe("pending");
  });
});

describe("categorySpent", () => {
  const transactions = [
    { category: "grocery", amount: 100, period: "2026-06" },
    { category: "grocery", amount: 50, period: "2026-07" },
    { category: "rent", amount: 999, period: "2026-07" },
  ];
  it("scopes to a given period when one is provided", () => {
    expect(categorySpent(transactions, "grocery", "2026-07")).toBe(50);
  });
  it("sums all-time when period is null (used for rent)", () => {
    expect(categorySpent(transactions, "grocery", null)).toBe(150);
  });
  it("returns 0 for a category with nothing recorded", () => {
    expect(categorySpent(transactions, "electricity", null)).toBe(0);
  });
});

describe("categoryBalance", () => {
  it("computes rent balance as all-time collected minus all-time spent (no carryover)", () => {
    const state = {
      period: "2026-07",
      deposits: { rent: { total: 5000, history: [{ memberId: "m1", amount: 3000 }] }, electricity: { total: 0, history: [] }, grocery: { total: 0, history: [], carryover: 0 } },
      transactions: [{ category: "rent", amount: 1000, period: "2026-06" }],
    };
    expect(categoryBalance(state, "rent")).toBe(2000); // 3000 collected - 1000 spent, spans all periods
  });
  it("scopes electricity spend to the current period only", () => {
    const state = {
      period: "2026-07",
      deposits: { rent: { total: 0, history: [] }, electricity: { total: 0, history: [{ memberId: "m1", amount: 1000 }] }, grocery: { total: 0, history: [], carryover: 0 } },
      transactions: [
        { category: "electricity", amount: 400, period: "2026-07" },
        { category: "electricity", amount: 999, period: "2026-06" }, // different period, ignored
      ],
    };
    expect(categoryBalance(state, "electricity")).toBe(600);
  });
  it("adds grocery carryover on top of collected minus spent", () => {
    const state = {
      period: "2026-07",
      deposits: { rent: { total: 0, history: [] }, electricity: { total: 0, history: [] }, grocery: { total: 0, history: [{ memberId: "m1", amount: 500 }], carryover: 200 } },
      transactions: [{ category: "grocery", amount: 300, period: "2026-07" }],
    };
    expect(categoryBalance(state, "grocery")).toBe(400); // 200 + 500 - 300
  });
});

describe("applyMonthlyRollover", () => {
  it("stamps the current period when none is set yet, without touching deposits", () => {
    const state = { ...defaultState, period: "", deposits: { ...defaultState.deposits, rent: { total: 500, history: [] } } };
    const { state: next, changed } = applyMonthlyRollover(state);
    expect(changed).toBe(true);
    expect(next.period).toBe(currentPeriod());
    expect(next.deposits.rent.total).toBe(500); // untouched
  });
  it("is a no-op when the stored period matches the current month", () => {
    const state = { ...defaultState, period: currentPeriod() };
    const { state: next, changed } = applyMonthlyRollover(state);
    expect(changed).toBe(false);
    expect(next).toBe(state); // same reference, no new object created
  });
  it("rolls over electricity/grocery and carries the grocery balance when the period is stale", () => {
    const state = {
      ...defaultState,
      period: "2020-01", // long in the past relative to "now"
      deposits: {
        rent: { total: 5000, history: [{ memberId: "m1", amount: 5000 }] },
        electricity: { total: 1000, history: [{ memberId: "m1", amount: 1000 }] },
        grocery: { total: 800, history: [{ memberId: "m1", amount: 800 }], carryover: 0 },
      },
      transactions: [{ category: "grocery", amount: 300, period: "2020-01" }],
    };
    const { state: next, changed } = applyMonthlyRollover(state);
    expect(changed).toBe(true);
    expect(next.period).toBe(currentPeriod());
    expect(next.deposits.electricity).toEqual({ total: 0, history: [], verification: {} });
    expect(next.deposits.grocery.total).toBe(0);
    expect(next.deposits.grocery.history).toEqual([]);
    expect(next.deposits.grocery.carryover).toBe(500); // 800 collected - 300 spent
    expect(next.deposits.grocery.verification).toEqual({});
    expect(next.deposits.rent).toEqual({ total: 5000, history: [{ memberId: "m1", amount: 5000 }] }); // rent untouched
  });
  it("never carries a negative grocery balance", () => {
    const state = {
      ...defaultState,
      period: "2020-01",
      deposits: {
        rent: { total: 0, history: [] },
        electricity: { total: 0, history: [] },
        grocery: { total: 100, history: [{ memberId: "m1", amount: 100 }], carryover: 0 },
      },
      transactions: [{ category: "grocery", amount: 500, period: "2020-01" }], // overspent
    };
    const { state: next } = applyMonthlyRollover(state);
    expect(next.deposits.grocery.carryover).toBe(0);
  });
});

describe("startNewMonth", () => {
  it("advances to the month after the stored period and carries the grocery balance", () => {
    const state = {
      ...defaultState,
      period: "2026-06",
      deposits: {
        rent: { total: 5000, history: [] },
        electricity: { total: 1000, history: [{ memberId: "m1", amount: 1000 }] },
        grocery: { total: 800, history: [{ memberId: "m1", amount: 800 }], carryover: 0 },
      },
      transactions: [],
    };
    const next = startNewMonth(state);
    expect(next.period).toBe("2026-07");
    expect(next.deposits.electricity).toEqual({ total: 0, history: [], verification: {} });
    expect(next.deposits.grocery.carryover).toBe(800);
  });
});

describe("normalizeState", () => {
  it("fills in defaultState for missing top-level fields", () => {
    const next = normalizeState(undefined);
    expect(next.members).toEqual([]);
    expect(next.transactions).toEqual([]);
    expect(next.deposits.grocery.carryover).toBe(0);
    expect(next.deposits.grocery.verification).toEqual({});
  });

  it("defaults member fields, assigns admin role to the first member, and preserves upiId", () => {
    const next = normalizeState({ members: [{ id: "m1", name: "Alice", upiId: "alice@upi" }, { id: "m2" }] });
    expect(next.members[0]).toMatchObject({ id: "m1", name: "Alice", role: "admin", gender: "", mobile: "", upiId: "alice@upi" });
    expect(next.members[1]).toMatchObject({ name: "Member", role: "member", upiId: "" });
  });

  it("assigns a generated id when a member is missing one", () => {
    const next = normalizeState({ members: [{ name: "Alice" }] });
    expect(typeof next.members[0].id).toBe("string");
    expect(next.members[0].id.length).toBeGreaterThan(0);
  });

  it("drops malformed deposit history entries (missing memberId or non-finite amount)", () => {
    const next = normalizeState({
      deposits: { rent: { total: 100, history: [{ memberId: "m1", amount: 50 }, { memberId: "", amount: 50 }, { memberId: "m1", amount: "bad" }, null] } },
    });
    expect(next.deposits.rent.history).toEqual([{ memberId: "m1", amount: 50 }]);
  });

  it("migrates legacy groceryTransactions (addedBy) into the unified transactions list", () => {
    const next = normalizeState({
      groceryTransactions: [{ amount: 200, addedBy: "m1", description: "Milk" }],
    });
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0]).toMatchObject({ category: "grocery", paidBy: "m1", amount: 200, description: "Milk" });
  });

  it("backfills missing orderNo per category in chronological order", () => {
    const next = normalizeState({
      transactions: [
        { category: "rent", amount: 100, date: "2026-02-01T00:00:00.000Z" },
        { category: "rent", amount: 200, date: "2026-01-01T00:00:00.000Z" },
        { category: "rent", amount: 300, date: "2026-03-01T00:00:00.000Z", orderNo: 5 }, // already has one
      ],
    });
    const byDate = [...next.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(byDate.map((t) => t.orderNo)).toEqual([6, 7, 5]); // Jan(no orderNo)->6, Feb(no orderNo)->7, Mar already 5
  });

  it("sanitizes a deposit's verification map: keeps valid claims, drops ghost members and malformed entries", () => {
    const members = [{ id: "m1", name: "Alice" }, { id: "m2", name: "Bob" }];
    const next = normalizeState({
      members,
      deposits: {
        rent: {
          total: 4000, history: [],
          verification: {
            m1: { amount: 2000, reference: "REF1", requestedAt: "2026-07-01T00:00:00.000Z" },
            ghost: { amount: 2000, reference: "REF2" }, // not a current member, dropped
            m2: { amount: -5 }, // invalid amount, dropped
          },
        },
      },
    });
    expect(Object.keys(next.deposits.rent.verification)).toEqual(["m1"]);
    expect(next.deposits.rent.verification.m1).toMatchObject({ amount: 2000, reference: "REF1" });
  });

  it("defaults a missing reference/requestedAt on an otherwise-valid verification entry", () => {
    const members = [{ id: "m1", name: "Alice" }];
    const next = normalizeState({ members, deposits: { rent: { total: 1000, history: [], verification: { m1: { amount: 500 } } } } });
    expect(next.deposits.rent.verification.m1.amount).toBe(500);
    expect(typeof next.deposits.rent.verification.m1.reference).toBe("string");
    expect(typeof next.deposits.rent.verification.m1.requestedAt).toBe("string");
  });
});

describe("nextOrderNo", () => {
  it("returns 1 when there are no transactions yet for the category", () => {
    expect(nextOrderNo([], "rent")).toBe(1);
  });
  it("returns one more than the current max orderNo for that category", () => {
    const transactions = [{ category: "rent", orderNo: 3 }, { category: "rent", orderNo: 1 }, { category: "grocery", orderNo: 99 }];
    expect(nextOrderNo(transactions, "rent")).toBe(4);
  });
});

describe("splitBillShares", () => {
  it("splits evenly when the amount divides cleanly", () => {
    expect(splitBillShares(12000, 6)).toEqual([2000, 2000, 2000, 2000, 2000, 2000]);
  });
  it("sums EXACTLY back to the original amount even on a non-divisible split", () => {
    const shares = splitBillShares(1000, 3);
    expect(shares).toHaveLength(3);
    const total = shares.reduce((a, b) => a + b, 0);
    expect(round2(total)).toBe(1000);
  });
  it("gives the leftover paise to the first members in order", () => {
    // 1000 / 3 = 333.33 repeating -> 33333 paise / 3 = 11111 base, remainder 0... use a case with remainder
    // 100 / 3 = 33.33... -> 10000 paise / 3 = 3333 base, remainder 1 paisa
    const shares = splitBillShares(100, 3);
    expect(shares[0]).toBe(33.34);
    expect(shares[1]).toBe(33.33);
    expect(shares[2]).toBe(33.33);
    expect(round2(shares.reduce((a, b) => a + b, 0))).toBe(100);
  });
  it("returns an empty array for zero or negative member counts", () => {
    expect(splitBillShares(1000, 0)).toEqual([]);
    expect(splitBillShares(1000, -1)).toEqual([]);
  });
});

describe("clampPaymentAmount", () => {
  it("passes through an increment that fits within the remaining share", () => {
    expect(clampPaymentAmount(500, 2000, 0)).toBe(500);
  });
  it("clamps an increment that would overpay the share", () => {
    expect(clampPaymentAmount(3000, 2000, 0)).toBe(2000);
  });
  it("accounts for what's already been paid", () => {
    expect(clampPaymentAmount(1000, 2000, 1500)).toBe(500);
  });
  it("returns 0 once the share is already fully paid", () => {
    expect(clampPaymentAmount(500, 2000, 2000)).toBe(0);
    expect(clampPaymentAmount(500, 2000, 2500)).toBe(0); // overpaid already, never negative
  });
});

describe("equalShares", () => {
  it("splits evenly across members when the total divides cleanly", () => {
    expect(equalShares(12000, ["m1", "m2", "m3"])).toEqual({ m1: 4000, m2: 4000, m3: 4000 });
  });
  it("sums exactly back to the total on a non-divisible split (regression: ₹13000 / 3 members)", () => {
    const shares = equalShares(13000, ["m1", "m2", "m3"]);
    const total = shares.m1 + shares.m2 + shares.m3;
    expect(round2(total)).toBe(13000);
    // A flat average (13000/3 = 4333.333...) rounds each share to 4333.33,
    // which only sums to 12999.99 — this is exactly the bug being fixed.
    expect(shares.m1).toBe(4333.34);
    expect(shares.m2).toBe(4333.33);
    expect(shares.m3).toBe(4333.33);
  });
  it("returns an empty map for no members", () => {
    expect(equalShares(1000, [])).toEqual({});
  });

  it("regression: every member paying their exact share in full brings the deposit balance to exactly the nominal total (no false 'exceeds balance')", () => {
    const total = 13000;
    const memberIds = ["m1", "m2", "m3"];
    const shares = equalShares(total, memberIds);
    // Simulate each member's Pay Now/Mark as Paid resolving their exact share in full.
    const history = memberIds.map((id) => {
      const clamped = clampPaymentAmount(shares[id], shares[id], 0);
      return { id: id + "-h", memberId: id, amount: clamped, date: new Date().toISOString() };
    });
    const deposit = { total, history };
    const collected = totalCollected(deposit);
    const balance = categoryBalance({ period: "2026-07", deposits: { rent: deposit, electricity: { total: 0, history: [] }, grocery: { total: 0, history: [], carryover: 0 } }, transactions: [] }, "rent");
    expect(round2(collected)).toBe(13000);
    expect(balance).toBe(13000);
    // The exact bug report: recording an expense for the full nominal amount
    // must NOT be rejected as exceeding the available balance.
    expect(13000 > balance).toBe(false);
  });
});

describe("buildUpiPaymentLink", () => {
  it("builds a upi://pay URL with all fields present and encoded", () => {
    const link = buildUpiPaymentLink({ payeeUpi: "admin@okhdfc", payeeName: "Room Admin", amount: 2000, note: "Rent - July", reference: "ABC123" });
    expect(link).toBe("upi://pay?pa=admin%40okhdfc&pn=Room%20Admin&mc=0000&am=2000.00&cu=INR&tn=Rent%20-%20July&tr=ABC123");
  });
  it("formats the amount to exactly 2 decimal places", () => {
    const link = buildUpiPaymentLink({ payeeUpi: "a@b", payeeName: "A", amount: 333.333, note: "", reference: "" });
    expect(link).toContain("am=333.33");
  });
  it("degrades gracefully with missing fields instead of throwing", () => {
    expect(() => buildUpiPaymentLink({})).not.toThrow();
    const link = buildUpiPaymentLink({});
    expect(link).toContain("pa=");
    expect(link).toContain("am=0.00");
  });
});

describe("generatePaymentReference", () => {
  it("returns a short human-typeable string", () => {
    const ref = generatePaymentReference();
    expect(typeof ref).toBe("string");
    expect(ref.startsWith("RM")).toBe(true);
    expect(ref.length).toBeLessThan(20);
  });
  it("is random rather than deterministic, so retries don't reuse the same reference", () => {
    const a = generatePaymentReference();
    const b = generatePaymentReference();
    expect(a).not.toBe(b);
  });
});

describe("depositMemberStatus", () => {
  it("reflects the underlying paymentBreakdown status when there's no pending verification claim", () => {
    const deposit = { history: [], verification: {} };
    expect(depositMemberStatus(deposit, [], "rent", "m1", 1000)).toBe("pending");
    const paidDeposit = { history: [{ memberId: "m1", amount: 1000 }], verification: {} };
    expect(depositMemberStatus(paidDeposit, [], "rent", "m1", 1000)).toBe("paid");
  });
  it("returns pending_verification when the member has an active claim, regardless of amounts paid", () => {
    const deposit = { history: [], verification: { m1: { amount: 1000, reference: "R1", requestedAt: "now" } } };
    expect(depositMemberStatus(deposit, [], "rent", "m1", 1000)).toBe("pending_verification");
  });
  it("only affects the member with the claim, not others", () => {
    const deposit = { history: [], verification: { m1: { amount: 1000, reference: "R1", requestedAt: "now" } } };
    expect(depositMemberStatus(deposit, [], "rent", "m2", 1000)).toBe("pending");
  });
});

describe("buildLedgerItems", () => {
  it("merges expenses, refunds, and confirmed deposit payments into one list", () => {
    const state = {
      transactions: [
        { id: "t1", category: "grocery", type: "expense", amount: 100, description: "Milk", paidBy: "m1", date: "2026-07-03T00:00:00.000Z" },
        { id: "t2", category: "rent", type: "refund", amount: 50, refundTo: "m2", date: "2026-07-02T00:00:00.000Z" },
      ],
      deposits: {
        rent: { total: 0, history: [{ id: "h1", memberId: "m1", amount: 2000, date: "2026-07-04T00:00:00.000Z" }], verification: {} },
        electricity: { total: 0, history: [], verification: {} },
        grocery: { total: 0, history: [], verification: {} },
      },
    };
    const items = buildLedgerItems(state);
    expect(items).toHaveLength(3);
    // sorted newest first
    expect(items.map((i) => i.id)).toEqual(["h1", "t1", "t2"]);
    expect(items[0]).toMatchObject({ kind: "received", category: "rent", amount: 2000, memberId: "m1" });
    expect(items[1]).toMatchObject({ kind: "expense", category: "grocery", amount: 100, paidBy: "m1" });
    expect(items[2]).toMatchObject({ kind: "refund", category: "rent", amount: 50, refundTo: "m2" });
  });

  it("returns an empty list when there's nothing recorded", () => {
    const state = {
      transactions: [],
      deposits: {
        rent: { total: 0, history: [], verification: {} },
        electricity: { total: 0, history: [], verification: {} },
        grocery: { total: 0, history: [], verification: {} },
      },
    };
    expect(buildLedgerItems(state)).toEqual([]);
  });

  it("never includes a member's 'I've paid' verification claim — only confirmed deposit.history payments", () => {
    const state = {
      transactions: [],
      deposits: {
        rent: { total: 0, history: [], verification: { m1: { amount: 500, reference: "R1", requestedAt: "2026-07-01T00:00:00.000Z" } } },
        electricity: { total: 0, history: [], verification: {} },
        grocery: { total: 0, history: [], verification: {} },
      },
    };
    expect(buildLedgerItems(state)).toEqual([]);
  });
});
