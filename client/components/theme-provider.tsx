"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// React 19 warns about <script> tags rendered inside components.
// next-themes intentionally injects an inline script to prevent theme flash.
// This is harmless — suppress the specific dev-only console error.
const SCRIPT_WARNING = "Encountered a script tag while rendering React component";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes(SCRIPT_WARNING)) return;
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
