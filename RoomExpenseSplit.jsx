import React, { useState, useEffect, useCallback, useRef } from "react";
import { Home, Zap, ShoppingCart, Users, Wallet, Receipt } from "lucide-react";
import { CATEGORY_META, defaultState, T } from "./constants";
import {
  formatINR, normalizeState, totalCollected, uid, round2, netPaidBy,
  currentPeriod, periodLabel, applyMonthlyRollover, categoryBalance, categorySpent, nextOrderNo,
  startNewMonth as startNewMonthState,
} from "./utils";
import { AppBar, GlobalStyle, Aurora } from "./components/Shared";
import { Overview, MembersPanel, DepositPanel, GroceryPanel, LedgerPanel, ExpenseModal, ConfirmModal, SettingsModal, RoomInfoModal } from "./components/Panels";
import { CharacterNotification } from "./components/CharacterNotification";
import { subscribeRoom, saveRoomState, deleteRoom, transferAdmin, getRoomPassword, setRoomPassword as saveRoomPassword } from "./firebase";
import { isEmailConfigured, sendReminderEmail } from "./email";

export default function RoomExpenseSplit({ user, roomId, onLeave, onLogout, theme, onToggleTheme }) {
  const currentUserId = user.uid;

  const [state, setState] = useState(defaultState);
  const [meta, setMeta] = useState({ name: roomId, adminUid: null, adminName: "Admin" });
  const [roomPassword, setRoomPassword] = useState(null); // null = not fetched yet
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
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

  const emailOn = isEmailConfigured();
  const isAdmin = meta.adminUid === currentUserId;
  const roomName = meta.name;

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

  // Keyed so each call mounts a fresh CharacterNotification (resetting its
  // own internal auto-dismiss timer) even if the message text repeats.
  const showToast = (msg, tone = "default") => {
    setToast({ msg, tone, key: uid() });
  };

  const members = state.members;
  const adminName = meta.adminName;
  const memberName = (id) => members.find((m) => m.id === id)?.name || "Unknown";
  const perMemberShare = (cat) => { const c = members.length; return c ? (state.deposits[cat]?.total || 0) / c : 0; };
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
      for (const cat of Object.keys(prev.deposits)) deposits[cat] = { ...prev.deposits[cat], history: prev.deposits[cat].history.filter((h) => h.memberId !== id) };
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
    } catch {
      showToast("Couldn't hand off admin rights — try again", "danger");
    }
  };

  const currentMember = members.find((m) => m.id === currentUserId);

  const openSettings = () => setSettingsOpen(true);

  // Fetched on demand (not kept in the real-time room state) — Firestore
  // rules restrict rooms/{roomId}/secrets/main to members only.
  const openRoomInfo = () => {
    setRoomInfoOpen(true);
    getRoomPassword(roomId).then(setRoomPassword);
  };

  const updateProfile = (updates) => {
    updateState((prev) => ({
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

  const addPayment = (cat, memberId, rawIncrement) => {
    if (!isAdmin && memberId !== currentUserId) return showToast("You can only record your own payment", "danger");
    const share = perMemberShare(cat);
    if (share <= 0) return showToast(`Set the ${CATEGORY_META[cat].label.toLowerCase()} amount first`, "danger");
    const increment = parseFloat(rawIncrement);
    if (!Number.isFinite(increment) || increment <= 0) return showToast("Enter a valid amount", "danger");
    updateState((prev) => {
      const deposit = prev.deposits[cat];
      const current = netPaidBy(deposit, prev.transactions, cat, memberId);
      const clamped = round2(Math.min(increment, Math.max(0, share - current)));
      if (clamped <= 0) return prev;
      const entry = { id: uid(), memberId, amount: clamped, date: new Date().toISOString() };
      return { ...prev, deposits: { ...prev.deposits, [cat]: { ...deposit, history: [entry, ...deposit.history] } } };
    });
  };

  // If the admin lowers a total after members already paid the old share, this
  // books the resulting overpayment back to them as a ledger expense — same as
  // any other rent/electricity/grocery expense, just paid to a member instead
  // of the owner/government/store, so it shows in the Ledger with full history
  // and correctly reduces the category's available balance.
  const settleRefund = (cat, memberId) => {
    if (!isAdmin) return showToast("Only the admin can settle refunds", "danger");
    const deposit = state.deposits[cat];
    const share = members.length ? (deposit.total || 0) / members.length : 0;
    const credit = round2(Math.max(0, netPaidBy(deposit, state.transactions, cat, memberId) - share));
    if (credit <= 0) return showToast("Nothing to refund", "default");
    const entry = {
      id: uid(), category: cat, type: "refund", orderNo: nextOrderNo(state.transactions, cat),
      amount: credit, description: `Refund to ${memberName(memberId)}`, refundTo: memberId,
      date: new Date().toISOString(), period: state.period,
    };
    updateState((prev) => ({ ...prev, transactions: [entry, ...prev.transactions] }));
    showToast(`Refunded ${formatINR(credit)} to ${memberName(memberId)}`, "success");
  };

  const remindAll = async (cat) => {
    if (!isAdmin) return;
    if (!emailOn) return showToast("Email isn't set up yet — see the README", "danger");
    const share = perMemberShare(cat);
    const unpaid = state.members
      .map((m) => ({ member: m, due: Math.max(0, share - netPaidBy(state.deposits[cat], state.transactions, cat, m.id)) }))
      .filter((x) => x.due > 0.01);
    if (unpaid.length === 0) return showToast("Everyone has already paid", "default");
    const withEmail = unpaid.filter((x) => x.member.email);
    if (withEmail.length === 0) return showToast("None of the unpaid members have an email on file", "danger");
    showToast(`Sending reminders to ${withEmail.length} member${withEmail.length === 1 ? "" : "s"}…`);
    const results = await Promise.allSettled(
      withEmail.map((x) => sendReminderEmail({ member: x.member, roomName, adminName, category: CATEGORY_META[cat].label, amountDue: x.due }))
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    showToast(`Reminded ${sent}/${withEmail.length} member${withEmail.length === 1 ? "" : "s"}`, sent > 0 ? "success" : "danger");
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
  };

  const deleteTransaction = (id) => {
    if (!isAdmin) return showToast("Only the admin can edit expenses", "danger");
    updateState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
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
        onLeave={onLeave} onLogout={onLogout} onOpenSettings={openSettings} onOpenRoomInfo={openRoomInfo} theme={theme} onToggleTheme={onToggleTheme} />

      <nav className="rex-tabs-desktop"><div className="rex-tabs-desktop-inner">
        {TABS.map((t) => { const Icon = t.icon; const active = activeTab === t.id; return (
          <button key={t.id} className={"rex-tab" + (active ? " rex-tab-active" : "")} onClick={() => setActiveTab(t.id)}><Icon size={15} strokeWidth={2.2} />{t.label}</button>
        ); })}
      </div></nav>

      <main className="rex-container"><div className="rex-fade" key={activeTab}>
        {activeTab === "overview" && <Overview state={state} perMemberShare={perMemberShare} setActiveTab={setActiveTab} periodText={periodText} grocery={balanceStats("grocery")} />}
        {activeTab === "members" && <MembersPanel members={members} isAdmin={isAdmin} currentUserId={currentUserId} adminUid={meta.adminUid} roomId={roomId} removeMember={removeMember} makeAdmin={makeAdmin} />}
        {(activeTab === "rent" || activeTab === "electricity") && (
          <DepositPanel cat={activeTab} state={state} isAdmin={isAdmin} currentUserId={currentUserId} canEdit={canEditTotal()} lockReason={lockReason()} periodText={periodText}
            depositDrafts={depositDrafts} setDepositDrafts={setDepositDrafts} setDepositTotal={setDepositTotal} addPayment={addPayment} remindAll={remindAll} settleRefund={settleRefund}
            perMemberShare={perMemberShare(activeTab)} collected={collectedForCat(activeTab)} memberName={memberName} />
        )}
        {activeTab === "grocery" && (
          <GroceryPanel state={state} isAdmin={isAdmin} currentUserId={currentUserId} canEdit={canEditTotal()} lockReason={lockReason()} periodText={periodText}
            depositDrafts={depositDrafts} setDepositDrafts={setDepositDrafts} setDepositTotal={setDepositTotal} addPayment={addPayment} remindAll={remindAll} settleRefund={settleRefund}
            perMemberShare={perMemberShare("grocery")} collected={collectedForCat("grocery")} memberName={memberName} grocery={balanceStats("grocery")} />
        )}
        {activeTab === "ledger" && (
          <LedgerPanel state={state} isAdmin={isAdmin} balances={{ rent: balanceStats("rent"), electricity: balanceStats("electricity"), grocery: balanceStats("grocery") }}
            periodText={periodText} memberName={memberName} deleteTransaction={deleteTransaction}
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
          message={`${pendingMakeAdmin.name} will get full admin rights — setting bills, recording expenses, and managing members. You'll become a regular member and lose those rights.`}
          confirmLabel="Make admin" onConfirm={confirmMakeAdmin} onClose={() => setPendingMakeAdmin(null)} />
      )}
      {settingsOpen && currentMember && (
        <SettingsModal member={currentMember} email={user.email} onSave={updateProfile} onClose={() => setSettingsOpen(false)}
          isAdmin={isAdmin} onDeleteRoom={requestDeleteRoom} />
      )}
      {roomInfoOpen && (
        <RoomInfoModal roomName={roomName} roomId={roomId} isAdmin={isAdmin} roomPassword={roomPassword}
          onSetRoomPassword={handleSetRoomPassword} onClose={() => setRoomInfoOpen(false)} />
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
