"use client";

import { useEffect } from "react";
import "../../sentry.client.config";

export function SentryProvider({ children }: { children: React.ReactNode }) {
  // Sentry is initialized when the file is imported above
  return <>{children}</>;
}
