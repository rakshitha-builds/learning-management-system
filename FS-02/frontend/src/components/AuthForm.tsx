"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Input, Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

function Form({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace(target); }, [user, router, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({}); setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      router.replace(target);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (Array.isArray(err.details)) setFieldErrors(Object.fromEntries((err.details as any[]).map((d) => [d.path, d.message])));
      } else setError("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  const isLogin = mode === "login";
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm animate-fadeIn">
          <Link href="/"><Logo className="text-lg" /></Link>
          <h1 className="mt-10 text-3xl font-bold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-ink-500">{isLogin ? "Sign in to continue to your workspaces." : "Start collaborating in real time — it takes a minute."}</p>
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {!isLogin && <Input label="Full name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} placeholder="Ada Lovelace" required />}
            <Input label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} placeholder="you@company.com" required />
            <Input label="Password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} placeholder={isLogin ? "Your password" : "At least 8 characters"} required />
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>{isLogin ? "Sign in" : "Create account"}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-ink-500">
            {isLogin ? "New here? " : "Already have an account? "}
            <Link href={isLogin ? "/register" : "/login"} className="font-semibold text-brand-600 hover:underline">{isLogin ? "Create an account" : "Sign in"}</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-brand-600 via-violet-600 to-pink-500 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.25),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-center p-16 text-white">
          <p className="text-4xl font-bold leading-tight tracking-tight">One page.<br />Every cursor.<br />Zero conflicts.</p>
          <p className="mt-5 max-w-sm text-white/80">Edit together in real time, comment in threads, and roll back to any version whenever you need.</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  return <Suspense><Form mode={mode} /></Suspense>;
}
