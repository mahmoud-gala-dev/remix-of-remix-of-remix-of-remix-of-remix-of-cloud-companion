import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared route-level boundaries so every data-loading route degrades
 * gracefully instead of blanking the app shell.
 */
export function RouteErrorBoundary({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter();

  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">This page didn't load</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{error.message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            router.invalidate();
            reset?.();
          }}
        >
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function RouteNotFound({ label = "page" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">We couldn't find that {label}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        It may have been deleted, or the link you followed is out of date.
      </p>
      <div className="mt-6">
        <Button variant="outline" asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
