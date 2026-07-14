"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { TerminalState } from "@/components/terminal-state";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 text-[var(--terminal-text)]">
      <TerminalState
        icon={AlertTriangle}
        title="Terminal state failed"
        description="The app could not render the latest market state. Retry once the feed or route recovers."
        tone="danger"
        className="w-full max-w-xl"
        action={
          <Button
            type="button"
            onClick={reset}
            className="h-8 cursor-pointer rounded-none border border-current bg-transparent px-3 font-mono text-[0.68rem] uppercase shadow-none hover:bg-[var(--terminal-hover)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        }
      />
    </main>
  );
}
