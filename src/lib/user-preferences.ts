import { createClient } from "@/lib/supabase/client";

type SupabaseError = {
  code?: string;
  message?: string;
};

let userPreferencesTableUnavailable = false;
const messagePreferenceRequests = new Map<string, Promise<boolean>>();

export function isMissingUserPreferencesTable(error: SupabaseError | null | undefined) {
  const missing = error?.code === "42P01"
    || error?.code === "PGRST205"
    || error?.message?.includes("public.user_preferences") === true
    || (
      error?.message?.includes("user_preferences") === true
      && error.message.includes("schema cache")
    );
  if (missing) userPreferencesTableUnavailable = true;
  return missing;
}

export function isUserPreferencesTableUnavailable() {
  return userPreferencesTableUnavailable;
}

export function retryUserPreferencesTable() {
  userPreferencesTableUnavailable = false;
}

export function getMessageNotificationsEnabled(userId: string): Promise<boolean> {
  if (userPreferencesTableUnavailable) return Promise.resolve(true);

  const existingRequest = messagePreferenceRequests.get(userId);
  if (existingRequest) return existingRequest;

  const request = Promise.resolve(
    createClient()
      .from("user_preferences")
      .select("notify_messages")
      .eq("user_id", userId)
      .maybeSingle()
  )
    .then(({ data, error }) => {
      if (error) {
        if (!isMissingUserPreferencesTable(error)) {
          console.error("Unable to load message notification preference:", error.message);
        }
        return true;
      }
      return data?.notify_messages ?? true;
    })
    .finally(() => {
      messagePreferenceRequests.delete(userId);
    });

  messagePreferenceRequests.set(userId, request);
  return request;
}
