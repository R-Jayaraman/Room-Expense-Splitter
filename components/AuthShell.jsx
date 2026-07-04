import React, { useEffect } from "react";
import { Sun, Moon } from "lucide-react";

// AuthPage/RoomsHub are meant to fit one screen with no scrolling. .au-page's
// own height:100dvh/overflow:hidden usually covers this, but some mobile
// browsers still rubber-band the body itself — this locks body scroll for as
// long as one of these pages is mounted, and restores it on unmount (the
// in-room app still needs normal scrolling).
export function useLockBodyScroll() {
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);
}

export function AuthStyles() {
  return (<style>{`
    .au-page { --i:#F2670D; --i2:#FF8A3D; --pk:#E2461A; --am:#F5A623; --gr:#2FAE68;
      --glass:rgba(255,255,255,0.9); --brd:rgba(36,26,18,0.10); --ink:#1A1815; --soft:rgba(26,24,21,0.74); --faint:rgba(26,24,21,0.56);
      --card-bg:#fff; --wash-rgb:36,26,18;
      position:relative; height:100vh; height:100dvh; overflow:hidden;
      background:radial-gradient(130% 110% at 50% 28%, #FF9A2E 0%, #FF7A00 45%, #E65F00 100%); color:var(--ink);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; align-items:center; justify-content:center; padding:24px; }
    .au-page * { box-sizing:border-box; }
    [data-theme="dark"] .au-page { --brd:rgba(255,255,255,0.14); --ink:#F5EFE6; --soft:rgba(245,239,230,0.76); --faint:rgba(245,239,230,0.56);
      --card-bg:#241C15; --wash-rgb:247,240,230; --glass:rgba(36,28,20,0.85); }

    /* floating sparkles + juicy pulp bits over the orange backdrop */
    .au-bg-layer { position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
    .au-bg-juice { position:absolute; border-radius:50%; filter:blur(34px); mix-blend-mode:soft-light; }
    .au-bg-juice-1 { width:56vmax; height:56vmax; left:-16vmax; top:-14vmax; background:rgba(255,214,120,0.5); animation:au-juice-flow-1 14s ease-in-out infinite; }
    .au-bg-juice-2 { width:48vmax; height:48vmax; right:-14vmax; bottom:-16vmax; background:rgba(255,150,40,0.4); animation:au-juice-flow-2 17s ease-in-out infinite; }
    @keyframes au-juice-flow-1 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(5%,4%) scale(1.1);} }
    @keyframes au-juice-flow-2 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(-4%,-5%) scale(0.92);} }

    .au-bg-sparkle { position:absolute; color:#fff; opacity:0; animation:au-sparkle-twinkle ease-in-out infinite; }
    @keyframes au-sparkle-twinkle { 0%,100%{opacity:0; transform:translateY(6px) scale(0.6) rotate(0deg);} 50%{opacity:0.9; transform:translateY(-8px) scale(1) rotate(25deg);} }

    .au-bg-pulp { position:absolute; border-radius:50%; background:rgba(255,240,210,0.8); filter:blur(0.5px); opacity:0; animation:au-pulp-drift linear infinite; }
    @keyframes au-pulp-drift {
      0% { transform:translateX(-30px) translateY(0); opacity:0; }
      10% { opacity:0.7; }
      90% { opacity:0.7; }
      100% { transform:translateX(calc(100vw + 30px)) translateY(-10px); opacity:0; }
    }
    @media (prefers-reduced-motion: reduce) { .au-bg-juice-1, .au-bg-juice-2, .au-bg-sparkle, .au-bg-pulp { animation:none !important; display:none; } }
    .au-stack { position:relative; z-index:3; width:100%; max-width:420px; max-height:100%; overflow-y:auto; display:flex; flex-direction:column; align-items:center; gap:12px; }
    .au-stack .au-card { max-height:none; flex-shrink:0; }
    .au-card { position:relative; z-index:3; width:100%; max-width:420px; max-height:92vh; overflow-y:auto;
      background:var(--card-bg); border:1px solid var(--brd); border-radius:26px; padding:28px 26px 24px;
      animation:au-card-in 0.6s cubic-bezier(.16,1,.3,1) both; }
    @keyframes au-card-in { from{opacity:0; transform:translateY(22px) scale(0.98);} to{opacity:1; transform:none;} }
    .au-brand { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .au-brand-name { font-size:13px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--soft); }
    .au-welcome { display:flex; align-items:center; gap:9px; font-size:16px; font-weight:700; color:var(--soft); margin:2px 0 10px; animation:au-card-in 0.7s cubic-bezier(.16,1,.3,1) 0.12s both; }
    .au-welcome .au-name { font-weight:800; background:linear-gradient(100deg,var(--ink),var(--i2) 45%,var(--pk) 90%); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .au-wave { display:inline-block; font-size:19px; transform-origin:70% 70%; animation:au-wave 1.6s ease-in-out 0.7s 2 both; }
    @keyframes au-wave { 0%,100%{transform:rotate(0);} 20%{transform:rotate(18deg);} 40%{transform:rotate(-9deg);} 60%{transform:rotate(14deg);} 80%{transform:rotate(-5deg);} }
    .au-eyebrow { font-size:11.5px; font-weight:700; letter-spacing:0.18em; color:var(--i2); text-transform:uppercase; margin-bottom:8px; }
    .au-title { font-size:26px; line-height:1.1; font-weight:800; letter-spacing:-0.02em; margin:0 0 8px;
      background:linear-gradient(100deg,var(--ink),var(--i2) 26%,var(--pk) 52%,var(--am) 78%,var(--gr)); background-size:220% auto;
      -webkit-background-clip:text; background-clip:text; color:transparent; animation:au-sheen 8s ease infinite; }
    @keyframes au-sheen { 0%,100%{background-position:0% center;} 50%{background-position:120% center;} }
    .au-sub { font-size:13.5px; line-height:1.5; color:var(--soft); margin:0 0 18px; }
    .au-seg { position:relative; display:grid; grid-template-columns:1fr 1fr; background:rgba(var(--wash-rgb),0.045); border:1px solid var(--brd); border-radius:14px; padding:4px; margin-bottom:18px; }
    .au-seg-pill { position:absolute; top:4px; bottom:4px; left:4px; width:calc(50% - 4px); border-radius:10px; background:linear-gradient(120deg,var(--i),var(--pk)); transition:transform 0.32s cubic-bezier(.16,1,.3,1); }
    .au-seg-pill.right { transform:translateX(100%); }
    .au-seg button { position:relative; z-index:1; background:none; border:none; cursor:pointer; padding:10px 8px; font-size:13.5px; font-weight:700; color:var(--soft); font-family:inherit; display:flex; align-items:center; justify-content:center; gap:6px; transition:color 0.2s ease; }
    .au-seg button.active { color:#fff; }
    .au-field { margin-bottom:12px; }
    .au-label { display:block; font-size:12px; font-weight:700; color:var(--soft); margin-bottom:6px; }
    .au-input-wrap { position:relative; display:flex; align-items:center; }
    .au-input-wrap svg { position:absolute; left:13px; color:var(--faint); pointer-events:none; }
    .au-in { width:100%; font-family:inherit; font-size:15px; color:var(--ink); background:rgba(var(--wash-rgb),0.03); border:1.5px solid var(--brd); border-radius:12px; padding:12px 14px 12px 40px; transition:border-color 0.15s,box-shadow 0.15s,background 0.15s; }
    .au-in::placeholder { color:var(--faint); }
    .au-in:focus { outline:none; border-color:var(--i2); background:var(--card-bg); box-shadow:0 0 0 3px rgba(255,138,61,0.25); }
    .au-hint { font-size:11.5px; color:var(--faint); margin-top:6px; }
    .au-hint b { color:var(--soft); font-weight:700; }
    .au-note { display:flex; gap:8px; align-items:flex-start; font-size:11.5px; line-height:1.45; color:var(--soft); background:rgba(240,166,60,0.12); border:1px solid rgba(240,166,60,0.28); border-radius:11px; padding:9px 12px; margin-bottom:14px; }
    .au-note svg { flex-shrink:0; margin-top:1px; }
    .au-menu-btn { display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:rgba(var(--wash-rgb),0.03); border:1px solid var(--brd); border-radius:16px; padding:14px 15px; cursor:pointer; color:var(--ink); font-family:inherit; transition:background 0.15s ease, border-color 0.15s ease, transform 0.08s ease; }
    .au-menu-btn:hover { background:rgba(var(--wash-rgb),0.06); border-color:rgba(var(--wash-rgb),0.22); transform:translateY(-1px); }
    .au-menu-btn:active { transform:translateY(0) scale(0.99); }
    .au-menu-icon { display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:11px; flex-shrink:0; color:#fff; background:linear-gradient(120deg,var(--i),var(--pk)); }
    .au-menu-join .au-menu-icon { background:linear-gradient(120deg,var(--am),var(--i)); }
    .au-menu-create .au-menu-icon { background:linear-gradient(120deg,var(--i),var(--pk)); }
    .au-menu-title { display:block; font-size:14.5px; font-weight:700; color:var(--ink); }
    .au-menu-sub { display:block; font-size:11.5px; color:var(--faint); margin-top:2px; }
    .au-back { display:inline-flex; align-items:center; gap:5px; background:none; border:none; color:var(--soft); font-weight:700; font-size:12.5px; font-family:inherit; cursor:pointer; padding:4px 0; }
    .au-back:hover { color:var(--ink); }
    .au-roomcard { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; text-align:left; background:rgba(var(--wash-rgb),0.03); border:1px solid var(--brd); border-radius:14px; padding:13px 15px; cursor:pointer; color:var(--ink); font-family:inherit; transition:background 0.15s ease, border-color 0.15s ease, transform 0.08s ease; }
    .au-roomcard:hover { background:rgba(var(--wash-rgb),0.06); border-color:rgba(var(--wash-rgb),0.22); }
    .au-roomcard:active { transform:scale(0.99); }
    .au-room-admin { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:700; color:#F0A63C; background:rgba(240,166,60,0.16); border-radius:20px; padding:2px 7px; flex-shrink:0; }
    .au-submit { width:100%; margin-top:4px; font-family:inherit; font-size:15px; font-weight:800; color:#fff; cursor:pointer; border:none; border-radius:13px; padding:14px 18px; display:flex; align-items:center; justify-content:center; gap:8px;
      background:linear-gradient(120deg,var(--i) 0%,var(--pk) 55%,var(--am) 100%); background-size:160% auto;
      transition:transform 0.08s,background-position 0.4s,opacity 0.2s; }
    .au-submit:hover { background-position:100% center; transform:translateY(-1px); }
    .au-submit:active { transform:translateY(0) scale(0.99); }
    .au-submit:disabled { opacity:0.55; cursor:not-allowed; transform:none; }
    .au-error { margin-top:14px; font-size:13px; font-weight:600; color:#C81E2E; background:rgba(226,55,68,0.1); border:1px solid rgba(226,55,68,0.25); border-radius:11px; padding:10px 13px; }
    .au-foot { margin-top:16px; text-align:center; font-size:12px; color:var(--faint); display:flex; align-items:center; justify-content:center; gap:6px; }
    .au-linkbtn { background:none; border:none; color:var(--i2); font-weight:700; cursor:pointer; font-size:12.5px; font-family:inherit; }
    .au-spin { animation:au-spin 0.7s linear infinite; }
    @keyframes au-spin { to { transform:rotate(360deg); } }
    @media (max-width:420px){ .au-title{font-size:23px;} .au-card{padding:24px 18px 20px;} }
    @media (prefers-reduced-motion: reduce){ .au-title,.au-card{animation:none !important;} }
  `}</style>);
}

function AuthSparkle({ size = 10, style }) {
  return (
    <svg className="au-bg-sparkle" style={style} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" />
    </svg>
  );
}

const AUTH_SPARKLES = [
  { top: "12%", left: "18%", size: 12, delay: 0, dur: 3.2 },
  { top: "72%", left: "10%", size: 8, delay: 0.9, dur: 2.6 },
  { top: "20%", left: "82%", size: 10, delay: 1.6, dur: 3.6 },
  { top: "60%", left: "88%", size: 9, delay: 0.4, dur: 2.9 },
  { top: "85%", left: "55%", size: 7, delay: 2.1, dur: 3.1 },
  { top: "8%", left: "50%", size: 8, delay: 1.2, dur: 2.7 },
];

const AUTH_PULP = [
  { top: "15%", size: 8, delay: 0, dur: 12 },
  { top: "38%", size: 5, delay: 3, dur: 10 },
  { top: "58%", size: 7, delay: 6, dur: 13 },
  { top: "78%", size: 6, delay: 1.5, dur: 11 },
  { top: "28%", size: 5, delay: 8, dur: 9 },
];

export function AuthBackdrop() {
  return (
    <div className="au-bg-layer" aria-hidden="true">
      <div className="au-bg-juice au-bg-juice-1" />
      <div className="au-bg-juice au-bg-juice-2" />
      {AUTH_PULP.map((p, i) => (
        <div key={i} className="au-bg-pulp" style={{ top: p.top, width: p.size, height: p.size, animationDelay: p.delay + "s", animationDuration: p.dur + "s" }} />
      ))}
      {AUTH_SPARKLES.map((s, i) => (
        <AuthSparkle key={i} size={s.size} style={{ top: s.top, left: s.left, animationDelay: s.delay + "s", animationDuration: s.dur + "s" }} />
      ))}
    </div>
  );
}

export function AuthThemeToggle({ theme, onToggle, style }) {
  return (
    <button onClick={onToggle} aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
      background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff",
      borderRadius: 10, cursor: "pointer", fontFamily: "inherit", ...style,
    }}>
      {theme === "dark" ? <Sun size={15} strokeWidth={2.2} /> : <Moon size={15} strokeWidth={2.2} />}
    </button>
  );
}

export function BrandRow() {
  return (
    <div className="au-brand">
      <img src="/logo.png" alt="" aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 9, objectFit: "cover", flexShrink: 0, boxShadow: "0 2px 6px rgba(230,110,0,0.3)" }} />
      <span className="au-brand-name">Room Split</span>
    </div>
  );
}
