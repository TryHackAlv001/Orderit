'use client';

import { useEffect, useState } from "react";
import { MARKETPLACE_ANNOUNCEMENTS } from "@/constants";

export function AnnouncementBar() {
  const [activeMessage, setActiveMessage] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveMessage((current) => (current + 1) % MARKETPLACE_ANNOUNCEMENTS.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="bg-accent text-accent-on">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center px-4 py-2 text-center text-xs font-medium sm:px-6 sm:text-sm md:grid-cols-3">
        {MARKETPLACE_ANNOUNCEMENTS.map((message, index) => (
          <p
            key={message.id}
            className={`${index === 0 ? "md:text-left" : "md:text-center"} ${index === activeMessage ? "block" : "hidden md:block"}`}
          >
            {message.text}
          </p>
        ))}
        <span className="hidden md:block" aria-hidden="true" />
      </div>
      <span className="sr-only" aria-live="polite">
        {MARKETPLACE_ANNOUNCEMENTS[activeMessage]?.text}
      </span>
    </div>
  );
}
