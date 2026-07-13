"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./constants";

export function AppNav({ isLanding, pathname }: { isLanding: boolean; pathname: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-4 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-muted)] sm:gap-5 sm:text-[0.78rem]">
      {isLanding ? (
        <>
          {[
            ["#how-it-works", "System"],
            ["#charts", "Charts"],
            ["#access", "Access"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="cursor-pointer text-[var(--terminal-text-muted)] transition hover:text-[var(--terminal-text-strong)]">
              {label}
            </Link>
          ))}
        </>
      ) : (
        NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative cursor-pointer transition",
                active
                  ? "pb-1 text-[var(--terminal-text-strong)]"
                  : "text-[var(--terminal-text-muted)] hover:text-[var(--terminal-text-strong)]",
              )}
            >
              {item.label}
              {active ? (
                <motion.span
                  layoutId="app-nav-active"
                  className="absolute inset-x-0 -bottom-0.5 h-px bg-[var(--terminal-text-strong)]"
                  transition={{ duration: 0.18, ease: "easeOut" }}
                />
              ) : null}
            </Link>
          );
        })
      )}
    </nav>
  );
}
