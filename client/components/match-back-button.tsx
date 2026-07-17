"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MatchBackButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/markets");
  }

  return (
    <Button
      type="button"
      onClick={goBack}
      className={cn(
        "cursor-pointer rounded-none border border-[var(--terminal-border)] bg-[var(--terminal-panel)] font-mono font-semibold uppercase text-[var(--terminal-text-strong)] shadow-none hover:bg-[var(--terminal-hover)]",
        compact ? "h-8 px-2 text-[0.62rem]" : "h-9 px-3 text-[0.68rem]",
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </Button>
  );
}
