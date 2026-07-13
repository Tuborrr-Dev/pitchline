const chartPoints = [
  "0,62",
  "12,62",
  "12,44",
  "31,44",
  "31,26",
  "55,26",
  "55,36",
  "75,36",
  "75,18",
  "100,18",
];

const inversePoints = [
  "0,54",
  "12,54",
  "12,70",
  "31,70",
  "31,78",
  "55,78",
  "55,63",
  "75,63",
  "75,82",
  "100,82",
];

export function MiniTerminalChart() {
  return (
    <div className="border border-[var(--terminal-border)] bg-[var(--terminal-panel)]/95 shadow-[0_24px_80px_var(--terminal-shadow)]">
      <div className="grid grid-cols-3 border-b border-[var(--terminal-border)] font-mono text-[0.68rem] font-semibold uppercase">
        <div className="border-r border-[var(--terminal-border)] px-3 py-2 text-[var(--terminal-green)]">
          ARG Equity
          <p className="mt-1 font-display text-[1.6rem] text-[var(--terminal-text-strong)]">61.8%</p>
        </div>
        <div className="border-r border-[var(--terminal-border)] px-3 py-2 text-[#ff4b6e]">
          FRA Equity
          <p className="mt-1 font-display text-[1.6rem] text-[var(--terminal-text-strong)]">20.2%</p>
        </div>
        <div className="px-3 py-2 text-[var(--terminal-blue)]">
          Volatility
          <p className="mt-1 font-display text-[1.6rem] text-[var(--terminal-text-strong)]">18.0</p>
        </div>
      </div>

      <div className="relative h-64 overflow-hidden bg-[linear-gradient(90deg,var(--terminal-grid-strong)_1px,transparent_1px),linear-gradient(var(--terminal-grid-strong)_1px,transparent_1px)] bg-[size:28px_28px] p-4">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="landing-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#00ff87" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#00ff87" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <polygon fill="url(#landing-chart-fill)" points={`0,100 ${chartPoints.join(" ")} 100,100`} />
          <polyline fill="none" stroke="#00ff87" strokeWidth="1.8" points={chartPoints.join(" ")} vectorEffect="non-scaling-stroke" />
          <polyline fill="none" stroke="#ff4b6e" strokeWidth="1.6" points={inversePoints.join(" ")} vectorEffect="non-scaling-stroke" />
          <polyline fill="none" stroke="#10a2cc" strokeWidth="1" points="0,86 20,82 40,88 55,70 72,76 100,64" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute left-[48%] top-[30%] border border-[var(--terminal-green)] bg-emerald-500/10 px-2 py-1 font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-green)]">
          Goal shock +17.2%
        </div>
        <div className="absolute bottom-3 left-4 right-4 flex justify-between font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
          <span>Kickoff</span>
          <span>HT</span>
          <span>90&apos;</span>
        </div>
      </div>
    </div>
  );
}
