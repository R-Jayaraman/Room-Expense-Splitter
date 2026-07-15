import React, { useState, useEffect } from "react";
import AuthPage from "./components/AuthPage";
import RoomsHub from "./components/RoomsHub";
import RoomExpenseSplit from "./RoomExpenseSplit";
import SplashScreen from "./components/SplashScreen";
import { watchAuth, logoutUser, isFirebaseConfigured } from "./firebase";
import { requestNotificationPermission } from "./localNotify";

const THEME_KEY = "rex-theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return [theme, toggleTheme];
}

function Loader({ label, theme }) {
  const dark = theme === "dark";
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? "#17120D" : "#F6F6F7", color: dark ? "rgba(245,239,230,0.75)" : "rgba(36,26,18,0.7)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 30, height: 30, margin: "0 auto 12px", borderRadius: "50%", border: `3px solid ${dark ? "rgba(245,239,230,0.18)" : "rgba(36,26,18,0.15)"}`, borderTopColor: "#F2670D", animation: "rex-boot-spin 0.7s linear infinite" }} />
        <style>{`@keyframes rex-boot-spin { to { transform: rotate(360deg); } }`}</style>
        {label}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [roomId, setRoomId] = useState(null);
  const [initialTab, setInitialTab] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    if (!isFirebaseConfigured()) { setUser(null); return; }
    const unsub = watchAuth((u) => { setUser(u || null); setRoomId(null); });
    return () => unsub && unsub();
  }, []);

  // Prompts for notification permission once signed in — no-ops on web.
  // Safe to call on every sign-in; it only actually prompts the first time.
  useEffect(() => {
    if (user) requestNotificationPermission();
  }, [user]);

  const enterRoom = (id) => { setInitialTab(null); setRoomId(id); };
  const leaveRoom = () => setRoomId(null);
  const logout = async () => { setRoomId(null); await logoutUser(); };

  if (showSplash) return <SplashScreen onDone={() => setShowSplash(false)} />;
  if (user === undefined) return <Loader label="Starting up…" theme={theme} />;
  if (!user) return <AuthPage theme={theme} onToggleTheme={toggleTheme} />;
  if (!roomId) return <RoomsHub user={user} onEnterRoom={enterRoom} theme={theme} onToggleTheme={toggleTheme} />;
  return <RoomExpenseSplit key={roomId} user={user} roomId={roomId} initialTab={initialTab} onLeave={leaveRoom} onLogout={logout} theme={theme} onToggleTheme={toggleTheme} />;
}
