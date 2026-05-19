"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const submit = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.replace("/");
    } else {
      const json = await res.json().catch(() => ({}));
      setLoading(false);
      setPassword("");
      setError(json.error || "Wrong password");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <div
        className={`relative w-full max-w-sm transition-transform ${shake ? "animate-shake" : ""}`}
      >
        {/* Card */}
        <div className="bg-[rgba(14,14,22,0.96)] border border-white/[0.08] rounded-2xl px-8 py-10 shadow-2xl backdrop-blur-xl">
          {/* Logo / wordmark */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-indigo-400" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Granturismo</h1>
            <p className="text-xs text-zinc-500 mt-1">Enter your password to continue</p>
          </div>

          {/* Input */}
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
            />

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={!password || loading}
              className="w-full py-3 rounded-xl bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Verifying…
                </span>
              ) : (
                "Unlock"
              )}
            </button>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="text-center text-[11px] text-zinc-700 mt-5">
          Private dashboard — authorized access only
        </p>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.45s ease; }
      `}</style>
    </div>
  );
}
