import React, { useEffect, useMemo, useState } from "react";
import { Hash, Lock, Sparkles, DoorOpen, ArrowRight, ArrowLeft, Crown, LogOut, Loader2, KeyRound } from "lucide-react";
import { AuthStyles, AuthBackdrop, AuthThemeToggle, BrandRow, useLockBodyScroll } from "./AuthShell";
import { createRoom, joinRoom, slugifyRoomId, logoutUser, listUserRooms } from "../firebase";

export default function RoomsHub({ user, onEnterRoom, theme, onToggleTheme }) {
  useLockBodyScroll();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("menu"); // "menu" | "rooms" | "join" | "create"

  const [rooms, setRooms] = useState(null); // null = loading, [] = none yet

  useEffect(() => {
    let alive = true;
    listUserRooms(user.uid).then((r) => alive && setRooms(r)).catch(() => alive && setRooms([]));
    return () => { alive = false; };
  }, [user.uid]);

  const hasRooms = Array.isArray(rooms) && rooms.length > 0;

  const [joinId, setJoinId] = useState("");
  const [joinPw, setJoinPw] = useState("");

  const [roomName, setRoomName] = useState("");
  const [createId, setCreateId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [createPw, setCreatePw] = useState("");
  const [createPw2, setCreatePw2] = useState("");

  const suggestedId = useMemo(() => slugifyRoomId(roomName), [roomName]);
  const effectiveId = idTouched ? createId : suggestedId;
  const goTo = (v) => { setView(v); setError(""); };
  const firstName = (user.displayName || user.email || "there").split(" ")[0].split("@")[0];

  const handleJoin = async () => {
    if (busy) return; setError("");
    if (!joinId.trim()) return setError("Enter the room ID your admin shared.");
    if (!joinPw) return setError("Enter the room password.");
    setBusy(true);
    try { const id = await joinRoom({ roomId: joinId, password: joinPw, user }); onEnterRoom(id); }
    catch (e) { setError(e.message || "Couldn't join that room."); setBusy(false); }
  };
  const handleCreate = async () => {
    if (busy) return; setError("");
    if (!roomName.trim()) return setError("Give your room a name.");
    if (!effectiveId) return setError("Enter a room ID (letters, numbers, dashes).");
    if (createPw.length < 4) return setError("Use a room password with at least 4 characters.");
    if (createPw !== createPw2) return setError("The two passwords don't match.");
    setBusy(true);
    try { const id = await createRoom({ roomId: effectiveId, name: roomName, password: createPw, user }); onEnterRoom(id); }
    catch (e) { setError(e.message || "Couldn't create the room."); setBusy(false); }
  };
  const onKey = (e, fn) => { if (e.key === "Enter") fn(); };

  const BackButton = () => (
    <button onClick={() => goTo("menu")} className="au-back" type="button">
      <ArrowLeft size={14} /> Back
    </button>
  );

  const menuView = (
    <div style={{ display: "grid", gap: 10 }}>
      <button className="au-menu-btn au-menu-enter" onClick={() => goTo("rooms")}>
        <span className="au-menu-icon"><KeyRound size={18} /></span>
        <span style={{ textAlign: "left" }}>
          <span className="au-menu-title">Enter Room</span>
          <span className="au-menu-sub">Go to a room you're already in</span>
        </span>
        <ArrowRight size={16} style={{ flexShrink: 0, marginLeft: "auto" }} />
      </button>
      <button className="au-menu-btn au-menu-join" onClick={() => goTo("join")}>
        <span className="au-menu-icon"><DoorOpen size={18} /></span>
        <span style={{ textAlign: "left" }}>
          <span className="au-menu-title">Join Room</span>
          <span className="au-menu-sub">Use a room ID + password from your admin</span>
        </span>
        <ArrowRight size={16} style={{ flexShrink: 0, marginLeft: "auto" }} />
      </button>
      <button className="au-menu-btn au-menu-create" onClick={() => goTo("create")}>
        <span className="au-menu-icon"><Sparkles size={18} /></span>
        <span style={{ textAlign: "left" }}>
          <span className="au-menu-title">Create Room</span>
          <span className="au-menu-sub">Start a new room as the admin</span>
        </span>
        <ArrowRight size={16} style={{ flexShrink: 0, marginLeft: "auto" }} />
      </button>
    </div>
  );

  const roomsView = (
    <>
      <BackButton />
      <h1 className="au-title" style={{ fontSize: 20, marginTop: 10 }}>Your rooms</h1>
      {rooms === null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--soft)", fontSize: 13, padding: "6px 0 2px" }}>
          <Loader2 size={15} className="au-spin" /> Loading your rooms…
        </div>
      ) : hasRooms ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rooms.map((r) => (
            <button key={r.id} className="au-roomcard" onClick={() => onEnterRoom(r.id)}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}
                  {r.isAdmin && <span className="au-room-admin"><Crown size={11} /> Admin</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>#{r.id} · {r.memberCount} member{r.memberCount === 1 ? "" : "s"}</div>
              </div>
              <ArrowRight size={16} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      ) : (
        <p className="au-sub">You haven't joined or created any rooms yet — use Join Room or Create Room instead.</p>
      )}
    </>
  );

  const joinView = (
    <>
      <BackButton />
      <h1 className="au-title" style={{ fontSize: 20, marginTop: 10 }}>Join your room</h1>
      <p className="au-sub">Enter the room ID and password your admin shared.</p>
      <div className="au-field"><label className="au-label">Room ID</label>
        <div className="au-input-wrap"><Hash size={16} /><input className="au-in" placeholder="e.g. flat-3b" value={joinId} autoComplete="off" onChange={(e) => setJoinId(e.target.value)} onKeyDown={(e) => onKey(e, handleJoin)} /></div>
      </div>
      <div className="au-field"><label className="au-label">Room password</label>
        <div className="au-input-wrap"><Lock size={16} /><input className="au-in" type="password" placeholder="Shared room password" value={joinPw} onChange={(e) => setJoinPw(e.target.value)} onKeyDown={(e) => onKey(e, handleJoin)} /></div>
      </div>
      <button className="au-submit" onClick={handleJoin} disabled={busy}>{busy ? <Loader2 size={17} className="au-spin" /> : <ArrowRight size={17} />}{busy ? "Joining…" : "Enter room"}</button>
      {error && <div className="au-error">{error}</div>}
    </>
  );

  const createView = (
    <>
      <BackButton />
      <h1 className="au-title" style={{ fontSize: 20, marginTop: 10 }}>Start a new room</h1>
      <p className="au-sub">You'll be the admin — set the bills and manage groceries.</p>
      <div className="au-note"><Crown size={14} color="#F0A63C" /><span>As the <b style={{ color: "#fff" }}>admin</b> you set bills and record grocery purchases — and still pay your equal share.</span></div>
      <div className="au-field"><label className="au-label">Room name</label>
        <div className="au-input-wrap"><Sparkles size={16} /><input className="au-in" placeholder="e.g. Flat 3B, MG Road" value={roomName} onChange={(e) => setRoomName(e.target.value)} onKeyDown={(e) => onKey(e, handleCreate)} /></div>
      </div>
      <div className="au-field"><label className="au-label">Room ID</label>
        <div className="au-input-wrap"><Hash size={16} /><input className="au-in" placeholder="flat-3b" value={effectiveId} autoComplete="off" onChange={(e) => { setIdTouched(true); setCreateId(slugifyRoomId(e.target.value)); }} onKeyDown={(e) => onKey(e, handleCreate)} /></div>
        <div className="au-hint">Share this so roommates can join: <b>{effectiveId || "…"}</b></div>
      </div>
      <div className="au-field"><label className="au-label">Room password</label>
        <div className="au-input-wrap"><Lock size={16} /><input className="au-in" type="password" placeholder="At least 4 characters" value={createPw} onChange={(e) => setCreatePw(e.target.value)} onKeyDown={(e) => onKey(e, handleCreate)} /></div>
      </div>
      <div className="au-field"><label className="au-label">Confirm password</label>
        <div className="au-input-wrap"><Lock size={16} /><input className="au-in" type="password" placeholder="Re-enter room password" value={createPw2} onChange={(e) => setCreatePw2(e.target.value)} onKeyDown={(e) => onKey(e, handleCreate)} /></div>
      </div>
      <button className="au-submit" onClick={handleCreate} disabled={busy}>{busy ? <Loader2 size={17} className="au-spin" /> : <Sparkles size={17} />}{busy ? "Creating…" : "Create room"}</button>
      {error && <div className="au-error">{error}</div>}
    </>
  );

  const activeView = { menu: menuView, rooms: roomsView, join: joinView, create: createView }[view];

  return (
    <div className="au-page"><AuthStyles /><AuthBackdrop />
      <div style={{ position: "fixed", top: 18, right: 18, zIndex: 10, display: "flex", gap: 8 }}>
        {onToggleTheme && <AuthThemeToggle theme={theme} onToggle={onToggleTheme} />}
        <button onClick={logoutUser} title="Log out" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <LogOut size={14} /> Log out
        </button>
      </div>
      <div style={{ position: "relative", zIndex: 3, width: "100%", maxWidth: 420, maxHeight: "100%", display: "flex", flexDirection: "column", gap: 10 }}>

      <div className="au-stack" style={{ maxWidth: "none" }}>
      <div className="au-card">
        <BrandRow />
        <div className="au-welcome"><span className="au-wave">👋</span><span>Welcome, <span className="au-name">{firstName}</span>!</span></div>

        {activeView}
      </div>
      </div>
      </div>
    </div>
  );
}
