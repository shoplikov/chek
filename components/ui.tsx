import type { ReactNode } from "react";

export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "demo" | "good" | "warn" }) => {
  const cls = {
    neutral: "bg-card/90 text-muted border-line",
    demo: "bg-[#eceefe] text-[#3a43a8] border-[#d6daff]",
    good: "bg-accent-soft text-accent border-[#c3e2cf]",
    warn: "bg-warn-soft text-warn border-[#f0cfc3]",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-px text-[11px] font-medium ${cls}`}>{children}</span>;
};

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-line bg-card p-4 sm:p-5 ${className}`}>{children}</section>
);

export const Button = ({ children, onClick, variant = "primary", disabled, type = "button", className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; type?: "button" | "submit"; className?: string;
}) => {
  const cls = {
    primary: "bg-accent text-white hover:bg-[#0d5734]",
    secondary: "bg-card border border-line hover:border-ink/30",
    ghost: "text-ink hover:bg-bg",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed ${cls} ${className}`}>
      {children}
    </button>
  );
};

export const Spinner = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden />
);
