"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Coffee, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark"><Coffee size={24} /></span><div><strong>IMAGE</strong><small>COFFEE ROASTERY</small></div></div>
        <span className="login-eyebrow">STAFF ACCESS</span>
        <h1>Accommodation desk</h1>
        <p className="login-copy">Sign in with your authorized staff account to manage rooms, reservations and payments.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="staff@example.com" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Enter your password" />
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}><LockKeyhole size={16} /> {loading ? "Signing in…" : "Sign in securely"}</button>
        </form>
        <p className="login-note">Staff accounts are created by an administrator. Public self-registration is disabled.</p>
      </section>
    </main>
  );
}
