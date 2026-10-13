'use client';

import { useEffect, useState } from "react";
import { MARKETPLACE_ANNOUNCEMENTS } from "@/constants";

export function AnnouncementBar() {
  const [activeMessage, setActiveMessage] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const interval = window.setInterval(() => {
      if (!reducedMotion.matches) {
        setActiveMessage((current) => (current + 1) % MARKETPLACE_ANNOUNCEMENTS.length);
      }
    }, window.matchMedia("(min-width: 768px)").matches ? 5000 : 4000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="fixed left-0 right-0 top-[calc(var(--mobile-header-height)+var(--safe-top))] z-sticky h-9 overflow-hidden bg-accent text-accent-on md:static md:z-auto md:h-auto md:overflow-visible">
      <div className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap px-4 text-center text-xs font-medium md:mx-auto md:grid md:h-auto md:max-w-7xl md:grid-cols-3 md:items-center md:overflow-visible md:px-6 md:py-2 md:whitespace-normal md:text-sm">
        {MARKETPLACE_ANNOUNCEMENTS.map((message, index) => (
          <p
            key={message.id}
            className={`${index === 0 ? "md:text-left motion-reduce:block" : "md:text-center motion-reduce:hidden md:motion-reduce:block"} ${index === activeMessage ? "block motion-safe:animate-[announcement-fade_500ms_ease-in-out] md:animate-none" : "hidden md:block"}`}
          >
            {message.text}
          </p>
        ))}
        <span className="hidden md:block" aria-hidden="true" />
      </div>
      <span className="sr-only" aria-live="polite">
        {MARKETPLACE_ANNOUNCEMENTS[activeMessage]?.text}
      </span>
      <style jsx>{`
        @keyframes announcement-fade {
          from { opacity: 0; transform: translateY(0.2rem); }
          to { opacity: 1; transform: translateY(0); }
        }

      `}</style>
    </div>
  );
}
