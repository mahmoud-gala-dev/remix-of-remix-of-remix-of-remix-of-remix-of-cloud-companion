import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Slim banner shown while the browser has no connectivity. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      You are offline — showing the last data loaded on this device.
    </div>
  );
}
