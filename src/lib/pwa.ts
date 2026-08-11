/**
 * Single, guarded service-worker registrar.
 *
 * Offline support must never activate in dev, inside the Lovable editor
 * preview, or in an iframe: a cached app shell there would serve stale HTML
 * and deleted chunks. `?sw=off` acts as a kill switch for installed apps.
 */
const SW_URL = "/sw.js";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => (registration.active?.scriptURL ?? "").includes(SW_URL))
      .map((registration) => registration.unregister()),
  );
}

/** Call once from a client effect. Safe to call in any environment. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const blocked =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    new URLSearchParams(window.location.search).get("sw") === "off";

  if (blocked) {
    void unregisterAppWorker();
    return;
  }

  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
    // Offline support is a progressive enhancement; ignore registration errors.
  });
}

/** True when the browser currently reports no connectivity. */
export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
