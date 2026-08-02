"use client";

import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Only defined when NEXT_PUBLIC_CONVEX_URL is configured at build time, so
// deployments that haven't set up Convex yet keep working exactly as before
// (see CONVEX_ENABLED in page.tsx, which gates all Convex hook usage).
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
