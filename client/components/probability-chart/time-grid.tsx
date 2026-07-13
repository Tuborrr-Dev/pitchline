const timeLabels = ["23'", "36'", "HT", "58'", "90'", "108'", "118'", "PEN"];

export function TimeGrid() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[calc(100%-8.5rem)] min-h-[14rem] items-stretch justify-between px-[5.5%] sm:h-[calc(100%-11rem)] sm:min-h-[19rem]">
      {timeLabels.map((label) => (
        <div key={label} className="relative h-full border-l border-dashed border-[var(--terminal-border)]">
          <span className="absolute -bottom-5 -translate-x-1/2 font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
