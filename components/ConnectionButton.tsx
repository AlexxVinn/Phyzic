"use client";

import { useState } from "react";
import { useConnectionStatus } from "@/hooks/useConnections";
import { useAuth } from "./AuthProvider";

interface ConnectionButtonProps {
  targetId: string;
  size?: "sm" | "md";
}

export default function ConnectionButton({ targetId, size = "md" }: ConnectionButtonProps) {
  const auth = useAuth();
  const { status, direction, loading, connect, remove, block, unblock } = useConnectionStatus(
    auth.user?.id,
    targetId
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!auth.user || auth.user.id === targetId) return null;

  const height = size === "sm" ? 24 : 30;
  const pad = size === "sm" ? "0 8px" : "0 12px";
  const fontSize = size === "sm" ? 11 : 12;

  const baseStyle: React.CSSProperties = {
    height,
    padding: pad,
    borderRadius: 3,
    font: "inherit",
    fontSize,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    transition: "all 0.12s ease",
    whiteSpace: "nowrap",
  };

  if (status === "blocked") {
    return (
      <button
        type="button"
        style={{ ...baseStyle, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}
        onClick={unblock}
        disabled={loading}
      >
        Unblock
      </button>
    );
  }

  if (status === "pending" && direction === "incoming") {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          style={{ ...baseStyle, border: "1px solid var(--primary)", background: "var(--accent-soft)", color: "var(--primary)" }}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          Request pending
        </button>
        {menuOpen && (
          <div className="profile-dropdown-menu is-open" style={{ right: 0, top: "calc(100% + 4px)", minWidth: 160 }}>
            <button className="profile-dropdown-item" onClick={() => { setMenuOpen(false); remove(); }}>Cancel request</button>
          </div>
        )}
      </div>
    );
  }

  if (status === "pending" && direction === "outgoing") {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          style={{ ...baseStyle, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)" }}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Awaiting response
        </button>
        {menuOpen && (
          <div className="profile-dropdown-menu is-open" style={{ right: 0, top: "calc(100% + 4px)", minWidth: 160 }}>
            <button className="profile-dropdown-item" onClick={() => { setMenuOpen(false); remove(); }}>Withdraw request</button>
          </div>
        )}
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          style={{ ...baseStyle, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Connected
        </button>
        {menuOpen && (
          <div className="profile-dropdown-menu is-open" style={{ right: 0, top: "calc(100% + 4px)", minWidth: 180 }}>
            {!confirmRemove ? (
              <>
                <button className="profile-dropdown-item" onClick={() => setConfirmRemove(true)}>Remove connection</button>
                <button className="profile-dropdown-item" style={{ color: "var(--danger)" }} onClick={() => { setMenuOpen(false); block(); }}>Block user</button>
              </>
            ) : (
              <>
                <div className="profile-dropdown-item" style={{ fontSize: 11, color: "var(--text-muted)", pointerEvents: "none" }}>Confirm remove?</div>
                <button className="profile-dropdown-item" onClick={() => { setConfirmRemove(false); setMenuOpen(false); remove(); }}>Yes, remove</button>
                <button className="profile-dropdown-item" onClick={() => setConfirmRemove(false)}>Cancel</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      style={{ ...baseStyle, border: "none", background: "var(--primary)", color: "#fff" }}
      onClick={connect}
      disabled={loading}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
      Add colleague
    </button>
  );
}
