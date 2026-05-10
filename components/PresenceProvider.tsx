"use client";

import { usePresenceHeartbeat } from "@/hooks/useMessaging";

export default function PresenceProvider({ children }: { children: React.ReactNode }) {
  usePresenceHeartbeat();
  return <>{children}</>;
}
