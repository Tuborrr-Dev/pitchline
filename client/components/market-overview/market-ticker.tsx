"use client";

import type { RefObject } from "react";

import { tickerItems } from "./constants";

export function MarketTicker({ tickerRef }: { tickerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <>
      <section className="fixed inset-x-0 bottom-8 z-40 hidden flex-col gap-3 border-y border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-3 md:flex md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.68rem] font-semibold uppercase">
          <span className="text-[var(--terminal-text-muted)]">Streaming 24 data feeds</span>
          <span className="text-[var(--terminal-green)]">Secure p2p orderbook active</span>
        </div>
        <p className="font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
          Last update: 14:32:44 UTC
        </p>
      </section>

      <section className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--terminal-border)] bg-[var(--terminal-bg-strong)] px-3 py-2">
        <div
          ref={tickerRef}
          className="overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max gap-x-5 gap-y-2 font-mono text-[0.68rem] font-semibold uppercase">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <span
                key={`${item.label}-${index}`}
                aria-hidden={index >= tickerItems.length}
                className="text-[var(--terminal-text-muted)]"
              >
                {item.label}{" "}
                <span className={item.tone === "up" ? "text-[var(--terminal-green)]" : "text-[#ea8a9f]"}>
                  {item.value}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
