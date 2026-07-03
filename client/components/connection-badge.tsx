import type { ConnectionState } from "@/lib/types";

const stateClassMap: Record<ConnectionState, string> = {
  connecting: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  live: "border-emerald-400/30 bg-emerald-400/12 text-emerald-200",
  reconnecting: "border-amber-400/30 bg-amber-400/12 text-amber-100",
  stale: "border-orange-400/30 bg-orange-400/12 text-orange-100",
  offline: "border-rose-400/30 bg-rose-400/12 text-rose-100",
};

export function ConnectionBadge({
  state,
  label,
}: {
  state: ConnectionState;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] ${stateClassMap[state]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {label ?? state}
    </span>
  );
}
