const test = require("node:test");
const assert = require("node:assert/strict");
const { _internal } = require("./index.js");
const { buildRoomNotifications } = _internal;

const members = [{ id: "admin1", name: "Admin" }, { id: "m1", name: "Alice" }, { id: "m2", name: "Bob" }];

function room(state, overrides = {}) {
  return { name: "Flat 3B", adminUid: "admin1", state, ...overrides };
}

function emptyDeposits() {
  return {
    rent: { total: 0, history: [], verification: {} },
    electricity: { total: 0, history: [], verification: {} },
    grocery: { total: 0, history: [], verification: {} },
  };
}

test("member's new 'I've Paid' claim notifies only the admin, with a deep link to that category tab", () => {
  const before = room({ members, deposits: emptyDeposits(), transactions: [] });
  const afterDeposits = emptyDeposits();
  afterDeposits.rent.verification.m1 = { amount: 2000, reference: "R1", requestedAt: "now" };
  const after = room({ members, deposits: afterDeposits, transactions: [] });

  const notifications = buildRoomNotifications(before, after, "room1");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].uid, "admin1");
  assert.match(notifications[0].title, /awaiting verification/);
  assert.match(notifications[0].body, /Alice/);
  assert.deepEqual(notifications[0].data, { roomId: "room1", tab: "rent" });
});

test("an existing (unchanged) verification claim produces no new notification", () => {
  const deposits = emptyDeposits();
  deposits.rent.verification.m1 = { amount: 2000, reference: "R1", requestedAt: "now" };
  const before = room({ members, deposits, transactions: [] });
  const after = room({ members, deposits, transactions: [] });
  assert.deepEqual(buildRoomNotifications(before, after, "room1"), []);
});

test("admin confirming a payment (new deposit.history entry) notifies every member, deep-linked to the ledger", () => {
  const before = room({ members, deposits: emptyDeposits(), transactions: [] });
  const afterDeposits = emptyDeposits();
  afterDeposits.rent.history = [{ id: "h1", memberId: "m1", amount: 2000, date: "2026-07-05T00:00:00.000Z" }];
  const after = room({ members, deposits: afterDeposits, transactions: [] });

  const notifications = buildRoomNotifications(before, after, "room1");
  assert.equal(notifications.length, 3); // every member, including admin and the payer
  assert.deepEqual(notifications.map((n) => n.uid).sort(), ["admin1", "m1", "m2"]);
  for (const n of notifications) {
    assert.match(n.title, /Payment recorded/);
    assert.match(n.body, /Alice/);
    assert.deepEqual(n.data, { roomId: "room1", tab: "ledger" });
  }
});

test("a new expense transaction notifies every member, deep-linked to the ledger", () => {
  const before = room({ members, deposits: emptyDeposits(), transactions: [] });
  const after = room({
    members, deposits: emptyDeposits(),
    transactions: [{ id: "t1", category: "grocery", type: "expense", amount: 500, description: "Rice", paidBy: "admin1", date: "2026-07-05T00:00:00.000Z" }],
  });

  const notifications = buildRoomNotifications(before, after, "room1");
  assert.equal(notifications.length, 3);
  assert.deepEqual(notifications.map((n) => n.uid).sort(), ["admin1", "m1", "m2"]);
  assert.match(notifications[0].title, /Expense recorded/);
  assert.match(notifications[0].body, /Admin/);
  assert.match(notifications[0].body, /Rice/);
  assert.deepEqual(notifications[0].data, { roomId: "room1", tab: "ledger" });
});

test("a new refund transaction notifies every member, deep-linked to the ledger", () => {
  const before = room({ members, deposits: emptyDeposits(), transactions: [] });
  const after = room({
    members, deposits: emptyDeposits(),
    transactions: [{ id: "t2", category: "rent", type: "refund", amount: 100, refundTo: "m2", date: "2026-07-05T00:00:00.000Z" }],
  });

  const notifications = buildRoomNotifications(before, after, "room1");
  assert.equal(notifications.length, 3);
  assert.match(notifications[0].title, /Refund recorded/);
  assert.match(notifications[0].body, /Bob/);
});

test("no changes produces no notifications", () => {
  const state = { members, deposits: emptyDeposits(), transactions: [] };
  assert.deepEqual(buildRoomNotifications(room(state), room(state), "room1"), []);
});

test("deleting a transaction or history entry (fewer items after than before) produces no notification", () => {
  const beforeDeposits = emptyDeposits();
  beforeDeposits.rent.history = [{ id: "h1", memberId: "m1", amount: 2000, date: "now" }];
  const before = room({
    members, deposits: beforeDeposits,
    transactions: [{ id: "t1", category: "grocery", type: "expense", amount: 500, description: "Rice", paidBy: "admin1", date: "now" }],
  });
  const after = room({ members, deposits: emptyDeposits(), transactions: [] });
  assert.deepEqual(buildRoomNotifications(before, after, "room1"), []);
});
