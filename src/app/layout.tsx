import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { WelcomeToastListener } from "@/components/notifications/WelcomeToastListener";
import "./globals.css";

const inter = Inter({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const playfairDisplay = Playfair_Display({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  applicationName: "Tradeloft",
  title: "Tradeloft | Shop Products from Independent Sellers",
  description: "Browse products from independent sellers on Tradeloft.",
  openGraph: {
    title: "Tradeloft | Shop Products from Independent Sellers",
    description: "Browse products from independent sellers on Tradeloft.",
    siteName: "Tradeloft",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `let saved = null; try { saved = localStorage.getItem("tradeloft-theme"); } catch (error) { console.error("Unable to read the saved theme:", error); } if (saved !== "light" && saved !== "dark" && saved !== "system") { try { const sessionSaved = sessionStorage.getItem("tradeloft-theme"); if (sessionSaved === "light" || sessionSaved === "dark" || sessionSaved === "system") saved = sessionSaved; } catch (error) { console.error("Unable to read the session theme:", error); } } const systemDark = saved === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = saved === "dark" || systemDark ? "dark" : "light";`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${playfairDisplay.variable} font-sans antialiased`}>
        {children}
        <WelcomeToastListener />
        <Toaster
          position="top-center"
          containerClassName="app-toaster"
          containerStyle={{
            top: "calc(var(--safe-top) + 12px)",
            zIndex: "var(--z-toast)",
          }}
          toastOptions={{
            ariaProps: { role: "status", "aria-live": "polite" },
            style: {
              background: "var(--surface-raised)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-soft)",
            },
            success: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } },
            error: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } },
          }}
        />
      </body>
    </html>
  );
}
