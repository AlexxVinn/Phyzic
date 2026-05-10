import type { UserRole, UserStatus, Profile } from "@/components/AuthProvider";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  moderator: 50,
  verified: 20,
  contributor: 10,
  user: 0,
};

export function roleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function isAtLeast(role: UserRole, minRole: UserRole): boolean {
  return roleLevel(role) >= roleLevel(minRole);
}

export function isAdmin(role?: UserRole | null): boolean {
  return role === "admin";
}

export function isModerator(role?: UserRole | null): boolean {
  return role === "moderator" || role === "admin";
}

export function isStaff(role?: UserRole | null): boolean {
  return role === "admin" || role === "moderator";
}

export function isVerified(role?: UserRole | null): boolean {
  return isAtLeast(role || "user", "verified");
}

export function isContributor(role?: UserRole | null): boolean {
  return isAtLeast(role || "user", "contributor");
}

export function canModerate(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canAdmin(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function isAccountActive(status?: UserStatus | null): boolean {
  return status === "active";
}

export function isSuspended(status?: UserStatus | null): boolean {
  return status === "suspended" || status === "banned";
}

export function canVote(role?: UserRole | null, status?: UserStatus | null): boolean {
  return isAccountActive(status) && !isSuspended(status);
}

export function canPost(role?: UserRole | null, status?: UserStatus | null, reputation = 0): boolean {
  return isAccountActive(status) && !isSuspended(status) && reputation >= 0;
}

export function canComment(role?: UserRole | null, status?: UserStatus | null, reputation = 0): boolean {
  return isAccountActive(status) && !isSuspended(status) && reputation >= 0;
}

export function canEditAnyContent(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canDeleteAnyContent(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canManageUsers(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function canAssignRoles(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function canAdjustReputation(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function canFeatureContent(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function canViewAuditLogs(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canResolveReports(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canBanUser(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function canSuspendUser(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canWarnUser(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canLiftBan(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function canManageAnnouncements(role?: UserRole | null): boolean {
  return isAdmin(role);
}

export function canAccessDashboard(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function canViewDeletedContent(role?: UserRole | null): boolean {
  return isStaff(role);
}

export function hasPermission(profile: Profile | null, checker: (role?: UserRole | null, status?: UserStatus | null) => boolean): boolean {
  if (!profile) return false;
  return checker(profile.role, profile.status);
}

export const ROLE_META: Record<UserRole, { label: string; short: string; color: string; bg: string; border: string }> = {
  admin: { label: "Admin", short: "ADM", color: "#c0392b", bg: "#fdf2f2", border: "#f5c6cb" },
  moderator: { label: "Moderator", short: "MOD", color: "#27ae60", bg: "#eafaf1", border: "#c3e6cb" },
  verified: { label: "Verified", short: "VER", color: "#1da1f2", bg: "#e8f7fe", border: "#b8e0f7" },
  contributor: { label: "Contributor", short: "CTR", color: "#f39c12", bg: "#fef5e7", border: "#f9d89d" },
  user: { label: "User", short: "USR", color: "#7f8c8d", bg: "#f4f6f7", border: "#d5dbdb" },
};

export function roleMeta(role: UserRole) {
  return ROLE_META[role] || ROLE_META.user;
}
