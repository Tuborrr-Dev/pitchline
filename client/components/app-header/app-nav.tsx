import Link from "next/link";

export function AppNav({ isLanding }: { isLanding: boolean; pathname: string }) {
  if (!isLanding) return null;

  return (
    <nav className="flex flex-wrap items-center gap-4 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-muted)] sm:gap-5 sm:text-[0.78rem]">
      {[
        ["#how-it-works", "System"],
        ["#charts", "Charts"],
        ["#access", "Access"],
      ].map(([href, label]) => (
        <Link key={href} href={href} className="cursor-pointer text-[var(--terminal-text-muted)] transition hover:text-[var(--terminal-text-strong)]">
          {label}
        </Link>
      ))}
    </nav>
  );
}

