"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function SignupPage() {
  const auth = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.session) {
      router.replace("/");
    }
  }, [auth.session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (username.length < 2) { setError("Username must be at least 2 characters."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const data = await auth.signUpEmail(email, password, username);
      if (data.session) {
        router.replace("/");
      } else {
        setInfo("Check your email to confirm your account, then sign in.");
      }
    } catch (err: any) {
      setError(err.message || "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.signInGoogle();
    } catch (err: any) {
      setError(err.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <div className="auth-panel">
          <Link className="auth-brand" href="/">Phyzic</Link>
          <h1 className="auth-h1">Create account</h1>
          <p className="auth-lead">Join the workspace</p>

          {error && <div className="auth-alert auth-alert-error" role="alert">{error}</div>}
          {info && <div className="auth-alert" role="alert">{info}</div>}

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="username">Username</label>
            <input className="auth-input" id="username" name="username" type="text" autoComplete="username" minLength={2} maxLength={32} required value={username} onChange={(e) => setUsername(e.target.value)} />

            <label className="auth-label" htmlFor="email">Email</label>
            <input className="auth-input" id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <label className="auth-label" htmlFor="password">Password</label>
            <input className="auth-input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "…" : "Create account"}
            </button>
          </form>

          <button type="button" className="auth-oauth" onClick={handleGoogle} disabled={loading}>
            <span>Continue with Google</span>
          </button>

          <p className="auth-footer">
            Have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
