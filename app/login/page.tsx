"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.session) {
      const redirect = searchParams.get("redirect") || "/";
      router.replace(redirect);
    }
  }, [auth.session, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Enter email and password."); return; }
    setLoading(true);
    try {
      await auth.signInEmail(email, password);
      const redirect = searchParams.get("redirect") || "/";
      router.replace(redirect);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.signInGoogle();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <div className="auth-panel">
          <Link className="auth-brand" href="/">Phyzic</Link>
          <h1 className="auth-h1">Sign in</h1>
          <p className="auth-lead">Physics Q&amp;A workspace</p>

          {error && <div className="auth-alert auth-alert-error" role="alert">{error}</div>}

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="email">Email</label>
            <input className="auth-input" id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <label className="auth-label" htmlFor="password">Password</label>
            <input className="auth-input" id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "…" : "Sign in"}
            </button>
          </form>

          <button type="button" className="auth-oauth" onClick={handleGoogle} disabled={loading}>
            <span>Continue with Google</span>
          </button>

          <p className="auth-footer">
            No account? <Link href="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-layout">
          <div className="auth-panel">
            <div className="auth-brand">Phyzic</div>
            <p className="auth-lead">Loading…</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
