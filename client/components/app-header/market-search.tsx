"use client";

import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { FormEvent } from "react";

import { cn } from "@/lib/utils";

import { SEARCH_RESULTS } from "./constants";

export function MarketSearch({
  mobileIconVisibility,
  mobileSearchOpen,
  query,
  onClear,
  onOpenMobileSearch,
  onResultSelect,
  onSubmit,
  onUpdateQuery,
  showSearchResults,
}: {
  mobileIconVisibility: string;
  mobileSearchOpen: boolean;
  query: string;
  onClear: () => void;
  onOpenMobileSearch: () => void;
  onResultSelect: (fixtureId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateQuery: (query: string) => void;
  showSearchResults: boolean;
}) {
  return (
    <motion.form
      layout
      onSubmit={onSubmit}
      onClick={() => {
        if (!mobileSearchOpen) onOpenMobileSearch();
      }}
      className={cn(
        "relative flex h-10 min-w-0 items-center gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text-muted)] sm:h-11 sm:min-w-[18rem] sm:justify-start sm:px-3 lg:min-w-[22rem]",
        mobileSearchOpen ? "justify-start px-3" : "justify-center px-0",
      )}
      aria-label="Search markets"
    >
      <button
        type={mobileSearchOpen ? "submit" : "button"}
        onClick={() => {
          if (!mobileSearchOpen) onOpenMobileSearch();
        }}
        className={cn(
          "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-[var(--terminal-text-muted)] hover:text-[var(--terminal-text-strong)]",
          mobileIconVisibility,
        )}
        aria-label="Open search"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      <input
        value={query}
        onChange={(event) => onUpdateQuery(event.target.value)}
        placeholder="SEARCH MARKETS..."
        autoFocus={mobileSearchOpen}
        className={cn(
          "w-full bg-transparent font-mono text-[0.72rem] uppercase text-[var(--terminal-text-strong)] outline-none placeholder:text-[var(--terminal-text-muted)] sm:text-[0.78rem]",
          mobileSearchOpen ? "block" : "hidden sm:block",
        )}
      />
      <AnimatePresence initial={false}>
        {query ? (
          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ duration: 0.14 }}
            className={cn(
              "h-4 w-4 shrink-0 cursor-pointer text-[var(--terminal-text-muted)] hover:text-[var(--terminal-text-strong)]",
              mobileSearchOpen ? "flex items-center justify-center" : "hidden sm:flex sm:items-center sm:justify-center",
            )}
            aria-label="Clear search"
          >
            <X className="h-4 w-4 shrink-0" />
          </motion.button>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showSearchResults ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-[0_18px_40px_var(--terminal-shadow)] sm:hidden"
          >
            <p className="border-b border-[var(--terminal-border)] px-3 py-2 font-mono text-[0.58rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
              Search results
            </p>
            {SEARCH_RESULTS.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onResultSelect(result.id)}
                className="block w-full cursor-pointer border-b border-[var(--terminal-line)] px-3 py-2 text-left font-mono uppercase hover:bg-[var(--terminal-hover)]"
              >
                <span className="block text-[0.72rem] font-semibold text-[var(--terminal-text-strong)]">{result.label}</span>
                <span className="mt-1 block text-[0.58rem] text-[var(--terminal-text-muted)]">{result.meta}</span>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.form>
  );
}
