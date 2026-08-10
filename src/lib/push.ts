/**
 * Browser-side Firebase Cloud Messaging helper.
 * Firebase is imported lazily so it never runs during server rendering.
 */
export type FirebaseWebConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    typeof window.PushManager !== "undefined"
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Asks for notification permission and returns the FCM registration token.
 * Throws a readable error when the browser or configuration blocks it.
 */
export async function requestPushToken(
  config: FirebaseWebConfig,
  vapidKey: string,
): Promise<string> {
  if (!isPushSupported()) throw new Error("This browser does not support push notifications.");
  if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
    throw new Error("Firebase is not fully configured yet. Ask an admin to finish the setup.");
  }
  if (!vapidKey) throw new Error("The Firebase Web Push certificate key (VAPID) is missing.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const [{ initializeApp, getApps, getApp }, { getMessaging, getToken }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);

  const app = getApps().length ? getApp() : initializeApp(config);
  const encoded = btoa(JSON.stringify(config));
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?config=${encodeURIComponent(encoded)}`,
  );
  const token = await getToken(getMessaging(app), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Firebase did not return a device token.");
  return token;
}

/** Shows foreground notifications while the app is open. */
export async function listenForForegroundPush(
  config: FirebaseWebConfig,
  onMessage: (title: string, body: string) => void,
) {
  if (!isPushSupported() || !config.apiKey) return () => {};
  const [{ initializeApp, getApps, getApp }, messagingModule] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  const app = getApps().length ? getApp() : initializeApp(config);
  return messagingModule.onMessage(messagingModule.getMessaging(app), (payload) => {
    onMessage(
      payload.notification?.title ?? "New notification",
      payload.notification?.body ?? "",
    );
  });
}
