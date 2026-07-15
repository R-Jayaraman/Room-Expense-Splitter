import React, { useState, useEffect, useCallback, useRef } from "react";
import { Home, Zap, ShoppingCart, Users, Wallet, Receipt } from "lucide-react";
import { CATEGORY_META, defaultState, T } from "./constants";
import {
  formatINR, normalizeState, totalCollected, uid, round2, netPaidBy,
  currentPeriod, periodLabel, applyMonthlyRollover, categoryBalance, categorySpent, nextOrderNo,
  startNewMonth as startNewMonthState, isValidUpi, clampPaymentAmount, equalShares, buildUpiPaymentLink,
  buildUpiAppLinks, generatePaymentReference, paymentBreakdown,
} from "./utils";
import { AppBar, GlobalStyle, Aurora } from "./components/Shared";
import { Overview, MembersPanel, DepositPanel, GroceryPanel, LedgerPanel, ExpenseModal, ConfirmModal, SettingsModal, RoomInfoModal, UpiAppChooserModal } from "./components/Panels";
import { CharacterNotification } from "./components/CharacterNotification";
import {
  subscribeRoom, saveRoomState, deleteRoom, transferAdmin, getRoomPassword, setRoomPassword as saveRoomPassword,
  subscribeNotifications, markAllNotificationsRead, deleteAllNotifications, notifyMember, notifyMembers,
} from "./firebase";
import { showLocalNotification } from "./localNotify";

export default function RoomExpenseSplit({ user, roomId, initialTab, onLeave, onLogout, theme, onToggleTheme }) {
  const currentUserId = user.uid;

  const [state, setState] = useState(defaultState);
  const [meta, setMeta] = useState({ name: roomId, adminUid: null, adminName: "Admin" });
  const [roomPassword, setRoomPassword] = useState(null); // null = not fetched yet
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const [toast, setToast] = useState(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [confirmNewMonthOpen, setConfirmNewMonthOpen] = useState(false);
  const [pendingRemoveMember, setPendingRemoveMember] = useState(null);
  const [pendingMakeAdmin, setPendingMakeAdmin] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [confirmDeleteRoomOpen, setConfirmDeleteRoomOpen] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);

  const [depositDrafts, setDepositDrafts] = useState({ rent: "", electricity: "", grocery: "" });
  const [expenseCategory, setExpenseCategory] = useState("grocery");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [notifications, setNotifications] = useState([]);

  const isAdmin = meta.adminUid === currentUserId;
  const roomName = meta.name;

  // Global to the signed-in user (not this room specifically) — the bell
  // icon shows whatever's in users/{uid}/notifications regardless of which
  // room is currently open. Written client-side by whoever performs the
  // triggering action (see notifyMember/notifyMembers below) — there's no
  // server here (that'd need the paid Blaze plan).
  //
  // Every genuinely NEW item (not already seen on a previous snapshot) also
  // gets posted as a native Android notification via localNotify, so it
  // shows up in the OS tray while the app is running — not on the very
  // first snapshot though, which would otherwise replay the entire existing
  // inbox as fresh banners the moment the app opens.
  const seenNotificationIdsRef = useRef(null);
  useEffect(() => {
    seenNotificationIdsRef.current = null;
    const unsub = subscribeNotifications(currentUserId, (list) => {
      setNotifications(list);
      const seen = seenNotificationIdsRef.current;
      if (seen) {
        for (const n of list) {
          if (!seen.has(n.id)) showLocalNotification({ title: n.title, body: n.body, data: n.data });
        }
      }
      seenNotificationIdsRef.current = new Set(list.map((n) => n.id));
    });
    return unsub;
  }, [currentUserId]);

  const seededRef = useRef(false);
  useEffect(() => {
    seededRef.current = false;
    setLoaded(false);
    const unsub = subscribeRoom(
      roomId,
      (docData) => {
        setMeta({ name: docData.name || roomId, adminUid: docData.adminUid, adminName: docData.adminName || "Admin" });
        let s = normalizeState(docData.state || defaultState);
        const { state: rolled, changed } = applyMonthlyRollover(s);
        s = rolled;
        setState(s);
        if (!seededRef.current) {
          seededRef.current = true;
          setDepositDrafts({
            rent: String(s.deposits.rent.total || ""),
            electricity: String(s.deposits.electricity.total || ""),
            grocery: String(s.deposits.grocery.total || ""),
          });
        }
        setLoaded(true);
        if (changed) saveRoomState(roomId, s).catch(() => {});
      },
      (err) => {
        if (err && err.message === "room-deleted") { showToast("This room no longer exists", "danger"); setTimeout(() => onLeave && onLeave(), 1400); }
        else { setSaveError(true); setLoaded(true); }
      }
    );
    return () => unsub && unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const persistTimer = useRef(null);
  const persist = useCallback((next) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      try { await saveRoomState(roomId, next); setSaveError(false); } catch { setSaveError(true); }
    }, 300);
  }, [roomId]);

  const updateState = useCallback((updater) => {
    setState((prev) => { const next = typeof updater === "function" ? updater(prev) : updater; persist(next); return next; });
  }, [persist]);

  // For writes that must not be lost to the debounce (e.g. a member's own
  // profile) — the 300ms delay in persist() above is fine for high-frequency
  // edits, but if the app is backgrounded/closed within that window (e.g. the
  // member switches straight to a UPI app after tapping Save) the debounced
  // write never fires and the edit is silently dropped, which is exactly why
  // a previously-saved UPI ID could appear to reset itself. This saves right
  // away instead.
  const updateStateImmediate = useCallback((updater) => {
    if (persistTimer.current) { clearTimeout(persistTimer.current); persistTimer.current = null; }
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveRoomState(roomId, next).then(() => setSaveError(false)).catch(() => setSaveError(true));
      return next;
    });
  }, [roomId]);

  // Keyed so each call mounts a fresh CharacterNotification (resetting its
  // own internal auto-dismiss timer) even if the message text repeats.
  const showToast = (msg, tone = "default") => {
    setToast({ msg, tone, key: uid() });
  };

  const members = state.members;
  const memberName = (id) => members.find((m) => m.id === id)?.name || "Unknown";
  // Everyone except whoever's about to trigger the notification — the actor
  // already sees a toast confirming their own action, so they don't need a
  // duplicate notification about it too.
  const otherMemberIds = () => members.map((m) => m.id).filter((mid) => mid !== currentUserId);
  const perMemberShare = (cat) => { const c = members.length; return c ? (state.deposits[cat]?.total || 0) / c : 0; };
  // Exact per-member due, unlike perMemberShare's flat average — see
  // equalShares' doc comment for why the average alone can undercollect.
  const memberShares = (cat) => equalShares(state.deposits[cat]?.total || 0, members.map((m) => m.id));
  const collectedForCat = (cat) => totalCollected(state.deposits[cat]);
  const periodText = periodLabel(state.period || currentPeriod());

  const balanceStats = (cat) => {
    const deposit = state.deposits[cat];
    const collected = totalCollected(deposit);
    const carryover = cat === "grocery" ? (deposit.carryover || 0) : 0;
    const period = cat === "rent" ? null : state.period;
    const spent = round2(categorySpent(state.transactions, cat, period));
    return { carryover, collected, spent, balance: categoryBalance(state, cat) };
  };

  // Admin can edit any deposit total at any time; members never can.
  const canEditTotal = () => isAdmin;
  const lockReason = () => (isAdmin ? "" : "Only the admin can set this amount.");

  const removeMember = (id, mname) => {
    if (!isAdmin) return showToast("Only the admin can remove members", "danger");
    if (id === currentUserId) return showToast("You can't remove yourself", "danger");
    if (id === meta.adminUid) return showToast("The admin can't be removed", "danger");
    setPendingRemoveMember({ id, name: mname });
  };

  const confirmRemoveMember = () => {
    const { id, name: mname } = pendingRemoveMember;
    setPendingRemoveMember(null);
    updateState((prev) => {
      const nextMembers = prev.members.filter((m) => m.id !== id);
      const deposits = {};
      for (const cat of Object.keys(prev.deposits)) {
        const dep = prev.deposits[cat];
        const { [id]: _removedVerification, ...restVerification } = dep.verification || {};
        deposits[cat] = { ...dep, history: dep.history.filter((h) => h.memberId !== id), verification: restVerification };
      }
      return { ...prev, members: nextMembers, deposits, transactions: prev.transactions.filter((t) => t.paidBy !== id && t.refundTo !== id) };
    });
    showToast(mname + " removed");
  };

  const makeAdmin = (id, mname) => {
    if (!isAdmin) return showToast("Only the admin can hand off admin rights", "danger");
    if (id === meta.adminUid) return showToast(mname + " is already the admin", "danger");
    setPendingMakeAdmin({ id, name: mname });
  };

  const confirmMakeAdmin = async () => {
    const { id, name: mname } = pendingMakeAdmin;
    const previousAdminId = meta.adminUid;
    setPendingMakeAdmin(null);
    updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id === id) return { ...m, role: "admin" };
        if (m.id === previousAdminId) return { ...m, role: "member" };
        return m;
      }),
    }));
    try {
      await transferAdmin(roomId, { uid: id, name: mname });
      showToast(mname + " is now the admin", "success");
      notifyMember(id, { title: "You're now the admin", body: `You are now the admin of ${roomName}.`, data: { roomId, tab: "members" } });
      notifyMembers(members.map((m) => m.id).filter((mid) => mid !== id && mid !== currentUserId), {
        title: "Admin changed", body: `${mname} is now the admin of ${roomName}.`, data: { roomId, tab: "members" },
      });
    } catch {
      showToast("Couldn't hand off admin rights — try again", "danger");
    }
  };

  const currentMember = members.find((m) => m.id === currentUserId);
  const adminMember = members.find((m) => m.id === meta.adminUid);
  // First time this member is seen without a (valid) UPI ID — force them
  // through Settings before they can use the room, whether they just created
  // it (admin) or joined it (member). They can still edit it later.
  const needsUpi = Boolean(currentMember) && !isValidUpi(currentMember.upiId);

  const openSettings = () => setSettingsOpen(true);

  // Fetched on demand (not kept in the real-time room state) — Firestore
  // rules restrict rooms/{roomId}/secrets/main to members only.
  const openRoomInfo = () => {
    setRoomInfoOpen(true);
    getRoomPassword(roomId).then(setRoomPassword);
  };

  const updateProfile = (updates) => {
    updateStateImmediate((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === currentUserId ? { ...m, ...updates } : m)),
    }));
    setSettingsOpen(false);
    showToast("Details updated", "success");
  };

  // Admin-only. Also how rooms created before the secrets/main doc existed
  // get one — the original plaintext can't be recovered from its hash, so
  // the admin re-enters the password they've been sharing (or a new one).
  const handleSetRoomPassword = async (password) => {
    if (!isAdmin) return showToast("Only the admin can set the room password", "danger");
    try {
      await saveRoomPassword(roomId, password);
      setRoomPassword(password);
      showToast("Room password saved", "success");
    } catch (e) {
      showToast(e.message || "Couldn't save the room password", "danger");
    }
  };

  const requestDeleteRoom = () => {
    if (!isAdmin) return showToast("Only the admin can delete the room", "danger");
    setSettingsOpen(false);
    setConfirmDeleteRoomOpen(true);
  };

  const confirmDeleteRoom = async () => {
    setDeletingRoom(true);
    try {
      await deleteRoom(roomId);
      showToast("Room deleted", "success");
      onLeave && onLeave();
    } catch {
      setDeletingRoom(false);
      setConfirmDeleteRoomOpen(false);
      showToast("Couldn't delete the room — try again", "danger");
    }
  };

  const setDepositTotal = (cat) => {
    if (!isAdmin) return showToast("Only the admin can set this amount", "danger");
    const val = parseFloat(depositDrafts[cat]);
    if (!Number.isFinite(val) || val <= 0) return showToast("Enter a deposit amount greater than ₹0", "danger");
    updateState((prev) => ({ ...prev, deposits: { ...prev.deposits, [cat]: { ...prev.deposits[cat], total: round2(val) } } }));
    showToast(CATEGORY_META[cat].full + " set to " + formatINR(val), "success");
  };

  // A fresh "tr" is generated per Pay Now click (not derived deterministically)
  // since some PSPs read a repeated "tr" as a duplicate/replayed transaction
  // and bounce it — that reuse is the likely cause behind "technical glitch"
  // / "retry with a smaller amount" failures on retries. It's stashed here
  // (device-local, not room state) so "I've Paid" can report the same code
  // the bank narration will actually show, even after the member left the
  // app for the UPI app and came back.
  const paymentRefKey = (cat) => `rex-payref:${roomId}:${cat}:${currentUserId}`;

  // iOS has no OS-level chooser for a shared "upi://" scheme — Safari just
  // hands it to whichever app claims it (observed: WhatsApp Pay instead of
  // the intended payment app). So on iOS we show our own chooser using each
  // app's unambiguous scheme instead of navigating straight there.
  const [upiChooser, setUpiChooser] = useState(null);
  const isIOS = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Navigation only — no state write. The status change happens once the
  // member comes back and confirms via "I've Paid" (markDepositPaid below).
  const payNowDeposit = (cat) => {
    if (isAdmin) return; // per spec: only non-admin members pay via UPI
    const deposit = state.deposits[cat];
    const share = memberShares(cat)[currentUserId] || 0;
    const remaining = paymentBreakdown(netPaidBy(deposit, state.transactions, cat, currentUserId), share).remaining;
    if (remaining <= 0) return;
    if (!adminMember || !isValidUpi(adminMember.upiId)) return showToast("Admin hasn't set a valid UPI ID yet", "danger");
    const reference = generatePaymentReference();
    try { window.localStorage.setItem(paymentRefKey(cat), reference); } catch {}
    const linkParams = {
      payeeUpi: adminMember.upiId, payeeName: adminMember.name, amount: remaining,
      note: `${CATEGORY_META[cat].label} deposit`, reference,
    };
    if (isIOS()) { setUpiChooser(buildUpiAppLinks(linkParams)); return; }
    window.location.href = buildUpiPaymentLink(linkParams);
  };

  // Member confirms they've completed the UPI payment — moves them into
  // "pending_verification" until the admin confirms it landed.
  const markDepositPaid = (cat) => {
    if (isAdmin) return;
    const deposit = state.deposits[cat];
    if (deposit.verification && deposit.verification[currentUserId]) return; // already awaiting verification
    const share = memberShares(cat)[currentUserId] || 0;
    const remaining = paymentBreakdown(netPaidBy(deposit, state.transactions, cat, currentUserId), share).remaining;
    if (remaining <= 0) return;
    let reference;
    try { reference = window.localStorage.getItem(paymentRefKey(cat)); } catch {}
    if (!reference) reference = generatePaymentReference();
    try { window.localStorage.removeItem(paymentRefKey(cat)); } catch {}
    updateState((prev) => ({
      ...prev,
      deposits: {
        ...prev.deposits,
        [cat]: { ...prev.deposits[cat], verification: { ...prev.deposits[cat].verification, [currentUserId]: { amount: remaining, reference, requestedAt: new Date().toISOString() } } },
      },
    }));
    showToast("Marked as paid — waiting for admin to verify", "default");
    if (meta.adminUid) {
      notifyMember(meta.adminUid, {
        title: "Payment awaiting verification",
        body: `${memberName(currentUserId)} marked their ${CATEGORY_META[cat].label} payment as paid in ${roomName} — review and confirm it.`,
        data: { roomId, tab: cat },
      });
    }
  };

  // Admin's one-click resolution for a member's row. If the member already
  // claimed they paid (verification entry present), this finalizes exactly
  // that claimed amount — the "Verify Payment" step from the spec, just
  // labeled "Mark as Paid" to match the admin's other manual-entry action.
  // If there's no claim yet, it's the admin directly recording the full
  // remaining share themselves (e.g. cash handed over in person).
  const adminMarkPaid = (cat, memberId) => {
    if (!isAdmin) return showToast("Only the admin can do this", "danger");
    const deposit = state.deposits[cat];
    const claim = deposit.verification && deposit.verification[memberId];
    // The affected member gets a distinct, personal notice (this is what
    // they actually care about — the admin marked *them* paid); everyone
    // else just gets the general ledger update, and the admin (who's right
    // here doing it) doesn't need either.
    const notifyPaymentRecorded = (amount) => {
      if (memberId !== currentUserId) {
        notifyMember(memberId, {
          title: "Marked as paid", body: `Admin marked you as paid for ${CATEGORY_META[cat].label} — ${formatINR(amount)} in ${roomName}.`,
          data: { roomId, tab: cat },
        });
      }
      notifyMembers(otherMemberIds().filter((mid) => mid !== memberId), {
        title: "Payment recorded", body: `${memberName(memberId)} paid ${formatINR(amount)} for ${CATEGORY_META[cat].label} in ${roomName}.`,
        data: { roomId, tab: "ledger" },
      });
    };
    if (claim) {
      updateState((prev) => {
        const dep = prev.deposits[cat];
        const { [memberId]: _resolved, ...restVerification } = dep.verification;
        const entry = { id: uid(), memberId, amount: claim.amount, date: new Date().toISOString() };
        return { ...prev, deposits: { ...prev.deposits, [cat]: { ...dep, history: [entry, ...dep.history], verification: restVerification } } };
      });
      showToast(`Marked ${memberName(memberId)}'s payment as paid`, "success");
      notifyPaymentRecorded(claim.amount);
      return;
    }
    const share = memberShares(cat)[memberId] || 0;
    const remaining = paymentBreakdown(netPaidBy(deposit, state.transactions, cat, memberId), share).remaining;
    if (remaining <= 0) return;
    updateState((prev) => {
      const dep = prev.deposits[cat];
      const entry = { id: uid(), memberId, amount: remaining, date: new Date().toISOString() };
      return { ...prev, deposits: { ...prev.deposits, [cat]: { ...dep, history: [entry, ...dep.history] } } };
    });
    showToast(`Marked ${memberName(memberId)}'s payment as paid`, "success");
    notifyPaymentRecorded(remaining);
  };

  // If the admin lowers a total after members already paid the old share, this
  // books the resulting overpayment back to them as a ledger expense — same as
  // any other rent/electricity/grocery expense, just paid to a member instead
  // of the owner/government/store, so it shows in the Ledger with full history
  // and correctly reduces the category's available balance.
  const settleRefund = (cat, memberId) => {
    if (!isAdmin) return showToast("Only the admin can settle refunds", "danger");
    const deposit = state.deposits[cat];
    const share = memberShares(cat)[memberId] || 0;
    const credit = round2(Math.max(0, netPaidBy(deposit, state.transactions, cat, memberId) - share));
    if (credit <= 0) return showToast("Nothing to refund", "default");
    const entry = {
      id: uid(), category: cat, type: "refund", orderNo: nextOrderNo(state.transactions, cat),
      amount: credit, description: `Refund to ${memberName(memberId)}`, refundTo: memberId,
      date: new Date().toISOString(), period: state.period,
    };
    updateState((prev) => ({ ...prev, transactions: [entry, ...prev.transactions] }));
    showToast(`Refunded ${formatINR(credit)} to ${memberName(memberId)}`, "success");
    if (memberId !== currentUserId) {
      notifyMember(memberId, {
        title: "Refund recorded", body: `You were refunded ${formatINR(credit)} for ${CATEGORY_META[cat].label} in ${roomName}.`,
        data: { roomId, tab: "ledger" },
      });
    }
    notifyMembers(otherMemberIds().filter((mid) => mid !== memberId), {
      title: "Refund recorded", body: `${formatINR(credit)} refunded to ${memberName(memberId)} for ${CATEGORY_META[cat].label} in ${roomName}.`,
      data: { roomId, tab: "ledger" },
    });
  };

  // Reminders land straight in the target member's notification bell — no
  // server involved (that'd need a Cloud Function, which needs the paid
  // Blaze plan), so this just writes the notification directly instead of
  // waiting on a backend to notice the change. Email reminders have been
  // retired in favor of this single in-app channel.
  const remindAll = async (cat) => {
    if (!isAdmin) return;
    const shares = memberShares(cat);
    const unpaid = state.members
      .map((m) => ({ member: m, due: Math.max(0, (shares[m.id] || 0) - netPaidBy(state.deposits[cat], state.transactions, cat, m.id)) }))
      .filter((x) => x.due > 0.01);
    if (unpaid.length === 0) return showToast("Everyone has already paid", "default");

    showToast(`Sending reminders to ${unpaid.length} member${unpaid.length === 1 ? "" : "s"}…`);
    const results = await Promise.allSettled(
      unpaid.map((x) => notifyMember(x.member.id, {
        title: "Payment reminder", body: `You need to pay ${formatINR(x.due)} for ${CATEGORY_META[cat].label} in ${roomName}.`,
        data: { roomId, tab: cat },
      }))
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    showToast(`Reminded ${sent}/${unpaid.length} member${unpaid.length === 1 ? "" : "s"}`, sent > 0 ? "success" : "danger");
  };

  const addExpense = () => {
    if (!isAdmin) { setExpenseModalOpen(false); return showToast("Only the admin can record expenses", "danger"); }
    const category = expenseCategory;
    const amount = parseFloat(expenseAmount);
    const description = expenseDesc.trim();
    if (!Number.isFinite(amount) || amount <= 0) return showToast("Enter a valid amount", "danger");
    if (!description) return showToast("Add a short note", "danger");
    if (!expensePaidBy) return showToast("Choose who paid", "danger");
    const bal = balanceStats(category).balance;
    if (amount > bal) return showToast(bal <= 0 ? "No balance available yet." : `Exceeds the available balance of ${formatINR(bal)}`, "danger");
    const entry = {
      id: uid(), category, orderNo: nextOrderNo(state.transactions, category), amount: round2(amount),
      description, paidBy: expensePaidBy, date: new Date().toISOString(), period: state.period,
    };
    updateState((prev) => ({ ...prev, transactions: [entry, ...prev.transactions] }));
    setExpenseAmount(""); setExpenseDesc(""); setExpensePaidBy(""); setExpenseModalOpen(false);
    showToast(CATEGORY_META[category].label + " expense #" + entry.orderNo + " recorded", "success");
    notifyMembers(otherMemberIds(), {
      title: "Expense recorded", body: `${memberName(expensePaidBy)} recorded a ${CATEGORY_META[category].label} expense of ${formatINR(entry.amount)} in ${roomName}: ${description}`,
      data: { roomId, tab: "ledger" },
    });
  };

  const deleteTransaction = (id) => {
    if (!isAdmin) return showToast("Only the admin can edit expenses", "danger");
    const t = state.transactions.find((tx) => tx.id === id);
    updateState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
    if (t) {
      const isRefund = t.type === "refund";
      notifyMembers(otherMemberIds(), {
        title: isRefund ? "Refund reverted" : "Expense reverted",
        body: isRefund
          ? `A ${formatINR(t.amount)} refund to ${memberName(t.refundTo)} for ${CATEGORY_META[t.category].label} was reverted in ${roomName}.`
          : `${memberName(t.paidBy)}'s ${CATEGORY_META[t.category].label} expense of ${formatINR(t.amount)} (${t.description}) was reverted in ${roomName}.`,
        data: { roomId, tab: "ledger" },
      });
    }
  };

  // Rolls back a confirmed deposit payment straight from the Ledger — the
  // member's paid amount (and status) reverts immediately since it's derived
  // from deposit.history, not stored redundantly anywhere else.
  const deleteDepositPayment = (cat, historyId) => {
    if (!isAdmin) return showToast("Only the admin can edit the ledger", "danger");
    const h = state.deposits[cat].history.find((entry) => entry.id === historyId);
    updateState((prev) => ({
      ...prev,
      deposits: { ...prev.deposits, [cat]: { ...prev.deposits[cat], history: prev.deposits[cat].history.filter((h) => h.id !== historyId) } },
    }));
    showToast("Payment removed", "default");
    if (h) {
      notifyMembers(otherMemberIds(), {
        title: "Payment reverted", body: `${memberName(h.memberId)}'s ${formatINR(h.amount)} ${CATEGORY_META[cat].label} payment was reverted in ${roomName}.`,
        data: { roomId, tab: "ledger" },
      });
    }
  };

  const startNewMonth = () => {
    if (!isAdmin) return showToast("Only the admin can start a new month", "danger");
    const carried = Math.max(0, balanceStats("grocery").balance);
    updateState((prev) => startNewMonthState(prev));
    showToast("New month started — " + formatINR(carried) + " carried over to grocery", "success");
  };

  const confirmStartNewMonth = () => {
    setConfirmNewMonthOpen(false);
    startNewMonth();
  };

  const TABS = [
    { id: "overview", label: "Home", icon: Wallet }, { id: "members", label: "Members", icon: Users },
    { id: "rent", label: "Rent", icon: Home }, { id: "electricity", label: "Power", icon: Zap },
    { id: "grocery", label: "Grocery", icon: ShoppingCart }, { id: "ledger", label: "Ledger", icon: Receipt },
  ];

  if (!loaded) {
    return (
      <div className="rex-app" style={{ fontFamily: T.fontBody, background: T.bg, minHeight: "100vh" }}>
        <GlobalStyle /><Aurora />
        <div style={{ position: "relative", zIndex: 1, padding: "40px 20px", textAlign: "center", color: T.textOnDarkMuted }}>
          <div className="rex-spinner" /><div style={{ marginTop: 12, fontSize: 14 }}>Loading your room ledger…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rex-app" style={{ fontFamily: T.fontBody, background: T.bg, color: T.ink, minHeight: "100vh" }}>
      <GlobalStyle /><Aurora />
      <AppBar userName={currentMember?.name || "You"} saveError={saveError} roomName={roomName} roomId={roomId} isAdmin={isAdmin} periodText={periodText}
        onLeave={onLeave} onLogout={onLogout} onOpenSettings={openSettings} onOpenRoomInfo={openRoomInfo} theme={theme} onToggleTheme={onToggleTheme}
        notifications={notifications} onMarkAllNotificationsRead={(ids) => markAllNotificationsRead(currentUserId, ids)}
        onClearAllNotifications={(ids) => deleteAllNotifications(currentUserId, ids)} />

      <nav className="rex-tabs-desktop"><div className="rex-tabs-desktop-inner">
        {TABS.map((t) => { const Icon = t.icon; const active = activeTab === t.id; return (
          <button key={t.id} className={"rex-tab" + (active ? " rex-tab-active" : "")} onClick={() => setActiveTab(t.id)}><Icon size={15} strokeWidth={2.2} />{t.label}</button>
        ); })}
      </div></nav>

      <main className="rex-container"><div className="rex-fade" key={activeTab}>
        {activeTab === "overview" && <Overview state={state} shares={memberShares} setActiveTab={setActiveTab} periodText={periodText} grocery={balanceStats("grocery")} />}
        {activeTab === "members" && <MembersPanel members={members} isAdmin={isAdmin} currentUserId={currentUserId} adminUid={meta.adminUid} roomId={roomId} removeMember={removeMember} makeAdmin={makeAdmin} />}
        {(activeTab === "rent" || activeTab === "electricity") && (
          <DepositPanel cat={activeTab} state={state} isAdmin={isAdmin} currentUserId={currentUserId} canEdit={canEditTotal()} lockReason={lockReason()} periodText={periodText}
            depositDrafts={depositDrafts} setDepositDrafts={setDepositDrafts} setDepositTotal={setDepositTotal} remindAll={remindAll} settleRefund={settleRefund}
            onPayNow={() => payNowDeposit(activeTab)} onMarkPaid={() => markDepositPaid(activeTab)} onAdminMarkPaid={(memberId) => adminMarkPaid(activeTab, memberId)}
            perMemberShare={perMemberShare(activeTab)} shares={memberShares(activeTab)} collected={collectedForCat(activeTab)} />
        )}
        {activeTab === "grocery" && (
          <GroceryPanel state={state} isAdmin={isAdmin} currentUserId={currentUserId} canEdit={canEditTotal()} lockReason={lockReason()} periodText={periodText}
            depositDrafts={depositDrafts} setDepositDrafts={setDepositDrafts} setDepositTotal={setDepositTotal} remindAll={remindAll} settleRefund={settleRefund}
            onPayNow={() => payNowDeposit("grocery")} onMarkPaid={() => markDepositPaid("grocery")} onAdminMarkPaid={(memberId) => adminMarkPaid("grocery", memberId)}
            perMemberShare={perMemberShare("grocery")} shares={memberShares("grocery")} collected={collectedForCat("grocery")} grocery={balanceStats("grocery")} />
        )}
        {activeTab === "ledger" && (
          <LedgerPanel state={state} isAdmin={isAdmin} balances={{ rent: balanceStats("rent"), electricity: balanceStats("electricity"), grocery: balanceStats("grocery") }}
            periodText={periodText} memberName={memberName} deleteTransaction={deleteTransaction} deleteDepositPayment={deleteDepositPayment}
            openExpenseModal={() => { if (!isAdmin) return showToast("Only the admin can record expenses", "danger"); setExpenseCategory("grocery"); setExpensePaidBy(""); setExpenseModalOpen(true); }}
            onStartNewMonth={() => { if (!isAdmin) return showToast("Only the admin can start a new month", "danger"); setConfirmNewMonthOpen(true); }} />
        )}
      </div></main>

      <nav className="rex-tabs-mobile">
        {TABS.map((t) => { const Icon = t.icon; const active = activeTab === t.id; return (
          <button key={t.id} className={"rex-mtab" + (active ? " rex-mtab-active" : "")} onClick={() => setActiveTab(t.id)}><Icon size={19} strokeWidth={active ? 2.4 : 2} /><span>{t.label}</span></button>
        ); })}
      </nav>

      {expenseModalOpen && (
        <ExpenseModal members={members} category={expenseCategory} setCategory={setExpenseCategory}
          amount={expenseAmount} setAmount={setExpenseAmount} description={expenseDesc} setDescription={setExpenseDesc}
          paidBy={expensePaidBy} setPaidBy={setExpensePaidBy}
          balances={{ rent: balanceStats("rent").balance, electricity: balanceStats("electricity").balance, grocery: balanceStats("grocery").balance }}
          addExpense={addExpense} onClose={() => setExpenseModalOpen(false)} />
      )}
      {confirmNewMonthOpen && (
        <ConfirmModal title="Start a new month?"
          message={`This resets the electricity and grocery deposits for a fresh cycle. ${formatINR(Math.max(0, balanceStats("grocery").balance))} of unspent grocery balance will carry over — this can't be undone.`}
          confirmLabel="Start new month" onConfirm={confirmStartNewMonth} onClose={() => setConfirmNewMonthOpen(false)} />
      )}
      {pendingRemoveMember && (
        <ConfirmModal title="Remove this member?"
          message={`${pendingRemoveMember.name} will be removed from the room along with their payment history. This can't be undone.`}
          confirmLabel="Remove" danger onConfirm={confirmRemoveMember} onClose={() => setPendingRemoveMember(null)} />
      )}
      {pendingMakeAdmin && (
        <ConfirmModal title={`Make ${pendingMakeAdmin.name} the admin?`}
          message={`${pendingMakeAdmin.name} will get full admin rights — setting deposit totals, recording expenses, and managing members. You'll become a regular member and lose those rights.`}
          confirmLabel="Make admin" onConfirm={confirmMakeAdmin} onClose={() => setPendingMakeAdmin(null)} />
      )}
      {(settingsOpen || needsUpi) && currentMember && (
        <SettingsModal member={currentMember} email={user.email} onSave={updateProfile} onClose={() => setSettingsOpen(false)}
          isAdmin={isAdmin} onDeleteRoom={requestDeleteRoom} requireUpi={needsUpi} />
      )}
      {roomInfoOpen && (
        <RoomInfoModal roomName={roomName} roomId={roomId} isAdmin={isAdmin} roomPassword={roomPassword}
          onSetRoomPassword={handleSetRoomPassword} onClose={() => setRoomInfoOpen(false)} />
      )}
      {upiChooser && (
        <UpiAppChooserModal options={upiChooser}
          onSelect={(opt) => { window.location.href = opt.link; setUpiChooser(null); }}
          onClose={() => setUpiChooser(null)} />
      )}
      {confirmDeleteRoomOpen && (
        <ConfirmModal title="Delete this room?"
          message={`This permanently deletes "${roomName}" and all its data — members, deposits, payment history, and the ledger — for everyone. This can't be undone.`}
          confirmLabel={deletingRoom ? "Deleting…" : "Delete room"} danger busy={deletingRoom}
          onConfirm={confirmDeleteRoom} onClose={() => { if (!deletingRoom) setConfirmDeleteRoomOpen(false); }} />
      )}
      {toast && <CharacterNotification key={toast.key} message={toast.msg} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  );
}
