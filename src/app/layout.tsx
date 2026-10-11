import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
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
  title: "Tradeloft - Shop Anything From Trusted Local Vendors",
  description: "Shop electronics, fashion, food, beauty, jewelry, watches, and more from verified local vendors",
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
            __html: `let saved = null; try { saved = localStorage.getItem("tradeloft-theme"); } catch {} const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : systemDark ? "dark" : "light";`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${playfairDisplay.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
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
