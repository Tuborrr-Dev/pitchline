"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function MatchBackButton() {
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
      className="h-9 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-strong)] shadow-none hover:bg-[var(--terminal-hover)]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </Button>
  );
}
