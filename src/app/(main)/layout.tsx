'use client';

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuthStore } from "@/store/authStore";
import { OnlinePresenceProvider } from "@/hooks/useOnlinePresence";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) return null;

  const showFooter = !user;
  const showBottomNav = !!user;

  return (
    <OnlinePresenceProvider userId={user?.id}>
      <div className="min-h-screen bg-bg text-text">
        <AnnouncementBar />
        <Navbar variant={pathname === "/" ? "home" : "neutral"} />
        <main className="mx-auto flex min-h-[calc(100vh-160px)] max-w-7xl flex-col px-4 py-6 sm:px-6 pb-16 md:pb-0">
          {children}
        </main>
        {showFooter && <Footer />}
        {showBottomNav && <BottomNav />}
      </div>
    </OnlinePresenceProvider>
  );
}
