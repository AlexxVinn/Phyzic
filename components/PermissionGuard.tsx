"use client";

import { usePermissions } from "@/hooks/usePermissions";
import type { ReactNode } from "react";

interface PermissionGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  permission: keyof ReturnType<typeof usePermissions>;
}

export default function PermissionGuard({ children, fallback = null, permission }: PermissionGuardProps) {
  const perms = usePermissions();
  const allowed = !!perms[permission];
  if (!allowed) return fallback;
  return children;
}

export function AdminGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const perms = usePermissions();
  if (!perms.isAdmin) return fallback;
  return children;
}

export function ModeratorGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const perms = usePermissions();
  if (!perms.isModerator) return fallback;
  return children;
}

export function StaffGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const perms = usePermissions();
  if (!perms.isStaff) return fallback;
  return children;
}

export function ActiveUserGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const perms = usePermissions();
  if (!perms.isActive || perms.isSuspended) return fallback;
  return children;
}
