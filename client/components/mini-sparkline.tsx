interface MiniSparklineProps {
  values: number[];
  colorClassName?: string;
}

export function MiniSparkline({
  values,
  colorClassName = "stroke-cyan-300",
}: MiniSparklineProps) {
  if (values.length === 0) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * 100;
      const y = 100 - ((value - min) / spread) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-12 w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={colorClassName}
      />
    </svg>
  );
}
