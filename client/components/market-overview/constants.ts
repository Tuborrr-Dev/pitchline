export const tickerItems = [
  { label: "BTC/USD", value: "$64,210.42 (+1.2%)", tone: "up" },
  { label: "SOL/USD", value: "$145.12 (+4.8%)", tone: "up" },
  { label: "ETH/USD", value: "$3,421.10 (-0.4%)", tone: "down" },
  { label: "BTC/USD", value: "$64,210.42 (+1.2%)", tone: "up" },
  { label: "SOL/USD", value: "$145.12 (+4.8%)", tone: "up" },
] as const;

export const panelMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: "easeOut" },
} as const;
