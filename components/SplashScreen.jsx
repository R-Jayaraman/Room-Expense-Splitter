import React, { useEffect, useMemo, useState } from "react";

// App-open title card: bold orange backdrop, the logo spins in like the
// citrus wheel it is (rotate + scale, elastic settle), the app name is
// pinned at the bottom in white. Fades out into the next screen.
export default function SplashScreen({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const reduceMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    if (reduceMotion) { onDone && onDone(); return; }
    const leaveTimer = setTimeout(() => setLeaving(true), 1700);
    const doneTimer = setTimeout(() => onDone && onDone(), 2100);
    return () => { clearTimeout(leaveTimer); clearTimeout(doneTimer); };
  }, [onDone, reduceMotion]);

  return (
    <div className={"rs-splash" + (leaving ? " rs-splash-out" : "")}>
      <style>{`
        .rs-splash {
          position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(130% 110% at 50% 32%, #FF9A2E 0%, #FF7A00 45%, #E65F00 100%);
          overflow: hidden; transition: opacity 0.5s ease;
        }
        .rs-splash-out { opacity: 0; pointer-events: none; }

        .rs-logo-wrap { position: relative; width: 132px; height: 132px; }

        .rs-logo-halo {
          position: absolute; inset: -18px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%);
          animation: rs-halo-pulse 2.2s ease-in-out 0.5s infinite;
        }
        @keyframes rs-halo-pulse { 0%, 100% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 0.9; transform: scale(1.1); } }

        .rs-orbit { position: absolute; inset: -30px; animation: rs-orbit-spin 4.4s linear infinite; }
        .rs-orbit-2 { inset: -16px; animation: rs-orbit-spin 3s linear infinite reverse; }
        @keyframes rs-orbit-spin { to { transform: rotate(360deg); } }

        .rs-sparkle {
          position: absolute; top: 0; left: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px;
          filter: drop-shadow(0 0 5px rgba(255,255,255,0.9));
          animation: rs-sparkle-twinkle 1.4s ease-in-out infinite;
        }
        .rs-sparkle-sm { width: 10px; height: 10px; margin: -5px 0 0 -5px; animation-delay: 0.45s; }
        @keyframes rs-sparkle-twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.15); } }

        .rs-logo-shell {
          position: absolute; inset: 0; z-index: 1; border-radius: 30px; overflow: hidden;
          box-shadow: 0 14px 30px -10px rgba(0,0,0,0.35);
          opacity: 0; transform: scale(0.4) rotate(-130deg);
          animation: rs-logo-spin-in 0.85s cubic-bezier(.2,.85,.25,1.15) forwards, rs-logo-breathe 2.4s ease-in-out 0.9s infinite;
        }
        @keyframes rs-logo-spin-in {
          0%   { opacity: 0; transform: scale(0.4) rotate(-130deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(10deg); }
          80%  { transform: scale(0.97) rotate(-4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes rs-logo-breathe { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.035) rotate(0deg); } }
        .rs-logo-img {
          display: block; width: 112%; height: 112%; object-fit: cover; margin: -6%;
        }

        .rs-splash-name {
          position: fixed; left: 0; right: 0; bottom: calc(96px + env(safe-area-inset-bottom, 0px)); text-align: center;
          font-size: 16px; font-weight: 700; letter-spacing: 0.04em; color: #fff;
          text-shadow: 0 1px 6px rgba(0,0,0,0.25);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          opacity: 0; animation: rs-name-in 0.5s ease 0.7s forwards;
        }
        @keyframes rs-name-in { to { opacity: 1; } }

        .rs-splash-credit {
          position: fixed; left: 0; right: 0; bottom: calc(74px + env(safe-area-inset-bottom, 0px)); text-align: center;
          font-size: 11.5px; font-weight: 600; letter-spacing: 0.03em; color: rgba(255,255,255,0.75);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          opacity: 0; animation: rs-name-in 0.5s ease 0.9s forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .rs-logo-shell, .rs-splash-name, .rs-splash-credit, .rs-logo-halo, .rs-orbit, .rs-sparkle { animation: none !important; opacity: 1 !important; transform: none !important; }
          .rs-orbit, .rs-logo-halo { display: none !important; }
        }
      `}</style>
      <div className="rs-logo-wrap">
        <div className="rs-logo-halo" aria-hidden="true" />
        <div className="rs-orbit rs-orbit-1" aria-hidden="true">
          <svg className="rs-sparkle" viewBox="0 0 24 24" fill="#fff"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" /></svg>
        </div>
        <div className="rs-orbit rs-orbit-2" aria-hidden="true">
          <svg className="rs-sparkle rs-sparkle-sm" viewBox="0 0 24 24" fill="#fff"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" /></svg>
        </div>
        <div className="rs-logo-shell">
          <img className="rs-logo-img" src="/logo.png" alt="" aria-hidden="true" />
        </div>
      </div>
      <div className="rs-splash-name">Room Expense Splitter</div>
      <div className="rs-splash-credit">A Product by Ajish • Jayaraman • Sachin</div>
    </div>
  );
}
