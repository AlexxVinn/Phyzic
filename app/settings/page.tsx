"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { initials } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

const MAX_BIO = 500;
const MAX_FILE = 2 * 1024 * 1024;

const SETTINGS_SECTIONS = [
  { key: "account", label: "Account" },
  { key: "appearance", label: "Appearance" },
  { key: "notifications", label: "Notifications" },
  { key: "privacy", label: "Privacy" },
  { key: "editor", label: "LaTeX / Editor" },
  { key: "accessibility", label: "Accessibility" },
  { key: "interests", label: "Physics interests" },
] as const;

type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number]["key"];

export default function SettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  const [active, setActive] = useState<SettingsSectionKey>("account");
  const [gridTexture, setGridTexture] = useState(false);


  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push("/login");
    }
  }, [auth.loading, auth.user, router]);

  const populate = useCallback(async () => {
    let profile = auth.profile;
    if (!profile) {
      profile = await auth.refreshProfile();
    }
    if (!profile) {
      setError("Unable to load profile.");
      return;
    }
    setFullName(profile.full_name || "");
    setBio(profile.bio || "");
    setUsername(profile.username || "");
    setAvatarUrl(profile.avatar_url);
  }, [auth]);

  useEffect(() => {
    startTransition(() => { void populate(); });
  }, [populate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (username.length < 2) { setError("Username must be at least 2 characters."); return; }
    if (bio.length > MAX_BIO) { setError("Bio must be under " + MAX_BIO + " characters."); return; }
    setSaving(true);
    try {
      await auth.updateProfile({ username, full_name: fullName, bio });
      setInfo("Profile saved.");
    } catch (e: unknown) {
      setError((e as Error)?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setInfo("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE) { setError("Image must be under 2 MB."); return; }
    if (!/^image\//.test(file.type)) { setError("Please select an image."); return; }
    try {
      const url = await auth.uploadAvatar(file);
      setAvatarUrl(url);
      setInfo("Avatar uploaded.");
    } catch (e: unknown) {
      setError((e as Error)?.message || "Upload failed.");
    }
  };

  const renderAvatar = () => {
    if (avatarUrl) {
      return (
        <>
          <img src={avatarUrl} alt="" className="settings-avatar-img" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <span className="settings-avatar-fallback" style={{ display: "none" }}>{initials(fullName || username || "User")}</span>
        </>
      );
    }
    return <span className="settings-avatar-fallback">{initials(fullName || username || "User")}</span>;
  };


  useEffect(() => {
    try {
      const saved = localStorage.getItem("phyzic_texture");
      setGridTexture(saved === "grid");
    } catch {}
  }, []);

  useEffect(() => {
    const next = gridTexture ? "grid" : "";
    if (next) document.documentElement.setAttribute("data-texture", next);
    else document.documentElement.removeAttribute("data-texture");
    try {
      localStorage.setItem("phyzic_texture", next || "");
    } catch {}
  }, [gridTexture]);

  return (
    <div className="app">
      <Navbar />
      <div className="shell shell-no-right">
        <Sidebar />
        <main className="main">
          <div className="settings-root">
            <div className="settings-layout">
              <aside className="settings-nav" aria-label="Settings navigation">
                <div className="settings-nav-title">Settings</div>
                {SETTINGS_SECTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`settings-nav-item ${active === s.key ? "is-active" : ""}`}
                    onClick={() => setActive(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </aside>

              <section className="settings-panel">
                <h1>Settings</h1>
                <p className="sub">Account, appearance, and technical preferences.</p>

                {error && <div className="auth-alert auth-alert-error" role="alert">{error}</div>}
                {info && <div className="auth-alert" role="alert">{info}</div>}

                {active === "account" && (
                  <div className="settings-section">
                    <h2 className="settings-section-title">Profile</h2>
                    <form id="settingsForm" className="settings-form" noValidate onSubmit={handleSave}>
                      <div className="settings-avatar-wrap">
                        <div className="settings-avatar">{renderAvatar()}</div>
                        <label className="settings-avatar-label">
                          <input type="file" id="settingsAvatarFile" accept="image/*" hidden onChange={handleAvatar} />
                          <span className="btn-secondary">Change avatar</span>
                        </label>
                      </div>

                      <label className="auth-label" htmlFor="settingsUsername">Username</label>
                      <input className="auth-input" id="settingsUsername" name="username" type="text" minLength={2} maxLength={32} required value={username} onChange={(e) => setUsername(e.target.value)} />

                      <label className="auth-label" htmlFor="settingsFullName">Full name</label>
                      <input className="auth-input" id="settingsFullName" name="full_name" type="text" maxLength={64} value={fullName} onChange={(e) => setFullName(e.target.value)} />

                      <label className="auth-label" htmlFor="settingsBio">Bio</label>
                      <textarea className="auth-input" id="settingsBio" name="bio" rows={4} maxLength={500} placeholder="Short, technical bio…" value={bio} onChange={(e) => setBio(e.target.value)} />

                      <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
                    </form>
                  </div>
                )}

                {active === "appearance" && (
                  <>
                    <div className="settings-section">
                      <h2 className="settings-section-title">Reading</h2>
                      <div className="toggle-row">
                        <div className="meta">
                          <div className="name">Faint grid texture</div>
                          <div className="desc">Optional low-contrast graph-paper background.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={gridTexture}
                          onChange={(e) => setGridTexture(e.target.checked)}
                          aria-label="Toggle grid texture"
                        />
                      </div>
                    </div>

                    <div className="settings-section">
                      <h2 className="settings-section-title">Theme</h2>
                      <div className="rc-muted">Use the theme toggle in the top bar.</div>
                    </div>
                  </>
                )}

                {active === "editor" && (
                  <>
                    <div className="settings-section">
                      <h2 className="settings-section-title">LaTeX</h2>
                      <div className="rc-muted">Inline: <code>$…$</code> or <code>\(…\)</code>. Display: <code>$$…$$</code> or <code>\[…\]</code>.</div>
                    </div>
                    <div className="settings-section">
                      <h2 className="settings-section-title">Formatting</h2>
                      <div className="rc-muted">Prefer derivations, define symbols, and cite sources when relevant.</div>
                    </div>
                  </>
                )}

                {active === "notifications" && (
                  <div className="settings-section">
                    <h2 className="settings-section-title">Notifications</h2>
                    <div className="rc-muted">Notification preferences will appear here.</div>
                  </div>
                )}

                {active === "privacy" && (
                  <div className="settings-section">
                    <h2 className="settings-section-title">Privacy</h2>
                    <div className="rc-muted">Privacy controls will appear here.</div>
                  </div>
                )}

                {active === "accessibility" && (
                  <div className="settings-section">
                    <h2 className="settings-section-title">Accessibility</h2>
                    <div className="rc-muted">Accessibility options will appear here.</div>
                  </div>
                )}

                {active === "interests" && (
                  <div className="settings-section">
                    <h2 className="settings-section-title">Topics</h2>
                    <div className="rc-muted">Topic subscriptions will appear here.</div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
