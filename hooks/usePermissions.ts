"use client";

import { useAuth } from "@/components/AuthProvider";
import type { UserRole, UserStatus } from "@/components/AuthProvider";
import {
  isAdmin,
  isModerator,
  isStaff,
  isVerified,
  isContributor,
  canModerate,
  canAdmin,
  canManageUsers,
  canAssignRoles,
  canAdjustReputation,
  canFeatureContent,
  canViewAuditLogs,
  canResolveReports,
  canBanUser,
  canSuspendUser,
  canWarnUser,
  canLiftBan,
  canManageAnnouncements,
  canAccessDashboard,
  canViewDeletedContent,
  canEditAnyContent,
  canDeleteAnyContent,
  canVote,
  canPost,
  canComment,
  isAccountActive,
  isSuspended,
  roleLevel,
} from "@/lib/permissions";

export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role || null;
  const status = profile?.status || null;
  const reputation = profile?.reputation || 0;

  return {
    role,
    status,
    reputation,
    level: roleLevel(role || "user"),
    isAdmin: isAdmin(role),
    isModerator: isModerator(role),
    isStaff: isStaff(role),
    isVerified: isVerified(role),
    isContributor: isContributor(role),
    isActive: isAccountActive(status),
    isSuspended: isSuspended(status),
    canVote: canVote(role, status),
    canPost: canPost(role, status, reputation),
    canComment: canComment(role, status, reputation),
    canModerate: canModerate(role),
    canAdmin: canAdmin(role),
    canManageUsers: canManageUsers(role),
    canAssignRoles: canAssignRoles(role),
    canAdjustReputation: canAdjustReputation(role),
    canFeatureContent: canFeatureContent(role),
    canViewAuditLogs: canViewAuditLogs(role),
    canResolveReports: canResolveReports(role),
    canBanUser: canBanUser(role),
    canSuspendUser: canSuspendUser(role),
    canWarnUser: canWarnUser(role),
    canLiftBan: canLiftBan(role),
    canManageAnnouncements: canManageAnnouncements(role),
    canAccessDashboard: canAccessDashboard(role),
    canViewDeletedContent: canViewDeletedContent(role),
    canEditAnyContent: canEditAnyContent(role),
    canDeleteAnyContent: canDeleteAnyContent(role),
  };
}

export function useHasRole(minRole: UserRole) {
  const { profile } = useAuth();
  const level = roleLevel(profile?.role || "user");
  return level >= roleLevel(minRole);
}
