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
import {
  isFloatingBackButtonRoute,
  isMobileBottomNavHidden,
  isNoTopNavRoute,
} from "@/constants";
import { FloatingBackButton } from "@/components/layout/FloatingBackButton";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const showFooter = !user;
  const currentPath = pathname ?? "";
  const hasFloatingBackButton = isFloatingBackButtonRoute(currentPath);
  const hideTopNavigation = isNoTopNavRoute(currentPath);
  const hideTopNavigationOnMobile =
    hideTopNavigation || isMobileBottomNavHidden(currentPath);
  const showBottomNav = !!user && !isMobileBottomNavHidden(pathname ?? "");
  const mainTopPadding = hasFloatingBackButton
    ? "pt-[calc(var(--floating-back-size)+var(--space-3)+var(--safe-top))]"
    : currentPath === "/buyer/profile"
      ? "pt-0 md:pt-[var(--safe-top)]"
      : hideTopNavigation
        ? "pt-[var(--safe-top)]"
        : hideTopNavigationOnMobile
          ? "pt-0 md:pt-6"
          : "pt-6";

  return (
    <>
      {isHydrated && (
        <OnlinePresenceProvider userId={user?.id}>
          <div className="min-h-svh bg-bg text-text">
            <div className={hideTopNavigation ? "hidden" : hideTopNavigationOnMobile ? "hidden md:block" : undefined}>
              <AnnouncementBar />
            </div>
            <div className={hideTopNavigation ? "hidden" : hideTopNavigationOnMobile ? "hidden md:block" : undefined}>
              <Navbar variant={pathname === "/" ? "home" : "neutral"} />
            </div>
            <main className={`page-container min-h-[calc(100svh-160px)] pb-6 ${showBottomNav ? "pb-[calc(var(--bottom-nav-height)+var(--safe-bottom))]" : ""} md:pb-0 ${mainTopPadding}`}>
              <div className="page-content w-full flex-1">{children}</div>
            </main>
            {showFooter && <Footer />}
            {showBottomNav && <BottomNav />}
          </div>
        </OnlinePresenceProvider>
      )}
      <FloatingBackButton />
    </>
  );
}
