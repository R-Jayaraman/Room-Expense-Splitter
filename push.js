// ---------------------------------------------------------------------------
// Push notifications — native FCM delivery via Capacitor, for the Android/iOS
// app shell only (no-ops on web, where this plugin has nothing to register).
// The actual "who gets notified about what" logic lives server-side in a
// Cloud Function that watches Firestore; this file only handles registering
// this device and saving its token so that function knows where to send.
// ---------------------------------------------------------------------------
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { saveFcmToken } from "./firebase";

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

// capacitor.config.json's appFlags.pushReady is a build-time switch, flipped
// to true only once android/app/google-services.json is in place (i.e. an
// Android app is actually registered in the Firebase console). Until then,
// PushNotifications.register() calls FirebaseMessaging.getInstance(), which
// throws natively ("Default FirebaseApp is not initialized") because there's
// no Firebase config baked into this build. Capacitor's bridge re-throws
// plugin exceptions on the main thread instead of rejecting the JS promise
// (see Bridge.java's callPluginMethod), so this is an uncatchable native
// crash from JS's point of view — a try/catch here can't stop it. The only
// safe fix is to not call register() at all until the flag says it's ready.
function pushReady() {
  return Boolean(Capacitor.getConfig()?.appFlags?.pushReady);
}

// Requests notification permission (if not already decided) — this always
// runs so the user gets the OS prompt and their allow/deny choice is
// respected — but only proceeds to native FCM registration once pushReady()
// is true. Safe to call every time the app opens.
export async function initPushNotifications(uid) {
  if (!isNativePlatform() || !uid) return;
  try {
    let status = (await PushNotifications.checkPermissions()).receive;
    if (status === "prompt" || status === "prompt-with-rationale") {
      status = (await PushNotifications.requestPermissions()).receive;
    }
    if (status !== "granted" || !pushReady()) return;

    PushNotifications.addListener("registration", (token) => {
      saveFcmToken(uid, token.value).catch(() => {});
    });
    PushNotifications.addListener("registrationError", () => {});

    await PushNotifications.register();
  } catch {
    // Native push plugin unavailable — the app still works fully without
    // it, so fail silently (permission check/request itself never throws).
  }
}

// Lets a component react to a push arriving while the app is in the
// foreground (e.g. to surface it as an in-app toast). Returns an unsubscribe
// function; no-ops on web.
export function onPushReceived(callback) {
  if (!isNativePlatform()) return () => {};
  const handle = PushNotifications.addListener("pushNotificationReceived", (notification) => {
    callback({ title: notification.title, body: notification.body });
  });
  return () => handle.remove();
}

// Fires when the user taps a notification (whether the app was backgrounded
// or cold-started by the tap — Capacitor queues the launch notification and
// delivers it once a listener is attached). `data.roomId`/`data.tab` are the
// deep-link fields the Cloud Function attaches to every push it sends (see
// functions/index.js), letting the caller route straight to the right room
// and tab instead of just opening to wherever the app last was.
export function onPushTapped(callback) {
  if (!isNativePlatform()) return () => {};
  const handle = PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification?.data || {};
    if (!data.roomId) return;
    callback({ roomId: data.roomId, tab: data.tab || null });
  });
  return () => handle.remove();
}
