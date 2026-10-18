"use client";

import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { MARKETPLACE_ROUTE } from "@/constants";

type SignOutRouter = {
  replace: (href: string) => void;
  refresh: () => void;
};

let signOutInProgress = false;

export function isSignOutInProgress() {
  return signOutInProgress;
}

export function clearSignedOutClientState(userId?: string) {
  const signedInUserId = userId ?? useAuthStore.getState().user?.id;
  try {
    useCartStore.getState().clearSignedInItems(signedInUserId);
  } catch (error) {
    console.error("Unable to clear signed-in cart state:", error);
  }
  try {
    useAuthStore.getState().clearAuth();
  } catch (error) {
    console.error("Unable to clear signed-in auth state:", error);
  }

  if (typeof window === "undefined") return;

  const clearScopedKeys = (storage: Storage) => {
    try {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (
          key === "auth-storage" ||
          (signedInUserId && key?.includes(signedInUserId))
        ) {
          storage.removeItem(key);
        }
      }
    } catch (error) {
      console.error("Unable to clear user-scoped browser storage:", error);
    }
  };

  try {
    clearScopedKeys(window.localStorage);
  } catch (error) {
    console.error("Unable to access local browser storage:", error);
  }
  try {
    clearScopedKeys(window.sessionStorage);
  } catch (error) {
    console.error("Unable to access session browser storage:", error);
  }
}

export async function signOutAndRedirect(router: SignOutRouter) {
  const userId = useAuthStore.getState().user?.id;
  signOutInProgress = true;
  window.dispatchEvent(new Event("app-sign-out-start"));

  let signOutFailed = false;
  try {
    const serverResponse = await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!serverResponse.ok) {
      signOutFailed = true;
      console.error("Server-side sign-out failed:", serverResponse.status);
    }
  } catch (error) {
    signOutFailed = true;
    console.error("Server-side sign-out request failed:", error);
  }

  try {
    const { error } = await createClient().auth.signOut();
    if (error) {
      signOutFailed = true;
      console.error("Client-side sign-out failed:", error.message);
    }
  } catch (error) {
    signOutFailed = true;
    console.error("Client-side sign-out request failed:", error);
  }

  clearSignedOutClientState(userId);

  if (signOutFailed) {
    try {
      const { data, error } = await createClient().auth.getSession();
      if (error) {
        console.error("Unable to verify sign-out status:", error.message);
      } else if (data.session) {
        toast.error("Could not sign out. Please try again.");
      }
    } catch (error) {
      console.error("Unable to verify sign-out status:", error);
    }
  }

  try {
    router.replace(MARKETPLACE_ROUTE);
    router.refresh();
  } finally {
    signOutInProgress = false;
  }
}
