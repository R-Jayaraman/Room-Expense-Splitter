import React, { useEffect, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { T } from "../constants";

// Simple toast bubble — no mascot/character animation, just the message.
// Used for every toast-worthy event across every tab: payments, refunds,
// reminders, admin changes, deposit updates, etc.
const TONE_STYLES = {
  success: { bg: T.surface, border: "rgba(47,174,104,0.4)", text: T.ink, Icon: Check, iconColor: T.success },
  danger: { bg: "#E23744", border: "rgba(226,55,68,0.5)", text: "#fff", Icon: AlertTriangle, iconColor: "#fff" },
  default: { bg: T.surface, border: T.border, text: T.ink, Icon: null, iconColor: T.ink },
};

export function CharacterNotification({ message, tone = "default", onDone }) {
  const [leaving, setLeaving] = useState(false);
  const style = TONE_STYLES[tone] || TONE_STYLES.default;
  const Icon = style.Icon;

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), 3000);
    const doneTimer = setTimeout(() => onDone && onDone(), 3380);
    return () => { clearTimeout(leaveTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onDone && onDone(), 350);
  };

  return (
    <div className={"cn-wrap" + (leaving ? " cn-leaving" : "")} onClick={dismiss} role="button" tabIndex={0} aria-label="Dismiss notification"
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && dismiss()}>
      <style>{`
        .cn-wrap { position: fixed; left: 18px; bottom: 84px; z-index: 70; cursor: pointer; animation: cn-in 0.5s cubic-bezier(.16,1,.3,1) both; }
        @media (min-width: 768px) { .cn-wrap { bottom: 28px; } }
        .cn-leaving { animation: cn-out 0.34s ease both; }
        @keyframes cn-in { from { opacity: 0; transform: translateX(-72px) scale(0.88); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes cn-out { from { opacity: 1; transform: translateX(0) scale(1); } to { opacity: 0; transform: translateX(-48px) scale(0.92); } }
        .cn-bubble { display: flex; align-items: center; gap: 7px; border: 1px solid; font-size: 13px; font-weight: 700; line-height: 1.35; padding: 10px 14px; border-radius: 14px; max-width: 260px; animation: cn-pop 0.35s cubic-bezier(.16,1,.3,1) 0.1s both; }
        @keyframes cn-pop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .cn-wrap { animation: none !important; } }
      `}</style>
      <div className="cn-bubble" style={{ background: style.bg, borderColor: style.border, color: style.text }}>
        {Icon && <Icon size={15} strokeWidth={2.6} color={style.iconColor} style={{ flexShrink: 0 }} />}
        <span>{message}</span>
      </div>
    </div>
  );
}
