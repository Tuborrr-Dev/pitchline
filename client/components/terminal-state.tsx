import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function TerminalState({
  action,
  className,
  description,
  icon: Icon,
  title,
  tone = "muted",
}: {
  action?: ReactNode;
  className?: string;
  description: string;
  icon: LucideIcon;
  title: string;
  tone?: "muted" | "danger" | "gold" | "blue";
}) {
  const toneClass =
    tone === "danger"
      ? "border-[#ff4b6e] bg-red-500/10 text-[#ff8aa2]"
      : tone === "gold"
        ? "border-[#d6a726] bg-amber-500/10 text-[#d6a726]"
        : tone === "blue"
          ? "border-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)]"
          : "border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text-muted)]";

  return (
    <div
      className={cn(
        "flex min-h-[14rem] flex-col items-center justify-center gap-3 border border-dashed px-4 py-10 text-center font-mono uppercase",
        toneClass,
        className,
      )}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
      <div>
        <p className="text-[0.82rem] font-semibold text-[var(--terminal-text-strong)]">{title}</p>
        <p className="mt-2 max-w-md text-[0.68rem] leading-5 text-[var(--terminal-text-muted)]">{description}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

