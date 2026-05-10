"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { useNotifications } from "@/hooks/useNotifications";
import { useSearch } from "@/hooks/useSearch";
import RoleBadge from "./RoleBadge";
import Avatar from "./Avatar";
import ConnectionRequestsPopover from "./ConnectionRequestsPopover";
import ChatDock from "./ChatDock";
import { fmtRep, fmtShortDate } from "@/lib/utils";

export default function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const auth = useAuth();
  const perms = usePermissions();
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { results: searchResults, loading: searchLoading } = useSearch(searchQuery);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const popoverRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("phyzic_theme", next);
    } catch {}
  }, [theme]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!popoverRef.current?.contains(t) && !btnRef.current?.contains(t)) setProfileOpen(false);
      if (!notifRef.current?.contains(t) && !notifBtnRef.current?.contains(t)) setNotifOpen(false);
      if (!searchRef.current?.contains(t)) setSearchOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName || "")) {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName || "")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("phyzic-toggle-chat"));
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const name = auth.profile?.username || auth.user?.email?.split("@")[0] || "…";
  const rep = auth.profile?.reputation ?? 0;

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (isAuthPage) return null;

  return (
    <>
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <Link className="brand" href="/">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            Phyzic
          </Link>
          {onToggleSidebar && (
            <button type="button" className="sidebar-toggle" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            </button>
          )}
        </div>
        <div className="navbar-search-wrap" ref={searchRef}>
          <form className="navbar-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <svg className="navbar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <label className="sr-only" htmlFor="siteSearch">Search</label>
            <input
              id="siteSearch"
              ref={searchInputRef}
              name="q"
              type="search"
              placeholder="Search questions, tags, users…"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
            <kbd className="search-kbd">/</kbd>
          </form>
          <div className={`nav-popover search-popover ${searchOpen ? "is-open" : ""}`}>
            {searchLoading && <div className="popover-item text-muted">Searching…</div>}
            {!searchLoading && searchResults.length === 0 && searchQuery.trim() && (
              <div className="popover-item text-muted">No results</div>
            )}
            {!searchLoading && searchResults.map((r) => (
              <Link
                key={`${r.type}-${r.id}`}
                href={r.type === "question" ? `/question/${r.id}` : r.type === "tag" ? `/?tag=${encodeURIComponent(r.id)}` : `/profile?u=${encodeURIComponent(r.title || r.id)}`}
                className="popover-item"
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              >
                <span className="font-semibold">{r.title}</span>
                {r.subtitle && <small>{r.subtitle}</small>}
                {r.tags && <small>{r.tags.join(", ")}</small>}
              </Link>
            ))}
          </div>
        </div>
        <div className="navbar-actions">
          <button type="button" className="icon-btn theme-toggle" aria-label="Toggle theme" onClick={toggleTheme}>
            <span className="icon-sun">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            </span>
            <span className="icon-moon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </span>
          </button>
          {auth.user && (
            <div className="nav-anchor">
              <button
                ref={notifBtnRef}
                type="button"
                className={`icon-btn ${unreadCount > 0 ? "has-dot" : ""}`}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={(e) => { e.stopPropagation(); setNotifOpen((v) => !v); setProfileOpen(false); }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </button>
              <div
                ref={notifRef}
                className={`nav-popover nav-popover-profile ${notifOpen ? "is-open" : ""}`}
                style={{ minWidth: 320, maxWidth: 380 }}
              >
                <div className="popover-head flex items-center justify-between">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <button className="text-xs text-primary hover:underline" style={{ color: "var(--primary)" }} onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                {notifications.length === 0 && (
                  <div className="popover-item text-muted">No notifications</div>
                )}
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link || "/"}
                    className={`popover-item ${!n.read ? "bg-surface-2" : ""}`}
                    style={!n.read ? { background: "var(--accent-soft)" } : undefined}
                    onClick={() => { if (!n.read) markRead(n.id); setNotifOpen(false); }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{n.title}</span>
                      <span className="text-xs text-muted">{fmtShortDate(n.created_at)}</span>
                    </div>
                    {n.body && <small>{n.body}</small>}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {auth.user && <ConnectionRequestsPopover />}
          <div className="nav-anchor nav-anchor-profile">
            <button
              ref={btnRef}
              type="button"
              className="profile-chip"
              aria-expanded={profileOpen}
              aria-controls="popoverProfile"
              aria-label="Account"
              onClick={(e) => { e.stopPropagation(); setProfileOpen((v) => !v); setNotifOpen(false); }}
            >
              <Avatar url={auth.profile?.avatar_url || null} name={name} size={24} />
              <span className="profile-chip-meta hidden md:flex">
                <span className="profile-chip-name">{name}</span>
                <span className="profile-chip-rep">{fmtRep(rep)}</span>
              </span>
              <svg className="profile-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div
              ref={popoverRef}
              id="popoverProfile"
              className={`nav-popover nav-popover-profile ${profileOpen ? "is-open" : ""}`}
              style={{ minWidth: 220 }}
            >
              {auth.user ? (
                <>
                  <div className="popover-item" style={{ cursor: "default" }}>
                    <div className="font-semibold">{auth.profile?.full_name || name}</div>
                    <small>{auth.user.email}</small>
                    {auth.profile?.role && auth.profile.role !== "user" && (
                      <div className="mt-1"><RoleBadge role={auth.profile.role} size="sm" /></div>
                    )}
                  </div>
                  <div className="popover-divider" />
                  <Link href="/profile" className="popover-item" onClick={() => setProfileOpen(false)}>Profile</Link>
                  <Link href="/settings" className="popover-item" onClick={() => setProfileOpen(false)}>Settings</Link>
                  {perms.isStaff && (
                    <>
                      <div className="popover-divider" />
                      <Link href="/admin" className="popover-item" onClick={() => setProfileOpen(false)}>Admin</Link>
                      <Link href="/moderator" className="popover-item" onClick={() => setProfileOpen(false)}>Moderator</Link>
                    </>
                  )}
                  <div className="popover-divider" />
                  <button type="button" className="popover-item" onClick={() => { auth.signOut(); setProfileOpen(false); }}>Sign out</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="popover-item" onClick={() => setProfileOpen(false)}>Sign in</Link>
                  <Link href="/signup" className="popover-item" onClick={() => setProfileOpen(false)}>Create account</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
    {auth.user && <ChatDock />}
    </>
  );
}
