// ---------------------------------------------------------------------------
// Firebase layer — user accounts (Auth) + rooms (Firestore)
// ---------------------------------------------------------------------------
//  Auth:  email/password accounts. Profile mirrored at users/{uid}.
//  Rooms: rooms/{roomId} = {
//     name, adminUid, adminName, salt, passwordHash, memberUids[],
//     state:{ period, members[], deposits{}, transactions[] },
//     createdAt, updatedAt }
//  rooms/{roomId}/secrets/main = { password } — the plaintext password lives
//  here (not on the main doc) so it can be visible to members in Settings
//  without loosening the main doc, which must stay readable pre-membership
//  so joinRoom can check the salted hash. See README for the Firestore rules
//  this needs.
//  The creator is the admin. Joining needs an account + the room password.
// ---------------------------------------------------------------------------
import { initializeApp } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, setPersistence, browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, collection, query, where, orderBy, limit, getDocs, writeBatch,
} from "firebase/firestore";
import { defaultState } from "./constants";
import { currentPeriod, isValidGmail } from "./utils";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let _app = null, _db = null, _auth = null;
function app() { if (!_app) _app = initializeApp(firebaseConfig); return _app; }
function db() {
  if (!isFirebaseConfigured()) throw new Error("Firebase isn't configured yet — add your keys to .env (see the README).");
  if (!_db) _db = getFirestore(app());
  return _db;
}
function auth() {
  if (!isFirebaseConfigured()) throw new Error("Firebase isn't configured yet — add your keys to .env (see the README).");
  if (!_auth) { _auth = getAuth(app()); setPersistence(_auth, browserLocalPersistence).catch(() => {}); }
  return _auth;
}

const AUTH_MESSAGES = {
  "auth/email-already-in-use": "That email already has an account — try logging in.",
  "auth/invalid-email": "That doesn't look like a valid email.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts — please wait a moment and try again.",
};
function friendlyAuthError(e) { return AUTH_MESSAGES[e && e.code] || (e && e.message) || "Something went wrong."; }

// -------------------------------- auth -------------------------------------
export function watchAuth(cb) { return onAuthStateChanged(auth(), cb); }

export async function registerUser({ name, email, password }) {
  if (!name || !name.trim()) throw new Error("Enter your name.");
  if (!isValidGmail(email)) throw new Error("Enter a valid Gmail address (name@gmail.com).");
  if (!password || password.length < 6) throw new Error("Use a password with at least 6 characters.");
  try {
    const cred = await createUserWithEmailAndPassword(auth(), email.trim().toLowerCase(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await setDoc(doc(db(), "users", cred.user.uid), { name: name.trim(), email: cred.user.email, createdAt: serverTimestamp() }, { merge: true });
    return cred.user;
  } catch (e) { throw new Error(friendlyAuthError(e)); }
}

export async function loginUser({ email, password }) {
  if (!isValidGmail(email)) throw new Error("Enter a valid Gmail address (name@gmail.com).");
  if (!password) throw new Error("Enter your password.");
  try {
    const cred = await signInWithEmailAndPassword(auth(), email.trim().toLowerCase(), password);
    return cred.user;
  } catch (e) { throw new Error(friendlyAuthError(e)); }
}

export async function logoutUser() { try { await signOut(auth()); } catch {} }

// ------------------------------ room crypto --------------------------------
export function slugifyRoomId(s) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
function randomSalt() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "::" + password));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// -------------------------------- rooms ------------------------------------
function memberFromUser(user, role) {
  return { id: user.uid, name: user.displayName || (user.email || "Member").split("@")[0], email: user.email, role, gender: "", mobile: "", upiId: "" };
}

// Every room the user belongs to, so they can jump straight back into any of
// them without re-entering the room ID + password. Reads directly off each
// room's memberUids, so it works for rooms joined before this existed too.
export async function listUserRooms(uid) {
  const q = query(collection(db(), "rooms"), where("memberUids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const memberUids = data.memberUids || [];
    return { id: d.id, name: data.name || d.id, isAdmin: data.adminUid === uid, memberCount: memberUids.length };
  });
}

export async function createRoom({ roomId, name, password, user }) {
  const id = slugifyRoomId(roomId);
  if (!id) throw new Error("Enter a room ID (letters, numbers, dashes).");
  if (!password || password.length < 4) throw new Error("Use a room password with at least 4 characters.");
  const ref = doc(db(), "rooms", id);
  if ((await getDoc(ref)).exists()) throw new Error("That room ID is already taken. Try another.");

  const admin = memberFromUser(user, "admin");
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const state = {
    ...defaultState,
    period: currentPeriod(),
    members: [admin],
    deposits: {
      rent: { total: 0, history: [] },
      electricity: { total: 0, history: [] },
      grocery: { total: 0, history: [], carryover: 0 },
    },
    transactions: [],
  };
  await setDoc(ref, {
    name: (name || "").trim() || id, adminUid: user.uid, adminName: admin.name,
    salt, passwordHash, memberUids: [user.uid], state,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  // Plaintext password lives in a separate, member-only-readable doc — the
  // main room doc stays readable pre-membership so joinRoom can check the
  // password hash for users who aren't members yet.
  await setDoc(doc(db(), "rooms", id, "secrets", "main"), { password });
  return id;
}

export async function joinRoom({ roomId, password, user }) {
  const id = slugifyRoomId(roomId);
  if (!id) throw new Error("Enter the room ID your admin shared.");
  const ref = doc(db(), "rooms", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("No room found with that ID.");
  const data = snap.data();
  const hash = await hashPassword(password, data.salt);
  if (hash !== data.passwordHash) throw new Error("Incorrect room password.");

  const members = Array.isArray(data.state?.members) ? [...data.state.members] : [];
  if (!members.some((m) => m.id === user.uid)) {
    members.push(memberFromUser(user, user.uid === data.adminUid ? "admin" : "member"));
    const memberUids = members.map((m) => m.id);
    await setDoc(ref, { state: { ...data.state, members }, memberUids, updatedAt: serverTimestamp() }, { merge: true });
  }
  return id;
}

// Only room members can read this — enforced by Firestore rules, not just
// the app. Returns "" if unavailable (permission denied, or a room created
// before this existed, which never got a secrets/main doc).
export async function getRoomPassword(roomId) {
  try {
    const snap = await getDoc(doc(db(), "rooms", slugifyRoomId(roomId), "secrets", "main"));
    return snap.exists() ? (snap.data().password || "") : "";
  } catch {
    return "";
  }
}

// Admin-only: (re)sets the room password. Rehashes it for join verification
// and stores the plaintext in secrets/main so it's visible in Settings —
// this is also how rooms created before that doc existed get one. Both
// writes go through one batch so a permission error on the secrets doc (e.g.
// its Firestore rule hasn't been added yet) can't leave the real join
// password changed while the visible copy silently fails to save.
export async function setRoomPassword(roomId, password) {
  if (!password || password.length < 4) throw new Error("Use a room password with at least 4 characters.");
  const id = slugifyRoomId(roomId);
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const batch = writeBatch(db());
  batch.set(doc(db(), "rooms", id), { salt, passwordHash, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db(), "rooms", id, "secrets", "main"), { password });
  await batch.commit();
}

// Permanently deletes the room document (and its secrets doc — Firestore
// doesn't cascade-delete subcollections on its own). Other members'
// subscribeRoom listeners pick up the main doc's removal automatically and
// are routed back out via the "room-deleted" error path.
export async function deleteRoom(roomId) {
  const id = slugifyRoomId(roomId);
  await deleteDoc(doc(db(), "rooms", id, "secrets", "main")).catch(() => {});
  await deleteDoc(doc(db(), "rooms", id));
}

// Hands admin rights to another member. adminUid/adminName live at the top
// level of the room doc (not inside state), so this is a separate write from
// the regular state autosave.
export async function transferAdmin(roomId, { uid, name }) {
  await setDoc(doc(db(), "rooms", slugifyRoomId(roomId)), {
    adminUid: uid, adminName: name, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeRoom(roomId, onData, onError) {
  const ref = doc(db(), "rooms", slugifyRoomId(roomId));
  return onSnapshot(
    ref,
    (snap) => { if (snap.exists()) onData(snap.data()); else onError && onError(new Error("room-deleted")); },
    (err) => onError && onError(err)
  );
}

// Writes state and keeps memberUids in sync with state.members.
export async function saveRoomState(roomId, state) {
  await setDoc(doc(db(), "rooms", slugifyRoomId(roomId)), {
    state, memberUids: (state.members || []).map((m) => m.id), updatedAt: serverTimestamp(),
  }, { merge: true });
  return true;
}

// ------------------------------ notification inbox ---------------------------
// There's no server here — sending real push (FCM) requires a Cloud
// Function, which in turn requires the Firebase project to be on the paid
// Blaze plan. To keep this fully free, notifications are written directly
// by whichever client performs the action, straight into the target
// member's users/{uid}/notifications, instead of a backend watching for
// state changes. That means they only show up once someone has the app
// open (no OS-level push while it's closed), but the in-app bell inbox
// works exactly the same either way.
export async function notifyMember(uid, { title, body, data }) {
  if (!uid) return;
  const ref = doc(collection(db(), "users", uid, "notifications"));
  await setDoc(ref, { title, body, data: data || {}, read: false, createdAt: serverTimestamp() });
}

export async function notifyMembers(uids, { title, body, data }) {
  const unique = [...new Set(uids)].filter(Boolean);
  if (unique.length === 0) return;
  const batch = writeBatch(db());
  unique.forEach((uid) => {
    const ref = doc(collection(db(), "users", uid, "notifications"));
    batch.set(ref, { title, body, data: data || {}, read: false, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

export function subscribeNotifications(uid, cb) {
  if (!uid) return () => {};
  const q = query(collection(db(), "users", uid, "notifications"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export async function markAllNotificationsRead(uid, ids) {
  if (!uid || !ids || ids.length === 0) return;
  const batch = writeBatch(db());
  ids.forEach((id) => batch.set(doc(db(), "users", uid, "notifications", id), { read: true }, { merge: true }));
  await batch.commit();
}

export async function deleteAllNotifications(uid, ids) {
  if (!uid || !ids || ids.length === 0) return;
  const batch = writeBatch(db());
  ids.forEach((id) => batch.delete(doc(db(), "users", uid, "notifications", id)));
  await batch.commit();
}
