"use client";

import { useEffect } from "react";

export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dynamically import Sentry config only on the browser to prevent SSR crashes
    import("../../sentry.client.config");
  }, []);

  return <>{children}</>;
}
