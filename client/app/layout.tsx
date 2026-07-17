import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Rajdhani } from "next/font/google";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletConnectProvider } from "@/components/wallet-connect-provider";
import { WalletRouteGuard } from "@/components/wallet-route-guard";
import { NotificationToasts } from "@/components/notifications/notification-toasts";
import { NotificationProvider } from "@/context/notification-provider";
import "./globals.css";

const sans = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PITCHLINE",
  description: "Real-time football probability terminal built for chart-native match analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="h-full bg-[var(--background)] text-[var(--foreground)]"
      >
        <ThemeProvider>
          <QueryProvider>
            <WalletConnectProvider>
              <NotificationProvider>
                <div className="flex h-screen flex-col overflow-hidden">
                  <Suspense fallback={<div className="h-[5.125rem] shrink-0 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-strong)]" />}>
                    <AppHeader />
                  </Suspense>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <WalletRouteGuard>{children}</WalletRouteGuard>
                  </div>
                </div>
                <NotificationToasts />
              </NotificationProvider>
            </WalletConnectProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

