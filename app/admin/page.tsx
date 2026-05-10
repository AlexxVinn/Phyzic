"use client";

import { useEffect, useState, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import RoleBadge from "@/components/RoleBadge";
import Navbar from "@/components/Navbar";
import { fmtShortDate } from "@/lib/utils";
import type { UserRole } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase";

const useMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
};

interface UserListItem {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  status: string;
  reputation: number;
  created_at: string;
}

interface AuditItem {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
  actor_id: string;
}

interface ReportItem {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_id: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const perms = usePermissions();
  const [tab, setTab] = useState<"users" | "audit" | "reports" | "test">("users");
  const [testCount, setTestCount] = useState(5);
  const [testPreview, setTestPreview] = useState<{ title: string; body: string; tags: string[] }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [search, setSearch] = useState("");
  const mounted = useMounted();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      if (tab === "users") {
        const { data, error: err } = await supabase
          .from("profiles")
          .select("id,username,full_name,role,status,reputation,created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (err) throw err;
        setUsers(data || []);
      } else if (tab === "audit") {
        const { data, error: err } = await supabase
          .from("audit_logs")
          .select("id,action,target_type,target_id,reason,created_at,actor_id")
          .order("created_at", { ascending: false })
          .limit(200);
        if (err) throw err;
        setAudit(data || []);
      } else if (tab === "reports") {
        const { data, error: err } = await supabase
          .from("reports")
          .select("id,target_type,target_id,reason,status,created_at,reporter_id")
          .order("created_at", { ascending: false })
          .limit(200);
        if (err) throw err;
        setReports(data || []);
      }
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!user) return;
    if (!perms.isAdmin) {
      router.replace("/");
      return;
    }
    startTransition(() => { loadData(); });
  }, [user, perms.isAdmin, tab, loadData, router]);

  async function assignRole(userId: string, newRole: UserRole) {
    if (!perms.isAdmin) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc("assign_role", {
        p_target_id: userId,
        p_new_role: newRole,
        p_actor_id: profile?.id,
      });
      if (err) throw err;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function adjustReputation(userId: string) {
    if (!perms.isAdmin) return;
    const deltaStr = prompt("Reputation delta (e.g. 50 or -20):");
    if (!deltaStr) return;
    const delta = parseInt(deltaStr, 10);
    if (Number.isNaN(delta)) return;
    const reason = prompt("Reason:") || "Admin adjustment";
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc("adjust_reputation", {
        p_user_id: userId,
        p_delta: delta,
        p_reason: reason,
        p_actor_id: profile?.id,
      });
      if (err) throw err;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, reputation: u.reputation + delta } : u)));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function banUser(userId: string) {
    if (!perms.isAdmin) return;
    const reason = prompt("Ban reason:");
    if (!reason) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc("ban_user", {
        p_user_id: userId,
        p_reason: reason,
        p_issued_by: profile?.id,
      });
      if (err) throw err;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "banned" } : u)));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function unbanUser(userId: string) {
    if (!perms.isAdmin) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc("unban_user", {
        p_user_id: userId,
        p_lifted_by: profile?.id,
      });
      if (err) throw err;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u)));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function resolveReport(reportId: string) {
    if (!perms.isStaff) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("reports")
        .update({ status: "resolved", resolved_by: profile?.id, resolved_at: new Date().toISOString() })
        .eq("id", reportId);
      if (err) throw err;
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: "resolved" } : r)));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  const TEST_TITLES = [
    "Evaluating the path integral for a harmonic oscillator in Euclidean time",
    "Deriving the stress-energy tensor for a scalar field on curved spacetime",
    "Quantum mechanical expectation value of position in an infinite potential well",
    "Fourier expansion of the electric field in a cylindrical cavity resonator",
    "Calculating the partition function for a Fermi gas at finite temperature",
    "Tensor decomposition of the Riemann curvature tensor in n dimensions",
    "Scattering amplitude via Mandelstam variables for Compton scattering",
    "Solving the Dirac equation in a constant electromagnetic field background",
    "Legendre polynomial expansion of the gravitational potential for an oblate spheroid",
    "Canonical quantization of the electromagnetic field in Coulomb gauge",
    "Renormalization of the two-point function in phi-4 theory at one loop",
    "Berry phase accumulation for a spin-1/2 particle in a rotating magnetic field",
    "Hydrodynamic fluctuation-dissipation theorem for a viscous relativistic fluid",
    "Grand potential of a Bose-Einstein condensate in a harmonic trap",
    "Wigner function for a squeezed vacuum state in quantum optics",
  ];

  const TEST_FORMULAS = [
    `The action for a relativistic point particle is given by
$$S = -m \\int_{\\tau_i}^{\\tau_f} \\sqrt{-g_{\\mu\\nu} \\dot{x}^{\\mu} \\dot{x}^{\\nu}} \\, d\\tau$$
where $\\dot{x}^{\\mu} = \\frac{dx^{\\mu}}{d\\tau}$. Varying this leads to the geodesic equation
$$\\frac{d^2 x^{\\lambda}}{d\\tau^2} + \\Gamma^{\\lambda}_{\\mu\\nu} \\frac{dx^{\\mu}}{d\\tau} \\frac{dx^{\\nu}}{d\\tau} = 0$$
with the Christoffel symbols defined as
$$\\Gamma^{\\lambda}_{\\mu\\nu} = \\frac{1}{2} g^{\\lambda\\sigma} \\left( \\partial_{\\mu} g_{\\nu\\sigma} + \\partial_{\\nu} g_{\\mu\\sigma} - \\partial_{\\sigma} g_{\\mu\\nu} \\right).$$`,

    `Consider the generating functional for a scalar field:
$$Z[J] = \\int \\mathcal{D}\\phi \\, \\exp\\left( i \\int d^4x \\left[ \\mathcal{L}(\\phi) + J(x)\\phi(x) \\right] \\right).$$
The connected Green's functions are obtained via
$$G_c(x_1,\\dots,x_n) = \\frac{1}{i^n} \\frac{\\delta^n W[J]}{\\delta J(x_1) \\cdots \\delta J(x_n)}\\bigg|_{J=0}$$
where $W[J] = -i \\ln Z[J]$. For the free theory with
$$\\mathcal{L}_0 = \\frac{1}{2} (\\partial_{\\mu}\\phi)(\\partial^{\\mu}\\phi) - \\frac{1}{2} m^2 \\phi^2,$$
the propagator satisfies
$$(\\Box + m^2) D_F(x-y) = -i \\delta^{(4)}(x-y).$$`,

    `In quantum mechanics, the time-evolution operator in the interaction picture is
$$U_I(t,t_0) = T \\exp\\left( -i \\int_{t_0}^{t} V_I(t') \\, dt' \\right)$$
where $T$ denotes time ordering. The S-matrix is $S = \\lim_{t\\to\\infty} U_I(t,-t)$. The transition amplitude between states $|i\\rangle$ and $|f\\rangle$ is
$$\\mathcal{A}_{fi} = \\langle f | S | i \\rangle = \\sum_{n=0}^{\\infty} \\frac{(-i)^n}{n!} \\int_{-\\infty}^{\\infty} dt_1 \\cdots dt_n \\, \\langle f | T \\{ V_I(t_1) \\cdots V_I(t_n) \\} | i \\rangle.$$
Feynman diagrams provide a graphical representation of each term in this Dyson series.`,

    `The Riemann curvature tensor is defined via the commutator of covariant derivatives:
$$[\\nabla_{\\mu}, \\nabla_{\\nu}] V^{\\rho} = R^{\\rho}{}_{\\sigma\\mu\\nu} V^{\\sigma}.$$
In terms of Christoffel symbols:
$$R^{\\rho}{}_{\\sigma\\mu\\nu} = \\partial_{\\mu} \\Gamma^{\\rho}_{\\nu\\sigma} - \\partial_{\\nu} \\Gamma^{\\rho}_{\\mu\\sigma} + \\Gamma^{\\rho}_{\\mu\\lambda} \\Gamma^{\\lambda}_{\\nu\\sigma} - \\Gamma^{\\rho}_{\\nu\\lambda} \\Gamma^{\\lambda}_{\\mu\\sigma}.$$
The Ricci tensor and scalar are contractions:
$$R_{\\mu\\nu} = R^{\\lambda}{}_{\\mu\\lambda\\nu}, \\qquad R = g^{\\mu\\nu} R_{\\mu\\nu}.$$
Einstein's field equations read
$$G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}$$
where $G_{\\mu\\nu} = R_{\\mu\\nu} - \\frac{1}{2} g_{\\mu\\nu} R$ is the Einstein tensor.`,

    `For a spin-$\\frac{1}{2}$ field, the Dirac equation is
$$(i \\gamma^{\\mu} \\partial_{\\mu} - m) \\psi(x) = 0.$$
The gamma matrices satisfy the Clifford algebra
$$\\{ \\gamma^{\\mu}, \\gamma^{\\nu} \\} = 2 g^{\\mu\\nu} \\mathbf{1}.$$
The adjoint spinor is $\\bar{\\psi} = \\psi^{\\dagger} \\gamma^0$. The Lagrangian density is
$$\\mathcal{L} = \\bar{\\psi} (i \\gamma^{\\mu} \\partial_{\\mu} - m) \\psi.$$
The conserved Noether current is $j^{\\mu} = \\bar{\\psi} \\gamma^{\\mu} \\psi$, satisfying $\\partial_{\\mu} j^{\\mu} = 0$.`,

    `The partition function for the canonical ensemble is
$$Z = \\sum_i e^{-\\beta E_i} = \\mathrm{Tr}\\, e^{-\\beta \\hat{H}}$$
where $\\beta = 1/(k_B T)$. The Helmholtz free energy is $F = -k_B T \\ln Z$. For a quantum harmonic oscillator with $\\hat{H} = \\hbar\\omega(\\hat{a}^{\\dagger}\\hat{a} + \\frac{1}{2})$, the partition function evaluates to
$$Z = \\frac{e^{-\\beta \\hbar\\omega/2}}{1 - e^{-\\beta \\hbar\\omega}}.$$
The mean energy follows from
$$\\langle E \\rangle = -\\frac{\\partial \\ln Z}{\\partial \\beta} = \\frac{\\hbar\\omega}{2} + \\frac{\\hbar\\omega}{e^{\\beta\\hbar\\omega} - 1}.$$`,

    `Maxwell's equations in covariant form are
$$\\partial_{\\mu} F^{\\mu\\nu} = \\mu_0 J^{\\nu}, \\qquad \\partial_{[\\mu} F_{\\nu\\rho]} = 0$$
where $F_{\\mu\\nu} = \\partial_{\\mu} A_{\\nu} - \\partial_{\\nu} A_{\\mu}$ is the field strength tensor. In terms of the electric and magnetic fields:
$$F^{0i} = -\\frac{E^i}{c}, \\qquad F^{ij} = -\\varepsilon^{ijk} B_k.$$
The energy-momentum tensor of the electromagnetic field is
$$T^{\\mu\\nu} = \\frac{1}{\\mu_0} \\left( F^{\\mu}{}_{\\rho} F^{\\nu\\rho} - \\frac{1}{4} g^{\\mu\\nu} F_{\\rho\\sigma} F^{\\rho\\sigma} \\right).$$`,

    `The path integral for a non-relativistic particle is
$$K(x_f, t_f; x_i, t_i) = \\int_{x(t_i)=x_i}^{x(t_f)=x_f} \\mathcal{D}x(t) \\, e^{\\frac{i}{\\hbar} S[x(t)]}$$
with $S = \\int_{t_i}^{t_f} \\left( \\frac{m}{2} \\dot{x}^2 - V(x) \\right) dt$. For the harmonic oscillator $V = \\frac{1}{2} m \\omega^2 x^2$, the propagator evaluates to
$$K = \\sqrt{\\frac{m\\omega}{2\\pi i \\hbar \\sin(\\omega T)}} \\exp\\left( \\frac{i m \\omega}{2 \\hbar \\sin(\\omega T)} \\left[ (x_i^2 + x_f^2) \\cos(\\omega T) - 2 x_i x_f \\right] \\right)$$
where $T = t_f - t_i$.`,

    `In statistical field theory, the O(n) model has Landau-Ginzburg-Wilson Hamiltonian
$$\\mathcal{H} = \\int d^d x \\left[ \\frac{1}{2} (\\nabla \\vec{\\phi})^2 + \\frac{r_0}{2} \\vec{\\phi}^2 + \\frac{u_0}{4!} (\\vec{\\phi}^2)^2 \\right]$$
where $\\vec{\\phi}$ is an n-component field. The renormalization group equation for the coupling $u$ at one-loop order is
$$\\frac{du}{d\\ln\\mu} = \\varepsilon u - \\frac{n+8}{6} \\frac{u^2}{(4\\pi)^2} + O(u^3)$$
in $d = 4 - \\varepsilon$ dimensions, giving the Wilson-Fisher fixed point $u^* = \\frac{6(4\\pi)^2 \\varepsilon}{n+8}$.`,

    `The Wigner function for a quantum state $\\hat{\\rho}$ is defined as
$$W(x,p) = \\frac{1}{\\pi\\hbar} \\int_{-\\infty}^{\\infty} dy \\, e^{-2ipy/\\hbar} \\langle x+y | \\hat{\\rho} | x-y \\rangle.$$
For a squeezed vacuum state with squeezing parameter $r$, the Wigner function is a Gaussian:
$$W(x,p) = \\frac{1}{\\pi\\hbar} \\exp\\left( -\\frac{x^2}{\\sigma_x^2} - \\frac{p^2}{\\sigma_p^2} \\right)$$
where $\\sigma_x = e^{-r} \\sqrt{\\hbar/2}$ and $\\sigma_p = e^{r} \\sqrt{\\hbar/2}$, satisfying $\\sigma_x \\sigma_p = \\hbar/2$.`,
  ];

  const TEST_TAGS = [
    ["classical-mechanics", "general-relativity", "differential-geometry"],
    ["quantum-field-theory", "path-integral", "mathematical-physics"],
    ["quantum-mechanics", "scattering", "perturbation-theory"],
    ["general-relativity", "differential-geometry", "cosmology"],
    ["quantum-field-theory", "dirac-equation", "spinors"],
    ["statistical-mechanics", "quantum-statistics", "thermodynamics"],
    ["electromagnetism", "classical-field-theory", "relativity"],
    ["quantum-mechanics", "path-integral", "harmonic-oscillator"],
    ["statistical-mechanics", "renormalization", "critical-phenomena"],
    ["quantum-optics", "quantum-information", "squeezed-states"],
  ];

  function generatePreview(count: number) {
    const items: { title: string; body: string; tags: string[] }[] = [];
    for (let i = 0; i < count; i++) {
      const title = TEST_TITLES[Math.floor(Math.random() * TEST_TITLES.length)];
      const body = TEST_FORMULAS[Math.floor(Math.random() * TEST_FORMULAS.length)];
      const tags = TEST_TAGS[Math.floor(Math.random() * TEST_TAGS.length)];
      items.push({ title, body, tags });
    }
    return items;
  }

  async function insertTestQuestions(count: number) {
    if (!perms.isAdmin || !user) return;
    setGenerating(true);
    setError("");
    try {
      const supabase = createClient();
      const items = generatePreview(count);
      const rows = items.map((item) => ({
        author_id: user.id,
        title: item.title,
        body: item.body,
        tags: item.tags,
      }));
      const { error: err } = await supabase.from("questions").insert(rows);
      if (err) throw err;
      alert(`Inserted ${count} test question${count > 1 ? "s" : ""}.`);
      setTestPreview([]);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to insert test questions");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteTestQuestions() {
    if (!perms.isAdmin || !user) return;
    const confirmed = confirm("Delete ALL test questions? This will remove questions whose titles match the test data list.");
    if (!confirmed) return;
    setGenerating(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("questions")
        .delete()
        .in("title", TEST_TITLES);
      if (err) throw err;
      alert("Test questions deleted.");
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to delete test questions");
    } finally {
      setGenerating(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return u.username.toLowerCase().includes(s) || u.full_name.toLowerCase().includes(s);
    }
    return true;
  });

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <p style={{ color: "var(--text-muted)" }}>Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <main className="main max-w-6xl mx-auto pt-24 pb-12">
        <div className="feed-head">
          <div>
            <h1 className="feed-title">Admin Dashboard</h1>
            <p className="feed-sub">Manage users, audit logs, and reports.</p>
          </div>
          <div className="editor-tabs">
            {(["users", "audit", "reports", "test"] as const).map((t) => (
              <button
                key={t}
                className={`editor-tab ${tab === t ? "is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "test" ? "Test Data" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="card" style={{ marginBottom: "16px", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <p style={{ color: "var(--danger)", fontSize: "13px", margin: 0 }}>{error}</p>
          </div>
        )}

        {tab === "users" && (
          <>
            <div className="feed-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="search"
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="auth-input"
                style={{ flex: 1, minWidth: "200px" }}
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
                className="auth-input"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="verified">Verified</option>
                <option value="contributor">Contributor</option>
                <option value="user">User</option>
              </select>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Reputation</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="lb-user">
                          <div className="lb-avatar-fallback">
                            {u.username?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="lb-name">{u.username}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.full_name}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <RoleBadge role={u.role} size="sm" />
                      </td>
                      <td>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === "active" ? "bg-green-50 text-green-700" : u.status === "banned" ? "bg-red-50 text-red-700" : u.status === "suspended" ? "bg-orange-50 text-orange-700" : "bg-yellow-50 text-yellow-700"}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="lb-rep">{u.reputation}</td>
                      <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmtShortDate(u.created_at)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <select
                            className="auth-input"
                            style={{ height: "32px", padding: "0 8px", fontSize: "12px" }}
                            value={u.role}
                            onChange={(e) => assignRole(u.id, e.target.value as UserRole)}
                          >
                            <option value="user">User</option>
                            <option value="contributor">Contributor</option>
                            <option value="verified">Verified</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button className="btn-secondary" style={{ height: "32px", padding: "0 10px", fontSize: "12px" }} onClick={() => adjustReputation(u.id)}>Rep</button>
                          {u.status !== "banned" ? (
                            <button className="btn-primary" style={{ height: "32px", padding: "0 10px", fontSize: "12px", background: "var(--danger)" }} onClick={() => banUser(u.id)}>Ban</button>
                          ) : (
                            <button className="btn-secondary" style={{ height: "32px", padding: "0 10px", fontSize: "12px" }} onClick={() => unbanUser(u.id)}>Unban</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "audit" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.action}</td>
                    <td style={{ fontSize: "11px" }}>{a.target_type} {a.target_id?.slice(0, 8)}</td>
                    <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{a.reason || "—"}</td>
                    <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmtShortDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "reports" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: "11px" }}>{r.target_type} {r.target_id?.slice(0, 8)}</td>
                    <td>{r.reason}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "open" ? "bg-yellow-50 text-yellow-700" : r.status === "resolved" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmtShortDate(r.created_at)}</td>
                    <td>
                      {r.status === "open" && (
                        <button className="btn-primary" style={{ height: "32px", padding: "0 10px", fontSize: "12px" }} onClick={() => resolveReport(r.id)}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "test" && (
          <>
            <div className="card" style={{ marginBottom: "16px", padding: "16px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--text)" }}>Generate Test Questions</h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                Create random questions with complex LaTeX formulas to test MathJax rendering, layout, and database performance.
              </p>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "var(--text)" }}>
                  Count:
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={testCount}
                    onChange={(e) => setTestCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="auth-input"
                    style={{ width: "80px", marginLeft: "8px", height: "32px", fontSize: "13px" }}
                  />
                </label>
                <button
                  className="btn-secondary"
                  style={{ height: "32px", padding: "0 14px", fontSize: "12px" }}
                  onClick={() => setTestPreview(generatePreview(testCount))}
                >
                  Preview
                </button>
                <button
                  className="btn-primary"
                  style={{ height: "32px", padding: "0 14px", fontSize: "12px" }}
                  onClick={() => insertTestQuestions(testCount)}
                  disabled={generating}
                >
                  {generating ? "Inserting…" : "Insert into DB"}
                </button>
                <button
                  className="btn-primary"
                  style={{ height: "32px", padding: "0 14px", fontSize: "12px", background: "var(--danger)" }}
                  onClick={() => deleteTestQuestions()}
                  disabled={generating}
                >
                  Delete All Test Questions
                </button>
              </div>
              {testPreview.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                    Previewing {testPreview.length} question{testPreview.length > 1 ? "s" : ""}:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {testPreview.map((q, i) => (
                      <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "10px", background: "var(--bg-elevated)" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--text)" }}>{q.title}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
                          Tags: {q.tags.join(", ")}
                        </div>
                        <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text)", margin: 0, fontFamily: "var(--font-mono)" }}>
                          {q.body}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {loading && tab !== "test" && <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--text-muted)" }}>Loading…</div>}
      </main>
    </div>
  );
}
