export const marketDepthContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.045,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.12 },
  },
} as const;

export const marketDepthItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
} as const;

export const marketDepthHorizontalItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
} as const;
