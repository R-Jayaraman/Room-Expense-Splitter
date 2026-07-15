// ---------------------------------------------------------------------------
// Local (on-device) notifications — no server involved. There's no Cloud
// Function here (that'd need the paid Blaze plan; see README), so a true
// background push that wakes the app from fully closed isn't possible. This
// is the next best thing: while the app is running, every new item that
// lands in the in-app notification inbox (see firebase.js's
// subscribeNotifications) also gets posted as a real Android notification-
// tray banner via this plugin, as long as the user has granted permission.
// ---------------------------------------------------------------------------
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

// Requests the OS notification permission (Android 13+ requires an explicit
// prompt; older Android grants it at install time). Safe to call on every
// app open — it only actually prompts the user the first time.
export async function requestNotificationPermission() {
  if (!isNativePlatform()) return false;
  try {
    let status = (await LocalNotifications.checkPermissions()).display;
    if (status === "prompt" || status === "prompt-with-rationale") {
      status = (await LocalNotifications.requestPermissions()).display;
    }
    return status === "granted";
  } catch {
    return false;
  }
}

let nextId = 1;

// Posts an immediate native notification. No-ops silently if permission
// hasn't been granted or this isn't a native build — the in-app bell inbox
// is always the source of truth regardless of whether this succeeds.
export async function showLocalNotification({ title, body, data }) {
  if (!isNativePlatform()) return;
  try {
    const granted = (await LocalNotifications.checkPermissions()).display === "granted";
    if (!granted) return;
    await LocalNotifications.schedule({
      notifications: [{
        id: nextId++, title, body, extra: data || {},
        schedule: { at: new Date(Date.now() + 100) },
      }],
    });
  } catch {
    // Best-effort — never let a notification-display failure affect the app.
  }
}
