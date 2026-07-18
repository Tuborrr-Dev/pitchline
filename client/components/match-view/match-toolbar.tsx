"use client";

import { Eye, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MatchToolbar({
  detailsOpen,
  eventRailOpen,
  onShowEvents,
  onToggleDetails,
}: {
  detailsOpen: boolean;
  eventRailOpen: boolean;
  onShowEvents: () => void;
  onToggleDetails: () => void;
}) {
  return (
    <section className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] sm:px-5 sm:py-3 lg:justify-between [&::-webkit-scrollbar]:hidden">
      <div className="flex shrink-0 items-center gap-2">
        {!eventRailOpen ? (
          <Button
            type="button"
            onClick={onShowEvents}
            className="h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)] sm:px-3 sm:text-[0.68rem] xl:hidden"
          >
            <Eye className="h-4 w-4" />
            Events
          </Button>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono text-[0.62rem] font-semibold uppercase sm:gap-4 sm:text-[0.72rem]">
        <Button
          type="button"
          onClick={onToggleDetails}
          className="h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)] sm:px-3 sm:text-[0.7rem]"
        >
          <PanelRightOpen className="h-4 w-4" />
          {detailsOpen ? "Hide Commentary" : "Show Commentary"}
        </Button>
      </div>
    </section>
  );
}
