import type { ReactNode } from "react";

export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "demo" | "good" | "warn" }) => {
  const cls = {
    neutral: "bg-bg text-muted border-line",
    demo: "bg-[#eef0ff] text-[#3a43a8] border-[#d6daff]",
    good: "bg-accent-soft text-accent border-[#c4e6d6]",
    warn: "bg-warn-soft text-warn border-[#f1d9b8]",
  }[tone];
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>;
};

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-line bg-card p-4 sm:p-5 ${className}`}>{children}</section>
);

export const Button = ({ children, onClick, variant = "primary", disabled, type = "button", className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; type?: "button" | "submit"; className?: string;
}) => {
  const cls = {
    primary: "bg-accent text-white hover:bg-[#0c6942]",
    secondary: "bg-card border border-line hover:bg-bg",
    ghost: "text-muted hover:text-ink hover:bg-bg",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${cls} ${className}`}>
      {children}
    </button>
  );
};

export const Spinner = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
);
