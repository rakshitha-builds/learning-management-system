"use client";
import { forwardRef, useEffect, useId } from "react";
import { Loader2, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-150 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" && "h-8 px-3 text-[13px]", size === "md" && "h-10 px-4 text-sm", size === "lg" && "h-12 px-6 text-base",
        variant === "primary" && "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_2px_rgba(79,70,229,.4),inset_0_1px_0_rgba(255,255,255,.2)] hover:from-brand-600 hover:to-brand-700",
        variant === "secondary" && "border border-stone-200 bg-white text-ink-900 shadow-sm hover:bg-stone-50",
        variant === "ghost" && "text-ink-700 hover:bg-stone-200/60",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className)}
      {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  function Input({ label, error, className, id, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? rest.name ?? autoId;
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-ink-700">{label}</label>}
        <input ref={ref} id={inputId}
          className={cn("h-11 w-full rounded-xl border bg-white px-3.5 text-sm shadow-sm outline-none transition placeholder:text-ink-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
            error ? "border-red-300" : "border-stone-200", className)}
          aria-invalid={!!error} {...rest} />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  });

export function Textarea({ label, className, id, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={areaId} className="block text-sm font-medium text-ink-700">{label}</label>}
      <textarea id={areaId} className={cn("w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-ink-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100", className)} {...rest} />
    </div>
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm font-medium text-ink-700 shadow-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-60", className)} {...rest}>
      {children}
    </select>
  );
}

export function Avatar({ name, color, size = 32, ring, className }: { name: string; color: string; size?: number; ring?: string; className?: string }) {
  return (
    <span title={name} className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.38, boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : "0 0 0 2px #fff" }}>
      {initials(name)}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand-500", className)} aria-label="Loading" />;
}
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton", className)} />;

export function FullPageSpinner() {
  return <div className="flex h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex animate-fadeIn flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl text-brand-600">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", text, action }: { title?: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center" role="alert">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "brand" | "green" | "amber" }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
      tone === "slate" && "bg-ink-100 text-ink-700", tone === "brand" && "bg-brand-50 text-brand-700",
      tone === "green" && "bg-emerald-50 text-emerald-700", tone === "amber" && "bg-amber-50 text-amber-700")}>{children}</span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cn("max-h-[90vh] w-full animate-fadeIn overflow-y-auto rounded-t-2xl bg-white p-6 shadow-pop sm:rounded-2xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-stone-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 via-violet-500 to-pink-500 shadow-md">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h10M4 12h16M4 17h7" /><circle cx="18" cy="7" r="2" fill="white" /></svg>
      </span>
      Collab
    </span>
  );
}
