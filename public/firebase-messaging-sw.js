/* Firebase Cloud Messaging service worker.
   The Firebase web config is passed as a query parameter when the app registers
   this worker, so the admin can change it without a redeploy. */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;

function readConfig() {
  const raw = params.get("config");
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw));
  } catch (error) {
    console.error("[fcm-sw] invalid config parameter", error);
    return null;
  }
}

const config = readConfig();

if (config && config.apiKey && config.messagingSenderId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    self.registration.showNotification(notification.title || "ElectroPI Bug Tracker", {
      body: notification.body || "",
      icon: "/favicon.ico",
      data: { url: (payload.fcmOptions && payload.fcmOptions.link) || "/" },
    });
  });
} else {
  console.warn("[fcm-sw] Firebase config missing; background notifications are disabled.");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
