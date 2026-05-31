"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        setError("Incorrect password.");
        setSubmitting(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.href = safeNext;
    } catch {
      setError("Login failed. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-black/70 p-8 shadow-xl shadow-black/50"
      >
        <h1 className="text-xl font-semibold text-slate-100">Eval Board</h1>
        <p className="mt-1 text-sm text-slate-400">Enter the access password to continue.</p>

        <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
        />

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-400 hover:text-white disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
