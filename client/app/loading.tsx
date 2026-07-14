import { LoaderCircle } from "lucide-react";

import { TerminalState } from "@/components/terminal-state";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 text-[var(--terminal-text)]">
      <TerminalState
        icon={LoaderCircle}
        title="Loading market terminal"
        description="Fetching the latest fixture and market state."
        tone="blue"
        className="w-full max-w-xl [&_svg]:animate-spin"
      />
    </main>
  );
}
