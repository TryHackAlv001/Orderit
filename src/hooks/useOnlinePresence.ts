'use client';

import { createContext, createElement, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

const PRESENCE_CHANNEL = 'online-users';
const OnlinePresenceContext = createContext<ReadonlySet<string>>(new Set());

export function OnlinePresenceProvider({
  userId,
  children,
}: {
  userId?: string;
  children: ReactNode;
}) {
  const [onlineUserIds, setOnlineUserIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!userId) {
      setOnlineUserIds(new Set());
      return;
    }

    let disposed = false;
    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        setOnlineUserIds(new Set(Object.keys(presenceState)));
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;

        const { data, error } = await supabase.auth.getUser();
        if (disposed) return;
        if (error) {
          console.error('Unable to verify user before publishing presence:', error);
          return;
        }
        if (data.user?.id !== userId) return;

        const { error: trackError } = await channel.track({ user_id: userId });
        if (trackError) {
          console.error('Unable to publish user presence:', trackError);
        }
      });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return createElement(OnlinePresenceContext.Provider, { value: onlineUserIds }, children);
}

export function useOnlinePresence(): ReadonlySet<string> {
  return useContext(OnlinePresenceContext);
}
