import React, { useState } from "react";
import {
  Users, Plus, Trash2, Bell, Check, X, Receipt, ChevronRight, Lock, Crown, Mail, Info, RotateCcw, Eye, EyeOff, Pencil, ShoppingCart, Smartphone,
} from "lucide-react";
import { CATEGORY_META, MAX_DEPOSIT, MAX_DESC_LENGTH, T } from "../constants";
import { netPaidBy, formatINR, paymentBreakdown, depositMemberStatus, totalCollected, isValidMobile, isValidUpi, buildLedgerItems } from "../utils";
import { Avatar, ProgressBar, SectionHeading, StatusPill } from "./Shared";

function YouTag() {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color: T.rent, background: T.rentSoft, borderRadius: 20, padding: "2px 7px" }}>You</span>;
}

/* --------------------------------- Overview --------------------------------- */
export function Overview({ state, shares, setActiveTab, periodText, grocery }) {
  if (state.members.length === 0) {
    return (
      <div className="rex-card" style={{ textAlign: "center", padding: "44px 24px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: T.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Users size={24} color={T.primary} strokeWidth={2.2} />
        </div>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800 }}>Welcome to Room Split</h3>
        <p style={{ color: T.inkSoft, fontSize: 13.5, margin: 0, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
          Share your room ID and password so your roommates can join with their Gmail.
        </p>
      </div>
    );
  }
  const cats = ["rent", "electricity", "grocery"];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.inkSoft, fontWeight: 600 }}>
        <span style={{ background: T.subtleBg, border: `1px solid ${T.border}`, borderRadius: 20, padding: "5px 12px" }}>Current cycle · {periodText}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {cats.map((cat) => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const total = state.deposits[cat].total;
          const catShares = shares(cat);
          const collected = totalCollected(state.deposits[cat]);
          const fullyPaidCount = state.members.filter((m) => depositMemberStatus(state.deposits[cat], state.transactions, cat, m.id, catShares[m.id] || 0) === "paid").length;
          const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
          const allSettled = total > 0 && fullyPaidCount === state.members.length;
          return (
            <button key={cat} className="rex-card rex-card-hover" style={{
              textAlign: "left", cursor: "pointer", display: "block", position: "relative", overflow: "hidden",
              border: `1px solid ${meta.accent}2e`, background: `linear-gradient(150deg, ${meta.soft} 0%, ${T.surface} 60%)`,
            }} onClick={() => setActiveTab(cat)}>
              <div aria-hidden="true" style={{
                position: "absolute", top: -34, right: -34, width: 96, height: 96, borderRadius: "50%",
                background: meta.accent, opacity: 0.14, filter: "blur(2px)",
              }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, position: "relative" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(135deg, ${meta.accent}, ${meta.accent}cc)`, boxShadow: `0 8px 16px -6px ${meta.accent}80`,
                }}>
                  <Icon size={20} color="#fff" strokeWidth={2.3} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {allSettled ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, color: "#fff", background: meta.accent, borderRadius: 20, padding: "3px 9px" }}>
                      <Check size={10} strokeWidth={3} /> Settled
                    </span>
                  ) : total > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: meta.accent, background: T.surface, border: `1px solid ${meta.accent}44`, borderRadius: 20, padding: "3px 9px" }}>
                      {pct}%
                    </span>
                  )}
                  <ChevronRight size={16} color={T.muted} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
                {meta.full}{meta.monthly && <span style={{ fontSize: 10, fontWeight: 700, color: meta.accent, background: meta.soft, borderRadius: 20, padding: "1px 7px" }}>monthly</span>}
              </div>
              <div style={{ fontFamily: T.fontMono, fontSize: 22, fontWeight: 800, marginBottom: 9, color: T.ink, position: "relative" }}>{formatINR(total)}</div>
              <ProgressBar value={collected} total={total} color={meta.accent} />
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 7, position: "relative" }}>{fullyPaidCount}/{state.members.length} fully paid · {formatINR(collected)} collected</div>
            </button>
          );
        })}
      </div>
      <div className="rex-card" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", position: "relative", overflow: "hidden",
        border: `1px solid ${T.grocery}2e`, background: `linear-gradient(150deg, ${T.grocerySoft} 0%, ${T.surface} 60%)`,
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -34, right: -34, width: 96, height: 96, borderRadius: "50%", background: T.grocery, opacity: 0.14 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            background: `linear-gradient(135deg, ${T.grocery}, ${T.grocery}cc)`, boxShadow: `0 8px 16px -6px ${T.grocery}80`,
          }}>
            <ShoppingCart size={20} color="#fff" strokeWidth={2.3} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 700, marginBottom: 2 }}>Grocery balance available now</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 23, fontWeight: 800, color: grocery.balance < 0 ? T.danger : T.grocery }}>{formatINR(grocery.balance)}</div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, textAlign: "right", position: "relative" }}>
          {formatINR(grocery.carryover)} carried over<br />+ {formatINR(grocery.collected)} collected − {formatINR(grocery.spent)} spent
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Members ---------------------------------- */
export function MembersPanel({ members, isAdmin, currentUserId, adminUid, roomId, removeMember, makeAdmin }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SectionHeading icon={Users} color={T.primary} soft={T.primarySoft} title="Room members" subtitle="Deposits split evenly across everyone here" />
      <div className="rex-card" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={16} color={T.rent} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5 }}>
          Roommates join themselves from the login screen using room ID <b style={{ color: T.ink }}>{roomId}</b> and the password. Everyone signs in with their Gmail so reminders reach them.
        </div>
      </div>
      <div className="rex-card" style={{ padding: 8 }}>
        {members.map((m, i) => {
          const admin = m.id === adminUid || m.role === "admin";
          const you = m.id === currentUserId;
          return (
            <div key={m.id} className="rex-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", padding: "12px", borderRadius: 12, borderBottom: i === members.length - 1 ? "none" : `1px solid ${T.border}`, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <Avatar name={m.name} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>{m.name}</span>
                    {admin && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: T.warning, background: T.warningSoft, borderRadius: 20, padding: "2px 8px" }}><Crown size={11} strokeWidth={2.4} /> Admin</span>}
                    {you && <YouTag />}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.muted, display: "flex", alignItems: "center", gap: 5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Mail size={11} /> {m.email || "no email"}
                  </div>
                </div>
              </div>
              {isAdmin && !admin && !you && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button className="rex-btn rex-btn-ghost" onClick={() => makeAdmin(m.id, m.name)} style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                    <Crown size={13} /> Make Admin
                  </button>
                  <button onClick={() => removeMember(m.id, m.name)} aria-label={"Remove " + m.name} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 6, borderRadius: 8, flexShrink: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ deposit pieces ------------------------------ */
function DepositSetupCard({ meta, total, canEdit, lockReason, draft, setDraft, onSet, collected, fullyPaidCount, memberCount, perMemberShare, periodText, carryover }) {
  const Icon = meta.icon;
  const subtitle = memberCount > 0
    ? `${formatINR(perMemberShare)} per member · ${fullyPaidCount}/${memberCount} fully paid${meta.monthly ? " · " + periodText : ""}`
    : "Add members to enable splitting";
  const carryoverBadge = carryover > 0 ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: T.grocery, background: T.grocerySoft, borderRadius: 20, padding: "6px 12px", whiteSpace: "nowrap" }}>
      +{formatINR(carryover)} carried over
    </span>
  ) : null;
  return (
    <div className="rex-card">
      <SectionHeading icon={Icon} color={meta.accent} soft={meta.soft} title={meta.full} subtitle={subtitle} right={carryoverBadge} />
      {memberCount > 0 && total > 0 && <ProgressBar value={collected} total={total} color={meta.accent} />}

      {canEdit ? (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <input className="rex-input" style={{ flex: "1 1 140px" }} type="number" min="1" max={MAX_DEPOSIT} step="1" placeholder={total > 0 ? "Update total amount" : "Total deposit amount"}
            value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSet()} />
          <button className="rex-btn rex-btn-dark" onClick={onSet} disabled={!draft} style={{ opacity: draft ? 1 : 0.5, cursor: draft ? "pointer" : "not-allowed" }}>{total > 0 ? "Update" : "Set deposit"}</button>
        </div>
      ) : total > 0 ? (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.subtleBg, borderRadius: 10, padding: "12px 14px", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600, marginBottom: 2 }}>{formatINR(collected)} of {formatINR(total)} collected</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 22, fontWeight: 700 }}>{formatINR(total)}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.inkSoft, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "5px 10px" }}>
            <Lock size={11} strokeWidth={2.5} /> Locked
          </span>
        </div>
      ) : (
        <div style={{ marginTop: 16, background: T.subtleBg, borderRadius: 10, padding: "14px", display: "flex", gap: 8, alignItems: "center", color: T.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
          <Lock size={13} /> Not set yet — {lockReason || "waiting for the admin."}
        </div>
      )}
    </div>
  );
}

function MemberPaymentList({ cat, members, deposit, transactions, shares, onPayNow, onMarkPaid, onAdminMarkPaid, remindAll, isAdmin, currentUserId, settleRefund }) {
  const total = deposit.total || 0;
  const unpaidCount = total > 0 ? members.filter((m) => {
    const status = depositMemberStatus(deposit, transactions, cat, m.id, shares[m.id] || 0);
    return status === "pending" || status === "partial";
  }).length : 0;
  return (
    <div className="rex-card" style={{ padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px 6px" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft }}>Payment status</span>
        {isAdmin && unpaidCount > 0 && (
          <button className="rex-btn rex-btn-ghost" onClick={() => remindAll(cat)} style={{ display: "flex", alignItems: "center", gap: 5 }} title="Email a reminder to everyone who hasn't fully paid">
            <Bell size={13} /> Remind unpaid ({unpaidCount})
          </button>
        )}
      </div>
      {members.length === 0 ? (
        <div style={{ textAlign: "center", color: T.muted, fontSize: 13.5, padding: "20px 12px" }}>No members yet.</div>
      ) : total <= 0 ? (
        <div style={{ textAlign: "center", color: T.muted, fontSize: 13.5, padding: "20px 12px" }}>Waiting for the admin to set the amount.</div>
      ) : (
        members.map((m, i) => {
          const share = shares[m.id] || 0;
          const bd = paymentBreakdown(netPaidBy(deposit, transactions, cat, m.id), share);
          const status = depositMemberStatus(deposit, transactions, cat, m.id, share);
          const remaining = bd.remaining;
          const you = m.id === currentUserId;
          return (
            <div key={m.id} className="rex-row" style={{ padding: "12px", borderRadius: 12, borderBottom: i === members.length - 1 ? "none" : `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <Avatar name={m.name} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14.5, fontWeight: 600 }}>{m.name}</span>{you && <YouTag />}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                      <StatusPill status={status} />
                      <span style={{ fontFamily: T.fontMono, fontSize: 11.5, color: T.inkSoft }}>
                        {formatINR(bd.applied)} / {formatINR(share)}
                        {bd.credit > 0 && <span style={{ color: T.warning }}> · {formatINR(bd.credit)} refund due</span>}
                        {remaining > 0 && <span style={{ color: T.warning }}> · {formatINR(remaining)} left</span>}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {you && !isAdmin && (status === "pending" || status === "partial") && (
                    <>
                      <button className="rex-btn rex-btn-ghost" onClick={onPayNow} style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                        <Smartphone size={13} /> Pay Now
                      </button>
                      <button className="rex-btn" onClick={onMarkPaid} style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", background: T.primary, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
                        <Check size={13} /> I've Paid
                      </button>
                    </>
                  )}
                  {isAdmin && status !== "paid" && (
                    <button className="rex-btn" onClick={() => onAdminMarkPaid(m.id)} title={status === "pending_verification" ? "Confirm this member's payment" : `Mark the full ${formatINR(remaining)} as paid`} style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", background: T.success, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
                      <Check size={13} strokeWidth={2.6} /> Mark as Paid
                    </button>
                  )}
                  {status === "paid" && bd.credit > 0 && isAdmin && (
                    <button className="rex-btn rex-btn-ghost" onClick={() => settleRefund(cat, m.id)} title="Book this refund as a ledger expense" style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                      <RotateCcw size={13} strokeWidth={2.6} /> Refund {formatINR(bd.credit)}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 8 }}><ProgressBar value={bd.applied} total={share} color={status === "paid" ? T.success : T.warning} /></div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function DepositPanel({ cat, state, isAdmin, currentUserId, canEdit, lockReason, periodText, depositDrafts, setDepositDrafts, setDepositTotal, onPayNow, onMarkPaid, onAdminMarkPaid, remindAll, settleRefund, perMemberShare, shares, collected }) {
  const meta = CATEGORY_META[cat];
  const deposit = state.deposits[cat];
  const fullyPaidCount = state.members.filter((m) => depositMemberStatus(deposit, state.transactions, cat, m.id, shares[m.id] || 0) === "paid").length;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <DepositSetupCard meta={meta} total={deposit.total} canEdit={canEdit} lockReason={lockReason}
        draft={depositDrafts[cat]} setDraft={(v) => setDepositDrafts((d) => ({ ...d, [cat]: v }))} onSet={() => setDepositTotal(cat)}
        collected={collected} fullyPaidCount={fullyPaidCount} memberCount={state.members.length} perMemberShare={perMemberShare} periodText={periodText} />
      <MemberPaymentList cat={cat} members={state.members} deposit={deposit} transactions={state.transactions} shares={shares}
        onPayNow={onPayNow} onMarkPaid={onMarkPaid} onAdminMarkPaid={onAdminMarkPaid} remindAll={remindAll} isAdmin={isAdmin} currentUserId={currentUserId} settleRefund={settleRefund} />
    </div>
  );
}

export function GroceryPanel({ state, isAdmin, currentUserId, canEdit, lockReason, periodText, depositDrafts, setDepositDrafts, setDepositTotal, onPayNow, onMarkPaid, onAdminMarkPaid, remindAll, settleRefund, perMemberShare, shares, collected, grocery }) {
  const meta = CATEGORY_META.grocery;
  const deposit = state.deposits.grocery;
  const fullyPaidCount = state.members.filter((m) => depositMemberStatus(deposit, state.transactions, "grocery", m.id, shares[m.id] || 0) === "paid").length;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <DepositSetupCard meta={meta} total={deposit.total} canEdit={canEdit} lockReason={lockReason}
        draft={depositDrafts.grocery} setDraft={(v) => setDepositDrafts((d) => ({ ...d, grocery: v }))} onSet={() => setDepositTotal("grocery")}
        collected={collected} fullyPaidCount={fullyPaidCount} memberCount={state.members.length} perMemberShare={perMemberShare} periodText={periodText} carryover={grocery.carryover} />
      <MemberPaymentList cat="grocery" members={state.members} deposit={deposit} transactions={state.transactions} shares={shares}
        onPayNow={onPayNow} onMarkPaid={onMarkPaid} onAdminMarkPaid={onAdminMarkPaid} remindAll={remindAll} isAdmin={isAdmin} currentUserId={currentUserId} settleRefund={settleRefund} />
    </div>
  );
}

/* ---------------------------------- Ledger ---------------------------------- */
export function LedgerPanel({ state, isAdmin, balances, periodText, memberName, deleteTransaction, deleteDepositPayment, openExpenseModal, onStartNewMonth }) {
  const cats = ["rent", "electricity", "grocery"];
  const items = buildLedgerItems(state);
  const handleDelete = (item) => (item.kind === "received" ? deleteDepositPayment(item.category, item.id) : deleteTransaction(item.id));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="rex-card">
        <div className="rex-panel-header" style={{ marginBottom: 14 }}>
          <SectionHeading icon={Receipt} color={T.primary} soft={T.primarySoft} title="Ledger" subtitle={`Payments received, expenses, and refunds · ${periodText}`} />
          {isAdmin ? (
            <div className="rex-panel-actions">
              <button className="rex-btn rex-btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }} title="Reset electricity + grocery for a new month, carrying over the grocery balance" onClick={onStartNewMonth}>
                <RotateCcw size={15} /> Start new month
              </button>
              <button className="rex-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.primary, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, padding: "10px 18px", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }} onClick={openExpenseModal}>
                <Plus size={16} /> Record expense
              </button>
            </div>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.inkSoft, background: T.subtleBg, border: `1px solid ${T.border}`, borderRadius: 20, padding: "8px 12px", alignSelf: "flex-start" }}>
              <Crown size={13} color={T.warning} /> Admin records expenses
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {cats.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const b = balances[cat];
            const depositTotal = state.deposits[cat].total;
            return (
              <div key={cat} style={{ flex: "1 1 150px", background: T.subtleBg, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon size={13} color={meta.accent} strokeWidth={2.2} />
                  <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>{meta.label} balance</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 16, fontWeight: 700, color: b.balance < 0 ? T.danger : T.ink }}>{formatINR(b.balance)}</span>
                  <span style={{ fontFamily: T.fontMono, fontSize: 11.5, color: T.muted }}>/ {formatINR(depositTotal)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                  available of {formatINR(depositTotal)} set by admin{cat === "grocery" && b.carryover > 0 ? ` (incl. ${formatINR(b.carryover)} carried over)` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rex-card">
        {items.length === 0 ? (
          <div style={{ textAlign: "center", color: T.muted, fontSize: 13.5, padding: "20px 0" }}>Nothing recorded yet.</div>
        ) : (
          <div>
            {items.map((t, i) => {
              const meta = CATEGORY_META[t.category] || CATEGORY_META.grocery;
              const isRefund = t.kind === "refund";
              const isReceived = t.kind === "received";
              const Icon = isRefund ? RotateCcw : meta.icon;
              const badgeColor = isReceived ? T.success : isRefund ? T.warning : meta.accent;
              const badgeSoft = isReceived ? T.successSoft : isRefund ? T.warningSoft : meta.soft;
              const title = isReceived ? memberName(t.memberId) : t.description;
              const subtitle = isReceived
                ? `${meta.label} · Payment received · ${new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                : `${meta.label} · ${isRefund ? `Refunded to ${memberName(t.refundTo)}` : `Paid by ${memberName(t.paidBy)}`} · ${new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
              return (
                <div key={t.id} className="rex-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 6px", borderBottom: i === items.length - 1 ? "none" : `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: badgeSoft, color: badgeColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, fontFamily: T.fontMono }}>
                      {isReceived ? <Check size={14} /> : isRefund ? <RotateCcw size={14} /> : "#" + t.orderNo}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                      <div style={{ fontSize: 11.5, color: T.muted, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                        <Icon size={11} color={badgeColor} /> {subtitle}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 700, color: isReceived ? T.success : isRefund ? T.warning : T.danger }}>
                      {isReceived ? "+" : "-"}{formatINR(t.amount)}
                    </span>
                    {isAdmin && (
                      <button onClick={() => handleDelete(t)} aria-label={isReceived ? "Delete payment" : isRefund ? "Delete refund" : "Delete expense"} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Confirm modal ------------------------------ */
export function ConfirmModal({ title, message, confirmLabel = "Confirm", danger, busy, onConfirm, onClose }) {
  return (
    <div className="rex-modal-overlay" onClick={onClose}>
      <div className="rex-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: T.subtleBg, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.inkSoft }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="rex-btn rex-btn-ghost" style={{ flex: 1, padding: "12px 18px", fontSize: 14 }} onClick={onClose} disabled={busy}>Cancel</button>
          <button className="rex-btn" style={{ flex: 1, padding: "12px 18px", fontSize: 14, border: "none", borderRadius: 10, fontWeight: 700, background: danger ? T.danger : T.primary, color: "#fff", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- UPI app chooser modal --------------------------- */
// iOS has no OS-level disambiguation for a shared "upi://" scheme, so instead
// of a blind redirect we let the member pick which installed app to open —
// each option links via that app's own unambiguous scheme (see UPI_APPS).
export function UpiAppChooserModal({ options, onSelect, onClose }) {
  return (
    <div className="rex-modal-overlay" onClick={onClose}>
      <div className="rex-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Pay with</div>
          <button onClick={onClose} aria-label="Close" style={{ background: T.subtleBg, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.inkSoft }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
          Choose the UPI app to pay with — iOS can't auto-detect this the way Android does.
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {options.map((opt) => (
            <button key={opt.id} className="rex-btn rex-btn-ghost" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", fontSize: 14.5, fontWeight: 700 }} onClick={() => onSelect(opt)}>
              <Smartphone size={16} /> {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Settings modal ------------------------------ */
export function SettingsModal({ member, email, onSave, onClose, isAdmin, onDeleteRoom, requireUpi }) {
  const [name, setName] = useState(member.name || "");
  const [gender, setGender] = useState(member.gender || "");
  const [mobile, setMobile] = useState(member.mobile || "");
  const [upiId, setUpiId] = useState(member.upiId || "");
  const [attempted, setAttempted] = useState(false);
  const nameValid = name.trim().length > 0;
  const mobileValid = !mobile || isValidMobile(mobile);
  const upiValid = isValidUpi(upiId);
  const canSubmit = nameValid && mobileValid && upiValid;
  const handleSubmit = () => {
    if (!canSubmit) { setAttempted(true); return; }
    onSave({ name: name.trim(), gender, mobile: mobile.trim(), upiId: upiId.trim() });
  };
  const handleClose = () => { if (!requireUpi) onClose(); };
  return (
    <div className="rex-modal-overlay" onClick={handleClose}>
      <div className="rex-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>My details</div>
          {!requireUpi && (
            <button onClick={onClose} aria-label="Close" style={{ background: T.subtleBg, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.inkSoft }}><X size={16} /></button>
          )}
        </div>
        {requireUpi && (
          <div style={{ fontSize: 13, color: T.inkSoft, background: T.subtleBg, borderRadius: 10, padding: "10px 12px", marginBottom: 14, lineHeight: 1.5 }}>
            Add your UPI ID to continue — it's needed so other members can pay you back.
          </div>
        )}
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Name *</label>
            <input className="rex-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ borderColor: attempted && !nameValid ? T.danger : undefined }} />
            {attempted && !nameValid && <div style={{ color: T.danger, fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>Enter your name.</div>}
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Email</label>
            <input className="rex-input" value={email || ""} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Gender</label>
            <select className="rex-input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Mobile number</label>
            <input className="rex-input" type="tel" placeholder="10-digit mobile number" value={mobile} maxLength={10}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ borderColor: attempted && !mobileValid ? T.danger : undefined }} />
            {attempted && !mobileValid && <div style={{ color: T.danger, fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>Enter a valid 10-digit mobile number.</div>}
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>UPI ID *</label>
            <input className="rex-input" placeholder="yourname@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ borderColor: attempted && !upiValid ? T.danger : undefined }} />
            {attempted && !upiValid && <div style={{ color: T.danger, fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>Enter a valid UPI ID (e.g. name@bank).</div>}
          </div>
          <button className="rex-btn" style={{ marginTop: 4, padding: "13px 18px", fontSize: 15, border: "none", borderRadius: 10, fontWeight: 700, background: T.primary, color: "#fff", cursor: "pointer" }} onClick={handleSubmit}>
            Save details
          </button>

          {isAdmin && (
            <div style={{ marginTop: 10, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.danger, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Danger zone</div>
              <button className="rex-btn rex-btn-ghost" onClick={onDeleteRoom} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: T.danger, borderColor: "rgba(255,100,112,0.35)" }}>
                <Trash2 size={14} /> Delete this room
              </button>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>Permanently deletes the room for every member. This can't be undone.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Room info modal ------------------------------ */
export function RoomInfoModal({ roomName, roomId, isAdmin, roomPassword, onSetRoomPassword, onClose }) {
  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftPassword, setDraftPassword] = useState("");
  const [pwAttempted, setPwAttempted] = useState(false);
  // A room with no password stored yet always shows the set-password form —
  // there's nothing to fall back to, so "editing" is effectively forced on.
  const editMode = editing || (roomPassword === "" && isAdmin);
  const pwValid = draftPassword.length >= 4;
  const startEdit = () => { setDraftPassword(""); setPwAttempted(false); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraftPassword(""); setPwAttempted(false); };
  const handleSavePassword = () => {
    if (!pwValid) { setPwAttempted(true); return; }
    onSetRoomPassword(draftPassword);
    setEditing(false);
  };
  return (
    <div className="rex-modal-overlay" onClick={onClose}>
      <div className="rex-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Room info</div>
          <button onClick={onClose} aria-label="Close" style={{ background: T.subtleBg, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.inkSoft }}><X size={16} /></button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Room name</label>
            <input className="rex-input" value={roomName} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Room ID</label>
            <input className="rex-input" value={roomId} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Room password</label>
            {roomPassword === null ? (
              <div style={{ fontSize: 12.5, color: T.muted, background: T.subtleBg, borderRadius: 10, padding: "10px 12px" }}>Loading…</div>
            ) : editMode ? (
              <div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="rex-input" type="text" placeholder={roomPassword ? "New room password" : "Set the room password"} value={draftPassword} maxLength={64}
                    onChange={(e) => setDraftPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSavePassword()}
                    style={{ borderColor: pwAttempted && !pwValid ? T.danger : undefined }} />
                  <button className="rex-btn rex-btn-dark" onClick={handleSavePassword} disabled={!draftPassword} style={{ opacity: draftPassword ? 1 : 0.5, cursor: draftPassword ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>Save</button>
                  {roomPassword && (
                    <button className="rex-btn rex-btn-ghost" onClick={cancelEdit} style={{ whiteSpace: "nowrap" }}>Cancel</button>
                  )}
                </div>
                {pwAttempted && !pwValid && <div style={{ color: T.danger, fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>Use at least 4 characters.</div>}
                <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>
                  {roomPassword
                    ? "Existing members won't need this again — only new joiners will need the updated password."
                    : "This room was created before passwords were made visible here. Enter the password you've been sharing with roommates to store it (or set a new one — existing members won't need it again, only new joiners will)."}
                </div>
              </div>
            ) : roomPassword ? (
              <div style={{ position: "relative" }}>
                <input className="rex-input" type={showPassword ? "text" : "password"} value={roomPassword} readOnly style={{ paddingRight: isAdmin ? 74 : 42 }} />
                <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide room password" : "Show room password"}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 8, display: "flex", alignItems: "center" }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {isAdmin && (
                    <button type="button" onClick={startEdit} aria-label="Edit room password"
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 8, display: "flex", alignItems: "center" }}>
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: T.muted, background: T.subtleBg, borderRadius: 10, padding: "10px 12px" }}>Not available — ask your admin.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Expense modal ------------------------------ */
export function ExpenseModal({ members, category, setCategory, amount, setAmount, description, setDescription, paidBy, setPaidBy, balances, addExpense, onClose }) {
  const [attempted, setAttempted] = useState(false);
  const meta = CATEGORY_META[category];
  const balance = balances[category];
  const amt = parseFloat(amount) || 0;
  const willExceed = amt > balance;
  const descMissing = !description.trim();
  const paidByMissing = !paidBy;
  const canSubmit = amt > 0 && !willExceed && !descMissing && !paidByMissing;
  const handleSubmit = () => { if (!canSubmit) { setAttempted(true); return; } addExpense(); };
  return (
    <div className="rex-modal-overlay" onClick={onClose}>
      <div className="rex-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Record an expense</div>
          <button onClick={onClose} aria-label="Close" style={{ background: T.subtleBg, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.inkSoft }}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Type of expense *</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["rent", "electricity", "grocery"].map((cat) => {
            const m = CATEGORY_META[cat];
            const Icon = m.icon;
            const active = category === cat;
            return (
              <button key={cat} onClick={() => setCategory(cat)} type="button" style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 6px", borderRadius: 12,
                border: active ? `2px solid ${m.accent}` : "1.5px solid rgba(var(--rex-wash-rgb),0.14)", background: active ? m.soft : "rgba(var(--rex-wash-rgb),0.03)", cursor: "pointer",
              }}>
                <Icon size={16} color={m.accent} strokeWidth={2.2} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? m.accent : T.inkSoft }}>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ background: meta.soft, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: meta.accent }}>Available balance</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 15, fontWeight: 700, color: meta.accent }}>{formatINR(balance)}</span>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Paid by *</label>
            <select className="rex-input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} style={{ borderColor: attempted && paidByMissing ? T.danger : undefined }}>
              <option value="">Select who paid</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {attempted && paidByMissing && <div style={{ color: T.danger, fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>Choose who paid.</div>}
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>Amount *</label>
            <input className="rex-input" type="number" min="0.01" step="0.01" max={balance > 0 ? balance : undefined} placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} style={{ borderColor: attempted && !(amt > 0) ? T.danger : undefined }} />
            {attempted && !(amt > 0) && <div style={{ color: T.danger, fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>Enter an amount greater than ₹0.</div>}
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 6 }}>What was it for? *</label>
            <input className="rex-input" placeholder={meta.notePlaceholder} value={description} maxLength={MAX_DESC_LENGTH}
              onChange={(e) => setDescription(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} style={{ borderColor: attempted && descMissing ? T.danger : undefined }} />
            {attempted && descMissing && <div style={{ color: T.danger, fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>Add a short note.</div>}
          </div>

          {willExceed && amt > 0 && (
            <div style={{ background: T.dangerSoft, color: T.danger, fontSize: 12.5, fontWeight: 600, padding: "9px 12px", borderRadius: 10 }}>
              This exceeds the available balance of {formatINR(balance)} — reduce the amount.
            </div>
          )}

          <button className="rex-btn" style={{ marginTop: 4, padding: "13px 18px", fontSize: 15, border: "none", borderRadius: 10, fontWeight: 700, background: canSubmit ? T.primary : T.border, color: canSubmit ? "#fff" : T.muted, cursor: "pointer" }} onClick={handleSubmit}>
            Add expense
          </button>
        </div>
      </div>
    </div>
  );
}
