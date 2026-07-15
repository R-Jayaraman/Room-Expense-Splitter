import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock, LogOut, Crown, DoorOpen, Settings, Sun, Moon, Bell, X } from "lucide-react";
import { T } from "../constants";
import { colorForName } from "../utils";

function timeAgo(value) {
  const date = value && typeof value.toDate === "function" ? value.toDate() : new Date(value);
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  return Math.floor(hours / 24) + "d ago";
}

// Bell icon + inbox for the per-user notification feed (see firebase.js's
// subscribeNotifications) — this is what payment reminders and admin-change
// alerts show up as now that email has been retired in favor of one unified
// in-app (and push, on the native app) channel.
//
// Opens using the exact same overlay + bottom-sheet pattern as every other
// modal in the app (rex-modal-overlay/rex-modal-sheet — see SettingsModal,
// ConfirmModal, RoomInfoModal), rendered via a portal into document.body.
// An earlier version tried to position a small dropdown from the bell
// button's own bounding rect, which the app bar's `overflow: hidden` (for
// its background blob animation) clipped/misaligned depending on layout —
// the full-screen modal sidesteps all of that positioning math entirely.
function NotificationBell({ notifications, onMarkAllRead, onClearAll }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read);

  // Opening the panel is the "read" action — no separate button needed.
  // Matches how a normal notification tray behaves (and how Settings has no
  // extra "acknowledge" step, just clean fields), so all rows render the
  // same plain/transparent way instead of highlighting an "unread" state.
  const openPanel = () => {
    setOpen(true);
    if (unread.length > 0) onMarkAllRead(unread.map((n) => n.id));
  };

  return (
    <>
      <button className="rex-theme-toggle" onClick={openPanel} aria-label="Notifications" title="Notifications" style={{ position: "relative" }}>
        <Bell size={16} strokeWidth={2.2} />
        {unread.length > 0 && (
          <span style={{ position: "absolute", top: 3, right: 3, minWidth: 14, height: 14, borderRadius: 7, background: T.danger, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && createPortal(
        <div className="rex-modal-overlay" onClick={() => setOpen(false)}>
          <div className="rex-modal-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: "22px 0 calc(22px + env(safe-area-inset-bottom, 0px))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 14px" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>Notifications</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {notifications.length > 0 && (
                  <button onClick={() => onClearAll(notifications.map((n) => n.id))} style={{ background: "none", border: "none", color: T.primary, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    Clear all
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: T.subtleBg, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.inkSoft, flexShrink: 0 }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: T.muted }}>No notifications yet</div>
            ) : (
              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {notifications.map((n) => (
                  <div key={n.id} style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.4 }}>{n.body}</div>
                    {n.createdAt && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>{timeAgo(n.createdAt)}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Faint ₹ coins that drift up behind the frosted glass, matching the landing.
const AURORA_COINS = [
  { left: 8, size: 30, delay: 0, dur: 15, color: "#F2670D" },
  { left: 26, size: 22, delay: 4, dur: 19, color: "#E2461A" },
  { left: 45, size: 34, delay: 8, dur: 14, color: "#2FAE68" },
  { left: 63, size: 24, delay: 2, dur: 18, color: "#F5A623" },
  { left: 80, size: 28, delay: 6, dur: 16, color: "#C97C1F" },
  { left: 93, size: 20, delay: 10, dur: 20, color: "#FF8A3D" },
];

// Orange sparkles that twinkle/drift across every tab, behind the content.
const AURORA_SPARKLES = [
  { top: 10, left: 15, size: 11, delay: 0, dur: 3.4 },
  { top: 22, left: 78, size: 8, delay: 1.2, dur: 2.8 },
  { top: 40, left: 35, size: 9, delay: 0.6, dur: 3.1 },
  { top: 55, left: 90, size: 7, delay: 2.0, dur: 2.6 },
  { top: 68, left: 8, size: 8, delay: 1.6, dur: 3.6 },
  { top: 78, left: 55, size: 10, delay: 0.3, dur: 2.9 },
  { top: 30, left: 60, size: 7, delay: 2.5, dur: 3.2 },
  { top: 90, left: 30, size: 9, delay: 1.0, dur: 3.0 },
];

const GLASS_VARS = {
  "--rex-bg": "#F6F6F7",
  "--rex-bg-translucent": "rgba(246,246,247,0.85)",
  "--rex-subtle-bg": "rgba(20,18,16,0.045)",
  "--rex-surface": "#FFFFFF",
  "--rex-ink": "#1A1815",
  "--rex-ink-soft": "rgba(26,24,21,0.74)",
  "--rex-muted": "rgba(26,24,21,0.58)",
  "--rex-border": "rgba(20,18,16,0.12)",
  "--rex-border-strong": "rgba(20,18,16,0.24)",
  "--rex-shell-text": "#1A1815",
  "--rex-shell-text-muted": "rgba(26,24,21,0.68)",
  "--rex-shell-hairline": "rgba(20,18,16,0.10)",
  "--rex-shell-shadow": "rgba(20,18,16,0.10)",
  "--rex-row-hover": "rgba(242,103,13,0.05)",
  "--rex-modal-overlay": "rgba(20,16,12,0.4)",
  "--rex-avatar-ring-bg": "rgba(20,18,16,0.10)",
  "--rex-card-hover-shadow": "rgba(20,18,16,0.10)",
  "--rex-primary": "#F2670D",
  "--rex-primary-soft": "rgba(242,103,13,0.14)",
  "--rex-rent": "#8B72E0",
  "--rex-rent-soft": "rgba(139,114,224,0.14)",
  "--rex-power": "#F0A63C",
  "--rex-power-soft": "rgba(240,166,60,0.16)",
  "--rex-grocery": "#2FAE68",
  "--rex-grocery-soft": "rgba(47,174,104,0.14)",
  "--rex-success": "#2FAE68",
  "--rex-success-soft": "rgba(47,174,104,0.14)",
  "--rex-warning": "#F0A63C",
  "--rex-warning-soft": "rgba(240,166,60,0.16)",
  "--rex-danger": "#E23744",
  "--rex-danger-soft": "rgba(226,55,68,0.12)",
  "--rex-wash-rgb": "36,26,18",
  "--rex-btn-dark-bg": "#241A12",
  "--rex-btn-dark-bg-hover": "#3A2A1C",
  "--rex-aurora-blend": "multiply",
};

// Dark palette — only the surface/ink/chrome tokens change; brand/category
// accent hues (primary, rent, power, grocery, success, warning, danger) stay
// the same so the app still reads as itself, just with dark surfaces and
// light text. Soft/tint variants get a bit more opacity since they now sit
// on a dark card instead of white.
const DARK_GLASS_VARS = {
  "--rex-bg": "#17120D",
  "--rex-bg-translucent": "rgba(23,18,13,0.85)",
  "--rex-subtle-bg": "rgba(255,255,255,0.05)",
  "--rex-surface": "#241C15",
  "--rex-ink": "#F5EFE6",
  "--rex-ink-soft": "rgba(245,239,230,0.76)",
  "--rex-muted": "rgba(245,239,230,0.56)",
  "--rex-border": "rgba(255,255,255,0.12)",
  "--rex-border-strong": "rgba(255,255,255,0.22)",
  "--rex-shell-text": "#F5EFE6",
  "--rex-shell-text-muted": "rgba(245,239,230,0.72)",
  "--rex-shell-hairline": "rgba(255,255,255,0.10)",
  "--rex-shell-shadow": "rgba(0,0,0,0.4)",
  "--rex-row-hover": "rgba(242,103,13,0.12)",
  "--rex-modal-overlay": "rgba(0,0,0,0.6)",
  "--rex-avatar-ring-bg": "rgba(255,255,255,0.14)",
  "--rex-card-hover-shadow": "rgba(0,0,0,0.5)",
  "--rex-primary": "#FF8A3D",
  "--rex-primary-soft": "rgba(255,138,61,0.22)",
  "--rex-rent": "#A794F0",
  "--rex-rent-soft": "rgba(167,148,240,0.22)",
  "--rex-power": "#F5B85C",
  "--rex-power-soft": "rgba(245,184,92,0.22)",
  "--rex-grocery": "#4FCB86",
  "--rex-grocery-soft": "rgba(79,203,134,0.2)",
  "--rex-success": "#4FCB86",
  "--rex-success-soft": "rgba(79,203,134,0.2)",
  "--rex-warning": "#F5B85C",
  "--rex-warning-soft": "rgba(245,184,92,0.22)",
  "--rex-danger": "#FF6B7A",
  "--rex-danger-soft": "rgba(255,107,122,0.2)",
  "--rex-wash-rgb": "247,240,230",
  "--rex-btn-dark-bg": "#3D2E20",
  "--rex-btn-dark-bg-hover": "#4C3A28",
  "--rex-aurora-blend": "screen",
};

function cssVarsBlock(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(" ");
}

export function Aurora() {
  return (
    <>
      <div className="rex-aurora" aria-hidden="true">
        <div className="b b1" /><div className="b b2" /><div className="b b3" /><div className="b b4" />
      </div>
      <div className="rex-coins" aria-hidden="true">
        {AURORA_COINS.map((c, i) => (
          <div key={i} className="rex-coin" style={{
            left: c.left + "%", width: c.size, height: c.size, fontSize: c.size * 0.5,
            background: `radial-gradient(circle at 35% 30%, #ffffff66, ${c.color})`,
            animationDelay: c.delay + "s", animationDuration: c.dur + "s",
          }}>₹</div>
        ))}
      </div>
      <div className="rex-orange-sparkles" aria-hidden="true">
        {AURORA_SPARKLES.map((s, i) => (
          <Sparkle key={i} size={s.size} className="rex-orange-sparkle" style={{
            top: s.top + "%", left: s.left + "%", animationDelay: s.delay + "s", animationDuration: s.dur + "s",
          }} />
        ))}
      </div>
    </>
  );
}

export function GlobalStyle() {
  return (
    <style>{`
      /* Theme variables live on :root (not just .rex-app) so anything
         portaled straight into document.body — like the notification
         panel, which has to escape the app bar's overflow:hidden — can
         still resolve var(--rex-surface) etc. instead of falling back to
         transparent/unstyled. */
      :root { ${cssVarsBlock(GLASS_VARS)} }
      [data-theme="dark"] { ${cssVarsBlock(DARK_GLASS_VARS)} }
      .rex-app { position: relative; min-height: 100vh; background: var(--rex-bg); transition: background 0.2s ease; }
      .rex-app * { box-sizing: border-box; }

      .rex-aurora { position: fixed; inset: -25%; z-index: 0; filter: blur(72px); opacity: 0.16; pointer-events: none; }
      .rex-aurora .b { position: absolute; border-radius: 50%; mix-blend-mode: var(--rex-aurora-blend, multiply); }
      .rex-aurora .b1 { width: 46vw; height: 46vw; background: #F2670D; top: -6%; left: -6%; animation: rex-drift1 20s ease-in-out infinite; }
      .rex-aurora .b2 { width: 40vw; height: 40vw; background: #E2461A; top: 6%; right: -8%; animation: rex-drift2 24s ease-in-out infinite; }
      .rex-aurora .b3 { width: 44vw; height: 44vw; background: #2FAE68; bottom: -14%; left: 14%; animation: rex-drift3 22s ease-in-out infinite; }
      .rex-aurora .b4 { width: 30vw; height: 30vw; background: #F5A623; bottom: 0; right: 8%; animation: rex-drift1 28s ease-in-out infinite; }
      @keyframes rex-drift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,8%) scale(1.15); } }
      @keyframes rex-drift2 { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(-8%,6%) scale(0.9); } }
      @keyframes rex-drift3 { 0%,100% { transform: translate(0,0) scale(0.95); } 50% { transform: translate(5%,-7%) scale(1.12); } }
      .rex-coins { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
      .rex-coin { position: absolute; bottom: -60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; opacity: 0; box-shadow: inset 0 2px 6px rgba(255,255,255,0.3); animation: rex-rise linear infinite; }
      @keyframes rex-rise { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 12% { opacity: 0.32; } 88% { opacity: 0.32; } 100% { transform: translateY(-112vh) rotate(220deg); opacity: 0; } }

      .rex-orange-sparkles { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
      .rex-orange-sparkle { position: absolute; color: var(--rex-primary); opacity: 0; animation: rex-orange-sparkle-twinkle ease-in-out infinite; }
      @keyframes rex-orange-sparkle-twinkle { 0%, 100% { opacity: 0; transform: translateY(6px) scale(0.6) rotate(0deg); } 50% { opacity: 0.55; transform: translateY(-8px) scale(1) rotate(25deg); } }

      .rex-spinner { width: 26px; height: 26px; border-radius: 50%; margin: 0 auto; border: 3px solid var(--rex-border); border-top-color: var(--rex-rent); animation: rex-spin 0.7s linear infinite; }
      @keyframes rex-spin { to { transform: rotate(360deg); } }
      @keyframes rex-fadeup { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes rex-sheetup { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes rex-scalein { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      .rex-fade { animation: rex-fadeup 0.3s ease; }

      .rex-container { max-width: 900px; margin: 0 auto; padding: 20px 20px 100px; position: relative; z-index: 1; }
      @media (min-width: 768px) { .rex-container { padding: 24px 24px 60px; } }

      .rex-panel-header { display: flex; flex-direction: column; align-items: stretch; gap: 12px; }
      @media (min-width: 640px) { .rex-panel-header { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; } }
      .rex-panel-actions { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
      @media (max-width: 639px) { .rex-panel-actions button { flex: 1 1 auto; justify-content: center; } }

      .rex-appbar { position: sticky; top: 0; z-index: 20; overflow: hidden; background: linear-gradient(120deg, #F2670D 0%, #FF8A3D 100%); box-shadow: 0 2px 14px rgba(230,90,0,0.28); }
      .rex-appbar-inner { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 38px 14px 16px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; }
      @media (min-width: 640px) { .rex-appbar-inner { gap: 12px; } }
      @media (min-width: 768px) { .rex-appbar-inner { padding: 40px 24px 18px; } }
      .rex-appbar-brand { flex-shrink: 1; min-width: 0; }
      .rex-appbar-right { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; justify-content: flex-end; flex-shrink: 0; width: auto; height: 36px; }

      .rex-appbar-sparkles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
      .rex-appbar-sparkle { position: absolute; color: #fff; opacity: 0; animation: rex-appbar-sparkle-drift ease-in-out infinite; }
      @keyframes rex-appbar-sparkle-drift { 0%, 100% { opacity: 0; transform: translateY(4px) scale(0.6) rotate(0deg); } 50% { opacity: 0.85; transform: translateY(-4px) scale(1) rotate(20deg); } }

      /* soft blurred "juice" swirls drifting behind the bar content */
      .rex-appbar-juice { position: absolute; inset: -40% 0; overflow: hidden; pointer-events: none; mix-blend-mode: soft-light; }
      .rex-juice-blob { position: absolute; border-radius: 50%; filter: blur(18px); }
      .rex-juice-blob-1 { width: 220px; height: 220px; left: -8%; top: 10%; background: rgba(255,214,120,0.55); animation: rex-juice-flow-1 9s ease-in-out infinite; }
      .rex-juice-blob-2 { width: 180px; height: 180px; left: 38%; top: -20%; background: rgba(255,150,40,0.45); animation: rex-juice-flow-2 11s ease-in-out infinite; }
      .rex-juice-blob-3 { width: 200px; height: 200px; right: -6%; top: 6%; background: rgba(255,225,150,0.4); animation: rex-juice-flow-1 13s ease-in-out infinite reverse; }
      @keyframes rex-juice-flow-1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(6%, 4%) scale(1.12); } }
      @keyframes rex-juice-flow-2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-5%, 6%) scale(0.92); } }

      /* small translucent "pulp" bits drifting left-to-right across the bar */
      .rex-appbar-pulp { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
      .rex-pulp-bit { position: absolute; border-radius: 50%; background: rgba(255,240,210,0.8); filter: blur(0.5px); opacity: 0; animation: rex-pulp-drift linear infinite; }
      @keyframes rex-pulp-drift {
        0% { transform: translateX(-24px) translateY(0); opacity: 0; }
        10% { opacity: 0.75; }
        90% { opacity: 0.75; }
        100% { transform: translateX(calc(100vw + 24px)) translateY(-6px); opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .rex-appbar-sparkle, .rex-juice-blob-1, .rex-juice-blob-2, .rex-juice-blob-3, .rex-pulp-bit { animation: none !important; display: none; }
      }

      .rex-theme-toggle { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.16); color: #fff; cursor: pointer; transition: background 0.15s ease, transform 0.08s ease; flex-shrink: 0; }
      .rex-theme-toggle:hover { background: rgba(255,255,255,0.28); }
      .rex-theme-toggle:active { transform: scale(0.94); }
      @media (max-width: 380px) {
        .rex-theme-toggle { width: 30px; height: 30px; }
      }

      .rex-tabs-desktop { display: none; }
      @media (min-width: 768px) {
        .rex-tabs-desktop { display: block; position: sticky; top: 65px; z-index: 19; background: var(--rex-bg-translucent); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); border-bottom: 1px solid var(--rex-shell-hairline); }
        .rex-tabs-desktop-inner { max-width: 900px; margin: 0 auto; padding: 0 24px; display: flex; gap: 4px; }
      }
      .rex-tab { display: flex; align-items: center; gap: 7px; padding: 13px 16px; font-size: 13.5px; font-weight: 600; border: none; background: transparent; cursor: pointer; color: var(--rex-shell-text-muted); border-bottom: 2.5px solid transparent; margin-bottom: -1px; transition: color 0.15s ease; font-family: ${T.fontBody}; }
      .rex-tab:hover { color: var(--rex-shell-text); }
      .rex-tab-active { color: var(--rex-primary); border-image: linear-gradient(90deg, #F2670D, #FF8A3D) 1; }

      .rex-tabs-mobile { display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 30; background: var(--rex-bg-translucent); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); border-top: 1px solid var(--rex-shell-hairline); padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px)); }
      @media (min-width: 768px) { .rex-tabs-mobile { display: none; } }
      .rex-mtab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; padding: 7px 2px; border-radius: 12px; color: var(--rex-shell-text-muted); font-size: 10.5px; font-weight: 600; font-family: ${T.fontBody}; transition: color 0.15s ease, background 0.15s ease; }
      .rex-mtab-active { color: #fff; background: linear-gradient(120deg, rgba(242,103,13,0.95), rgba(255,138,61,0.9)); }

      .rex-card { background: var(--rex-surface); border: 1px solid var(--rex-border); border-radius: 18px; padding: 18px 20px; transition: transform 0.15s ease, border-color 0.2s ease; }
      .rex-card-hover:hover { transform: translateY(-2px); border-color: var(--rex-border-strong); }

      .rex-btn { font-family: ${T.fontBody}; cursor: pointer; transition: transform 0.08s ease, opacity 0.15s ease, background-position 0.4s ease, background 0.15s ease; }
      .rex-btn:active { transform: scale(0.96); }
      .rex-btn-primary { background: linear-gradient(120deg, #F2670D, #FF8A3D); background-size: 160% auto; color: #fff; border: none; border-radius: 11px; font-weight: 700; padding: 10px 18px; font-size: 14px; }
      .rex-btn-primary:hover { background-position: 100% center; }
      .rex-btn-dark { background: var(--rex-btn-dark-bg); color: #fff; border: 1px solid var(--rex-btn-dark-bg); border-radius: 11px; font-weight: 700; padding: 10px 18px; font-size: 14px; }
      .rex-btn-dark:hover { background: var(--rex-btn-dark-bg-hover); }
      .rex-btn-ghost { background: rgba(var(--rex-wash-rgb),0.03); color: var(--rex-ink); border: 1.5px solid rgba(var(--rex-wash-rgb),0.14); border-radius: 10px; font-weight: 600; padding: 9px 14px; font-size: 13px; }
      .rex-btn-ghost:hover { border-color: rgba(var(--rex-wash-rgb),0.28); background: rgba(var(--rex-wash-rgb),0.06); }

      input.rex-input, select.rex-input { font-family: ${T.fontBody}; border: 1.5px solid rgba(var(--rex-wash-rgb),0.14); border-radius: 11px; padding: 11px 13px; font-size: 14.5px; background: var(--rex-surface); color: var(--rex-ink); width: 100%; }
      input.rex-pay-input { width: 84px; padding: 8px 10px; font-size: 13.5px; text-align: right; }
      input.rex-input:focus, select.rex-input:focus { outline: none; border-color: var(--rex-primary); box-shadow: 0 0 0 3px var(--rex-primary-soft); background: var(--rex-surface); }
      input.rex-input::placeholder { color: var(--rex-muted); }
      select.rex-input option { color: var(--rex-ink); background: var(--rex-surface); }

      .rex-row { transition: background 0.12s ease; border-radius: 12px; }
      .rex-row:hover { background: var(--rex-row-hover); }

      .rex-modal-overlay { position: fixed; inset: 0; background: var(--rex-modal-overlay); backdrop-filter: blur(6px); z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
      @media (min-width: 640px) { .rex-modal-overlay { align-items: center; } }
      .rex-modal-sheet { background: var(--rex-surface); border: 1px solid var(--rex-border); width: 100%; max-width: 440px; border-radius: 22px 22px 0 0; padding: 22px 20px calc(22px + env(safe-area-inset-bottom, 0px)); animation: rex-sheetup 0.25s ease; max-height: 88vh; overflow-y: auto; }
      @media (min-width: 640px) { .rex-modal-sheet { border-radius: 22px; animation: rex-scalein 0.18s ease; } }

      @media (prefers-reduced-motion: reduce) { .rex-aurora .b, .rex-coin, .rex-orange-sparkle { animation: none !important; } .rex-coin, .rex-orange-sparkle { display: none; } }
    `}</style>
  );
}

export function Avatar({ name, size = 32 }) {
  const color = colorForName(name || "?");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: color + "33", color, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.4, fontWeight: 700,
      fontFamily: T.fontDisplay, border: `1.5px solid ${color}66`,
    }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function Sparkle({ size = 8, className, style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" />
    </svg>
  );
}

const APPBAR_SPARKLES = [
  { top: 14, left: "44%", size: 9, delay: 0, dur: 2.4 },
  { top: 60, left: "50%", size: 6, delay: 0.6, dur: 2.0 },
  { top: 30, left: "57%", size: 7, delay: 1.1, dur: 2.6 },
  { top: 45, left: "38%", size: 5, delay: 1.6, dur: 2.2 },
];

const APPBAR_PULP = [
  { top: 12, size: 7, delay: 0, dur: 10 },
  { top: 32, size: 4, delay: 2.5, dur: 8 },
  { top: 48, size: 6, delay: 5, dur: 11 },
  { top: 22, size: 5, delay: 7.5, dur: 9 },
  { top: 55, size: 8, delay: 3.5, dur: 12 },
];

export function AppBar({ userName, saveError, roomName, roomId, isAdmin, periodText, onLeave, onLogout, onOpenSettings, onOpenRoomInfo, theme, onToggleTheme, notifications, onMarkAllNotificationsRead, onClearAllNotifications }) {
  return (
    <div className="rex-appbar">
      <div className="rex-appbar-juice" aria-hidden="true">
        <div className="rex-juice-blob rex-juice-blob-1" />
        <div className="rex-juice-blob rex-juice-blob-2" />
        <div className="rex-juice-blob rex-juice-blob-3" />
      </div>
      <div className="rex-appbar-pulp" aria-hidden="true">
        {APPBAR_PULP.map((p, i) => (
          <div key={i} className="rex-pulp-bit" style={{ top: p.top, width: p.size, height: p.size, animationDelay: p.delay + "s", animationDuration: p.dur + "s" }} />
        ))}
      </div>
      <div className="rex-appbar-sparkles" aria-hidden="true">
        {APPBAR_SPARKLES.map((s, i) => (
          <Sparkle key={i} size={s.size} style={{ top: s.top, left: s.left, animationDelay: s.delay + "s", animationDuration: s.dur + "s" }} className="rex-appbar-sparkle" />
        ))}
      </div>
      <div className="rex-appbar-inner">
        <button className="rex-appbar-brand" onClick={onOpenRoomInfo} title={`Room ID: ${roomId}${periodText ? " · " + periodText : ""}`} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, background: "none", border: "none", padding: 0, cursor: onOpenRoomInfo ? "pointer" : "default", textAlign: "left", font: "inherit" }}>
          <img src="/logo.png" alt="" aria-hidden="true" style={{
            width: 36, height: 36, borderRadius: 11, objectFit: "cover", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)", border: "1.5px solid rgba(255,255,255,0.5)",
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.15, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {roomName || "Room Split"}
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
              {saveError ? (
                <span style={{ display: "inline-flex", color: "#C81E2E", background: "#fff", borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>Sync failed — check connection</span>
              ) : (
                <>
                  {isAdmin && <Crown size={11} strokeWidth={2.4} color="#FFE9B8" style={{ flexShrink: 0 }} />}
                  {isAdmin ? "Admin · " + userName : userName}
                </>
              )}
            </div>
          </div>
        </button>

        <div className="rex-appbar-right">
          {onToggleTheme && (
            <button className="rex-theme-toggle" onClick={onToggleTheme} aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
            </button>
          )}
          {notifications && (
            <NotificationBell notifications={notifications} onMarkAllRead={onMarkAllNotificationsRead} onClearAll={onClearAllNotifications} />
          )}
          {onOpenSettings && (
            <button className="rex-theme-toggle" onClick={onOpenSettings} aria-label="My details" title="My details">
              <Settings size={16} strokeWidth={2.2} />
            </button>
          )}
          {onLeave && (
            <button className="rex-theme-toggle" onClick={onLeave} aria-label="Switch room" title="Switch room">
              <DoorOpen size={16} strokeWidth={2.2} />
            </button>
          )}
          {onLogout && (
            <button className="rex-theme-toggle" onClick={onLogout} aria-label="Log out" title="Log out">
              <LogOut size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, total, color }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ height: 6, background: "rgba(var(--rex-wash-rgb),0.10)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 4, transition: "width 0.35s ease" }} />
    </div>
  );
}

export function StatusPill({ status }) {
  const cfg = {
    paid: { bg: T.successSoft, fg: T.success, Icon: Check, label: "Paid" },
    partial: { bg: T.warningSoft, fg: T.warning, Icon: Clock, label: "Partial" },
    pending_verification: { bg: T.warningSoft, fg: T.warning, Icon: Clock, label: "Pending Verification" },
    pending: { bg: T.dangerSoft, fg: T.danger, Icon: Clock, label: "Pending" },
  }[status] || { bg: T.dangerSoft, fg: T.danger, Icon: Clock, label: "Pending" };
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700,
      padding: "3px 9px", borderRadius: 20, background: cfg.bg, color: cfg.fg,
    }}>
      <Icon size={11} strokeWidth={3} />
      {cfg.label}
    </span>
  );
}

export function SectionHeading({ icon: Icon, color, soft, title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `inset 0 0 0 1px ${color}44` }}>
          <Icon size={19} color={color} strokeWidth={2.2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: T.ink, letterSpacing: "-0.01em" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}
