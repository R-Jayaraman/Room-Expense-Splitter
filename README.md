# Room Split 🏠₹

A roommate expense splitter for rent, electricity and groceries — with real user
accounts, shared rooms, an admin who manages bills, automatic monthly resets,
carry-over credit when amounts change, and an in-app notification inbox for
reminders and admin changes. Amounts are in Rupees (₹) and dates use IST.

---

## How it works

1. **Create an account** — register with your name, Gmail and a password (or log
   in). Accounts are handled by **Firebase Authentication**, so your session
   follows you across devices.
2. **Create or join a room** — the creator becomes the **admin**. Others join
   with the room **ID + room password** the admin shares. Everything syncs live
   across every device via Firestore.
3. **Split expenses** — the admin sets each bill total; it's divided equally. Each
   person records their own payments. The admin can also record grocery purchases
   from the shared pot and remove members.

### Admin vs member
- **Admin** (room creator): sets/edit rent, electricity and grocery totals **any
  time**, records grocery purchases, removes members, sends reminders — and still
  pays an equal share.
- **Member**: records their own payments and sees everything.

### Carry-over credit
Each person's total paid is always compared with their **current** share:
- Paid ₹2,000, admin lowers the total so the share becomes ₹1,500 → shows
  **₹1,500 paid + ₹500 carried** (the extra follows them forward).
- Admin raises the total so the share becomes ₹3,000 → shows **₹1,000 left**.

### Monthly cycle
Electricity and grocery reset to ₹0 at the start of each month. Any leftover
grocery balance rolls over into the new month. Rent carries as-is.

---

## Setup

### 1. Install
```bash
npm install
cp .env.example .env      # then fill in your keys (below)
npm run dev
```

### 2. Firebase (required for accounts + rooms)
1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database.**
4. **Project settings → Your apps → Web app** → copy the config values into
   `.env`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
5. Restart `npm run dev` after editing `.env`.

### 3. Firestore security rules (starter)
Paste these under **Firestore → Rules**. They require sign-in, let anyone create
a room they admin, let members update their room, and let only the admin delete.
The main room doc stays readable by *any* signed-in user (not just members) —
that's needed so `joinRoom` can check the salted password hash for someone who
isn't a member yet. The **plaintext** room password (shown in Settings) is kept
out of that doc entirely and lives in `rooms/{roomId}/secrets/main`, which
*is* restricted to members only:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /rooms/{roomId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.adminUid == request.auth.uid;
      allow update: if request.auth != null
        && (request.auth.uid in resource.data.memberUids
            || request.auth.uid in request.resource.data.memberUids);
      allow delete: if request.auth != null
        && resource.data.adminUid == request.auth.uid;

      match /secrets/{secretId} {
        allow read: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomId)).data.memberUids;
        allow write: if request.auth != null
          && request.auth.uid == get(/databases/$(database)/documents/rooms/$(roomId)).data.adminUid;
      }
    }
    match /users/{uid}/notifications/{notificationId} {
      // No server here (see below) — whichever client performs an action
      // (recording a payment, sending a reminder, handing off admin, ...)
      // writes the notification straight into the recipient's own inbox.
      // That means "create" has to be open to any signed-in user, not just
      // uid's own — the trade-off for not needing a paid backend is that
      // this can't verify the writer actually shares a room with uid.
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(["title", "body", "data", "read", "createdAt"])
        && request.resource.data.read == false;
      allow update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["read"]);
    }
  }
}
```
These are a sensible starting point — tighten them further for production (e.g.
restrict which fields members may change). Rooms created before this rule was
added won't have a `secrets/main` doc, so their members will see "Not available"
for the room password until the admin recreates the room.

### 4. Notifications (in-app only)
The bell icon in the app bar reads from `users/{uid}/notifications`. There's no
backend involved — sending real OS-level push notifications needs a server
(a Cloud Function calling FCM), which in turn needs the Firebase project on
the paid **Blaze** plan. To keep this entirely on the free **Spark** plan,
every notification-worthy action (a payment reminder, a payment recorded, an
admin handoff, an expense/refund added or reverted) writes directly into the
relevant member(s)' inbox from the client at the moment it happens — see
`notifyMember`/`notifyMembers` in `firebase.js`. The trade-off: notifications
only show up once someone has the app open (no push while it's closed), and
"Remind unpaid" only reaches members, not the OS notification tray.

> **Note on "valid Gmail":** the app checks the address is a well-formed Gmail
> address. Verifying someone actually *owns* it would need email verification /
> Google sign-in — a natural next step.

---

## Scripts
```bash
npm run dev       # local dev server
npm run build     # production build
npm run preview   # preview the build
```

## Tech
React 18 + Vite · Firebase Auth + Firestore · lucide-react. No CSS framework —
a custom "aurora glass" theme with an animated ₹ house-building background on
the rooms page.

## Project structure
```
src/main.jsx                 → mounts App
App.jsx                      → auth → rooms hub → dashboard routing
firebase.js                  → Auth + Firestore (rooms, membership, notifications)
utils.js  constants.js       → math (incl. carry-over) + tokens/defaults
components/
  AuthShell.jsx              → shared glass styling for auth pages
  AuthPage.jsx               → login / register
  RoomsHub.jsx               → create / join room
  HouseBuild.jsx             → animated ₹ house background
  Shared.jsx                 → app bar, aurora, toast, primitives
  Panels.jsx                 → overview, members, deposits, grocery, ledger
RoomExpenseSplit.jsx         → the room dashboard
```
# Room-Expense-Splitter
# Room-Expense-Splitter
# Expense-Splitter-Application
# Expense-Splitter-Application
# Room-Expense-Splitter
