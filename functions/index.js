// ---------------------------------------------------------------------------
// Push-notification backend for Room Expense Split.
//
// The web/app client can't send push itself (that needs a server key), so
// this Cloud Function watches each room's Firestore document for the events
// that should notify someone, and delivers them via FCM using the device
// token each user's client registered onto users/{uid}.fcmToken.
//
// Requires the Firebase project to be on the Blaze (pay-as-you-go) plan —
// Cloud Functions won't deploy on the free Spark plan. Deploy with:
//   cd functions && npm install && cd .. && npx firebase deploy --only functions
// ---------------------------------------------------------------------------
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const CATEGORY_LABEL = { rent: "Room Rent", electricity: "Electricity", grocery: "Grocery" };
const DEPOSIT_CATEGORIES = ["rent", "electricity", "grocery"];

function formatINR(n) {
  const v = Number.isFinite(n) ? n : 0;
  return "₹" + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function categoryLabel(cat) {
  return CATEGORY_LABEL[cat] || cat;
}

// Pure diff: given a room doc before/after a write (each { name, adminUid,
// state: { deposits, transactions, members, ... } }), returns the list of
// {uid, title, body, data} notifications the change warrants. Kept free of
// any Firestore/FCM calls so it can be unit tested directly (index.test.js).
//
// Three kinds of event, matching the app's actual data model:
//  1. A member marks "I've Paid" (deposits[cat].verification gains an entry)
//     -> notify the admin only, so they know to review it.
//  2. A confirmed payment lands in deposits[cat].history (admin's "Mark as
//     Paid"), or a new expense/refund lands in transactions — either way
//     that's a new Ledger entry -> broadcast to every member.
function buildRoomNotifications(before, after, roomId) {
  const beforeState = before?.state || {};
  const afterState = after?.state || {};
  const members = afterState.members || [];
  const memberName = (id) => members.find((m) => m.id === id)?.name || "Someone";
  const roomName = after?.name || "your room";
  const adminUid = after?.adminUid;
  const allUids = members.map((m) => m.id);
  const notifications = [];

  for (const cat of DEPOSIT_CATEGORIES) {
    const beforeDep = beforeState.deposits?.[cat] || {};
    const afterDep = afterState.deposits?.[cat] || {};

    // 1. New "I've Paid" claims -> admin only.
    const beforeVerification = beforeDep.verification || {};
    const afterVerification = afterDep.verification || {};
    for (const mid of Object.keys(afterVerification)) {
      if (beforeVerification[mid]) continue; // already existed, not new
      if (!adminUid) continue;
      notifications.push({
        uid: adminUid,
        title: "Payment awaiting verification",
        body: `${memberName(mid)} marked their ${categoryLabel(cat)} payment as paid in ${roomName} — review and confirm it.`,
        data: { roomId, tab: cat },
      });
    }

    // 2a. New confirmed payments (deposit.history) -> everyone.
    const beforeHistoryIds = new Set((beforeDep.history || []).map((h) => h.id));
    for (const h of (afterDep.history || [])) {
      if (beforeHistoryIds.has(h.id)) continue;
      for (const uid of allUids) {
        notifications.push({
          uid,
          title: "Payment recorded",
          body: `${memberName(h.memberId)} paid ${formatINR(h.amount)} for ${categoryLabel(cat)} in ${roomName}.`,
          data: { roomId, tab: "ledger" },
        });
      }
    }
  }

  // 2b. New expenses/refunds (transactions) -> everyone.
  const beforeTxIds = new Set((beforeState.transactions || []).map((t) => t.id));
  for (const t of (afterState.transactions || [])) {
    if (beforeTxIds.has(t.id)) continue;
    const isRefund = t.type === "refund";
    const title = isRefund ? "Refund recorded" : "Expense recorded";
    const body = isRefund
      ? `${formatINR(t.amount)} refunded to ${memberName(t.refundTo)} for ${categoryLabel(t.category)} in ${roomName}.`
      : `${memberName(t.paidBy)} recorded a ${categoryLabel(t.category)} expense of ${formatINR(t.amount)} in ${roomName}: ${t.description}`;
    for (const uid of allUids) {
      notifications.push({ uid, title, body, data: { roomId, tab: "ledger" } });
    }
  }

  return notifications;
}

// Looks up FCM tokens for a set of uids in one batch, skipping anyone with
// no token on file (e.g. web-only users, or a device that never registered).
async function tokensFor(uids) {
  const unique = [...new Set(uids)].filter(Boolean);
  if (unique.length === 0) return {};
  const docs = await Promise.all(unique.map((uid) => admin.firestore().doc(`users/${uid}`).get()));
  const tokenByUid = {};
  docs.forEach((doc) => {
    const token = doc.exists ? doc.data().fcmToken : null;
    if (token) tokenByUid[doc.id] = token;
  });
  return tokenByUid;
}

async function sendAll(notifications) {
  if (notifications.length === 0) return;
  const tokenByUid = await tokensFor(notifications.map((n) => n.uid));
  const messages = notifications
    .filter((n) => tokenByUid[n.uid])
    .map((n) => ({
      token: tokenByUid[n.uid],
      notification: { title: n.title, body: n.body },
      // Delivered alongside the notification and read by the client's
      // pushNotificationActionPerformed handler to route a tapped
      // notification straight to the right room + tab.
      data: Object.fromEntries(Object.entries(n.data || {}).map(([k, v]) => [k, String(v)])),
    }));
  if (messages.length === 0) return;
  // sendEach reports per-message success/failure instead of failing the
  // whole batch over one bad/expired token.
  await admin.messaging().sendEach(messages);
}

// Every room-state write is diffed for the events above. This fires on
// every mutation (not just payment-related ones), but buildRoomNotifications
// is a no-op (returns []) for anything else, so sendAll just skips out.
exports.onRoomStateChange = onDocumentUpdated("rooms/{roomId}", async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  await sendAll(buildRoomNotifications(before, after, event.params.roomId));
});

// Exposed for index.test.js only — not part of the deployed function surface.
exports._internal = { buildRoomNotifications, formatINR };

// Callable counterpart to sendReminderEmail — the admin triggers this
// directly (not via a Firestore diff) when they tap "Remind unpaid".
exports.sendReminderPush = onCall(async (request) => {
  const { memberUid, roomId, roomName, category, amountDue } = request.data || {};
  if (!memberUid || !Number.isFinite(amountDue)) return { sent: false };
  await sendAll([{
    uid: memberUid,
    title: "Payment reminder",
    body: `You have ${formatINR(amountDue)} still pending for ${categoryLabel(category)} in "${roomName}".`,
    data: { roomId, tab: category },
  }]);
  return { sent: true };
});
