import Link from "next/link";
import { SearchX } from "lucide-react";

import { TerminalState } from "@/components/terminal-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 text-[var(--terminal-text)]">
      <TerminalState
        icon={SearchX}
        title="Market not found"
        description="The requested fixture or market route is not available in the active index."
        className="w-full max-w-xl"
        action={
          <Button asChild className="h-8 cursor-pointer rounded-none border border-current bg-transparent px-3 font-mono text-[0.68rem] uppercase shadow-none hover:bg-[var(--terminal-hover)]">
            <Link href="/markets">Back to markets</Link>
          </Button>
        }
      />
    </main>
  );
}
