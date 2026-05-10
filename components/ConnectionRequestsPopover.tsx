"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePendingRequests } from "@/hooks/useConnections";
import Avatar from "./Avatar";
import { fmtRep, fmtShortDate } from "@/lib/utils";

export default function ConnectionRequestsPopover() {
  const { requests, respond } = usePendingRequests();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const count = requests.length;

  return (
    <div className="nav-anchor">
      <button
        ref={btnRef}
        type="button"
        className={`icon-btn ${count > 0 ? "has-dot" : ""}`}
        aria-label="Connection requests"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
        </svg>
      </button>
      <div
        ref={ref}
        className={`nav-popover nav-popover-profile ${open ? "is-open" : ""}`}
        style={{ minWidth: 320, maxWidth: 380, maxHeight: "min(400px, 80vh)" }}
      >
        <div className="popover-head flex items-center justify-between">
          <span>Connection requests</span>
          {count > 0 && <span className="text-xs text-muted">{count} pending</span>}
        </div>
        {requests.length === 0 && (
          <div className="popover-item text-muted" style={{ padding: "12px 6px" }}>No pending requests</div>
        )}
        {requests.map((r) => {
          const req = r.requester;
          if (!req) return null;
          return (
            <div key={r.id} className="popover-item" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 6px" }}>
              <Avatar url={req.avatar_url || null} name={req.username || "User"} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Link href={`/profile?u=${encodeURIComponent(req.username)}`} className="font-semibold" style={{ fontSize: 12 }} onClick={() => setOpen(false)}>
                    {req.username}
                  </Link>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtRep(req.reputation || 0)}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  {fmtShortDate(r.created_at)}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                    onClick={() => respond(r.id, "accepted")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                    onClick={() => respond(r.id, "declined")}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
