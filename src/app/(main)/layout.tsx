'use client';

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuthStore } from "@/store/authStore";
import { OnlinePresenceProvider } from "@/hooks/useOnlinePresence";
import { MessagingSummaryProvider } from "@/hooks/useMessagingSummary";
import {
  getNoTopNavRoute,
  isFloatingMessageHiddenRoute,
  isFloatingBackButtonRoute,
  isMobileBottomNavHidden,
} from "@/constants";
import { FloatingBackButton } from "@/components/layout/FloatingBackButton";
import { FloatingMessageButton } from "@/components/layout/FloatingMessageButton";
import { createClient } from "@/lib/supabase/client";
import {
  clearSignedOutClientState,
  isSignOutInProgress,
} from "@/lib/sign-out";
import { isProtectedRoute, MARKETPLACE_ROUTE } from "@/constants";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isTransitioningFromProtectedRoute, setIsTransitioningFromProtectedRoute] = useState(false);
  const [isCheckingRestoredSession, setIsCheckingRestoredSession] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const handleSignOutStart = () => setIsTransitioningFromProtectedRoute(true);
    window.addEventListener("app-sign-out-start", handleSignOutStart);
    return () => window.removeEventListener("app-sign-out-start", handleSignOutStart);
  }, []);

  useEffect(() => {
    if (pathname === MARKETPLACE_ROUTE) {
      setIsTransitioningFromProtectedRoute(false);
      setIsCheckingRestoredSession(false);
    }
  }, [pathname]);

  useEffect(() => {
    const currentPath = pathname ?? "";
    if (!isProtectedRoute(currentPath)) return;

    const supabase = createClient();
    let cancelled = false;
    const redirectToMarketplace = () => {
      if (cancelled) return;
      clearSignedOutClientState();
      setIsTransitioningFromProtectedRoute(true);
      router.replace(MARKETPLACE_ROUTE);
      router.refresh();
    };

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !isSignOutInProgress()) {
        redirectToMarketplace();
      }
    });

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setIsCheckingRestoredSession(true);
      void supabase.auth.getSession().then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Unable to verify the restored session:", error.message);
        }
        if (!data.session) {
          redirectToMarketplace();
          return;
        }
        setIsCheckingRestoredSession(false);
      }).catch((error: unknown) => {
        if (cancelled) return;
        console.error("Unable to verify the restored session:", error);
        redirectToMarketplace();
      });
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      cancelled = true;
      authSubscription.subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [pathname, router]);

  const showFooter = !user;
  const currentPath = pathname ?? "";
  const hasFloatingBackButton = isFloatingBackButtonRoute(currentPath);
  const noTopNavRoute = getNoTopNavRoute(currentPath);
  const routeHidesAlways = !!noTopNavRoute && "hideAlways" in noTopNavRoute && noTopNavRoute.hideAlways;
  const routeHidesBelowMd = !!noTopNavRoute && "hideBelow" in noTopNavRoute && noTopNavRoute.hideBelow === "md";
  const hideTopNavigation = routeHidesAlways;
  const hideTopNavigationOnMobile = hideTopNavigation || routeHidesBelowMd || isMobileBottomNavHidden(currentPath);
  const topNavigationClass = routeHidesAlways
    ? "hidden"
    : noTopNavRoute || isMobileBottomNavHidden(currentPath)
      ? "hidden md:block"
      : undefined;
  const showBottomNav = !!user && !isMobileBottomNavHidden(pathname ?? "");
  const showFloatingMessageButton = !!user && !isFloatingMessageHiddenRoute(currentPath);
  const mainTopPadding = hasFloatingBackButton
    ? "pt-[calc(var(--floating-back-size)+var(--space-3)+var(--safe-top))] md:pt-0"
    : currentPath === "/buyer/profile"
      ? "pt-0 md:pt-[var(--safe-top)]"
      : hideTopNavigation
        ? "pt-[var(--safe-top)]"
        : hideTopNavigationOnMobile
          ? "pt-0 md:pt-6"
          : "pt-6";

  return (
    <div style={{
      visibility: isTransitioningFromProtectedRoute || isCheckingRestoredSession
        ? "hidden"
        : undefined,
    }}>
      {isHydrated && (
        <OnlinePresenceProvider userId={user?.id}>
          <MessagingSummaryProvider userId={user?.id}>
            <div className="min-h-svh bg-bg text-text">
              <div className={topNavigationClass}>
                <AnnouncementBar />
              </div>
              <div className={topNavigationClass}>
                <Navbar variant={pathname === "/" ? "home" : "neutral"} />
              </div>
              <main className={`page-container min-h-[calc(100svh-160px)] pb-6 ${showBottomNav ? "pb-[calc(var(--bottom-nav-height)+var(--safe-bottom))]" : ""} md:pb-0 ${mainTopPadding}`}>
                <div className="page-content w-full flex-1">{children}</div>
              </main>
              {showFooter && <Footer />}
              {showFloatingMessageButton && <FloatingMessageButton />}
              {showBottomNav && <BottomNav />}
            </div>
          </MessagingSummaryProvider>
        </OnlinePresenceProvider>
      )}
      <FloatingBackButton />
    </div>
  );
}
