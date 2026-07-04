# Room Split 🏠₹

A roommate expense splitter for rent, electricity and groceries — with real user
accounts, shared rooms, an admin who manages bills, automatic monthly resets,
carry-over credit when amounts change, and optional email reminders. Amounts are
in Rupees (₹) and dates use IST.

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
  }
}
```
These are a sensible starting point — tighten them further for production (e.g.
restrict which fields members may change). Rooms created before this rule was
added won't have a `secrets/main` doc, so their members will see "Not available"
for the room password until the admin recreates the room.

### 4. Email reminders (optional)
Uses [EmailJS](https://www.emailjs.com). Add your keys to `.env`:
```
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
```
Create a template using the fields in `email-template.html` (`to_email`,
`to_name`, `room_name`, `admin_name`, `email_title`, `email_message`, `amount`).
Without these keys the app works fine; the email buttons just show a hint.

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
React 18 + Vite · Firebase Auth + Firestore · EmailJS · lucide-react. No CSS
framework — a custom "aurora glass" theme with an animated ₹ house-building
background on the rooms page.

## Project structure
```
src/main.jsx                 → mounts App
App.jsx                      → auth → rooms hub → dashboard routing
firebase.js                  → Auth + Firestore (rooms, membership)
email.js                     → EmailJS wrapper
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
