"use client";

import type { UserRole } from "@/components/AuthProvider";
import { roleMeta } from "@/lib/permissions";

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function RoleBadge({ role, size = "sm", showLabel = true }: RoleBadgeProps) {
  const meta = roleMeta(role);
  const sizeStyles = {
    sm: { fontSize: 10, padding: "1px 6px", gap: 3, icon: 10 },
    md: { fontSize: 11, padding: "2px 8px", gap: 4, icon: 12 },
    lg: { fontSize: 12, padding: "3px 10px", gap: 5, icon: 14 },
  };
  const s = sizeStyles[size];

  const shieldSvg = (
    <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );

  const checkSvg = (
    <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );

  const starSvg = (
    <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill={meta.color} stroke={meta.color} strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );

  const icon = role === "admin" || role === "moderator" ? shieldSvg : role === "verified" ? checkSvg : role === "contributor" ? starSvg : null;

  return (
    <span
      className="role-badge"
      title={meta.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        fontSize: s.fontSize,
        fontWeight: 700,
        lineHeight: 1,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: 999,
        padding: s.padding,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {icon}
      {showLabel && meta.label}
    </span>
  );
}
