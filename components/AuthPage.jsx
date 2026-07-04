import React, { useState } from "react";
import { Mail, Lock, User, ArrowRight, UserPlus, LogIn, Loader2 } from "lucide-react";
import { AuthStyles, AuthBackdrop, AuthThemeToggle, BrandRow, useLockBodyScroll } from "./AuthShell";
import { registerUser, loginUser, isFirebaseConfigured } from "../firebase";
import { isValidGmail } from "../utils";

export default function AuthPage({ theme, onToggleTheme }) {
  useLockBodyScroll();
  const configured = isFirebaseConfigured();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const switchMode = (m) => { setMode(m); setError(""); };

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!isValidGmail(email)) return setError("Enter a valid Gmail address (name@gmail.com).");
    if (mode === "register") {
      if (!name.trim()) return setError("Enter your name.");
      if (pw.length < 6) return setError("Use a password with at least 6 characters.");
      if (pw !== pw2) return setError("The two passwords don't match.");
    } else if (!pw) return setError("Enter your password.");
    setBusy(true);
    try {
      if (mode === "register") await registerUser({ name, email, password: pw });
      else await loginUser({ email, password: pw });
      // App's auth listener takes over from here.
    } catch (e) { setError(e.message || "Something went wrong."); setBusy(false); }
  };
  const onKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="au-page"><AuthStyles /><AuthBackdrop />
      {onToggleTheme && <AuthThemeToggle theme={theme} onToggle={onToggleTheme} style={{ position: "fixed", top: 18, right: 18, zIndex: 10 }} />}
      <div className="au-card">
        <BrandRow />
        <div className="au-eyebrow">Your household account</div>
        <h1 className="au-title">{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        <p className="au-sub">{mode === "register" ? "Sign up once, then create or join rooms on any device." : "Log in to reach your rooms from anywhere."}</p>

        {!configured ? (
          <p className="au-sub" style={{ color: "#fff" }}>
            Add your Firebase keys to a <code>.env</code> file (see <code>.env.example</code> and the README) and restart <code>npm run dev</code> to enable accounts.
          </p>
        ) : (
          <>
            <div className="au-seg" role="tablist">
              <div className={"au-seg-pill" + (mode === "register" ? " right" : "")} />
              <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}><LogIn size={15} /> Log in</button>
              <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}><UserPlus size={15} /> Register</button>
            </div>

            {mode === "register" && (
              <div className="au-field"><label className="au-label">Name</label>
                <div className="au-input-wrap"><User size={16} /><input className="au-in" placeholder="e.g. Aditya" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} /></div>
              </div>
            )}
            <div className="au-field"><label className="au-label">Gmail</label>
              <div className="au-input-wrap"><Mail size={16} /><input className="au-in" type="email" autoComplete="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} /></div>
            </div>
            <div className="au-field"><label className="au-label">Password</label>
              <div className="au-input-wrap"><Lock size={16} /><input className="au-in" type="password" placeholder={mode === "register" ? "At least 6 characters" : "Your password"} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onKey} /></div>
            </div>
            {mode === "register" && (
              <div className="au-field"><label className="au-label">Confirm password</label>
                <div className="au-input-wrap"><Lock size={16} /><input className="au-in" type="password" placeholder="Re-enter password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={onKey} /></div>
              </div>
            )}

            <button className="au-submit" onClick={submit} disabled={busy}>
              {busy ? <Loader2 size={17} className="au-spin" /> : (mode === "register" ? <UserPlus size={17} /> : <ArrowRight size={17} />)}
              {busy ? "Please wait…" : (mode === "register" ? "Create account" : "Log in")}
            </button>
            {error && <div className="au-error">{error}</div>}

            <div className="au-foot">
              {mode === "register" ? "Already have an account?" : "New here?"}{" "}
              <button className="au-linkbtn" onClick={() => switchMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Log in" : "Create one"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
