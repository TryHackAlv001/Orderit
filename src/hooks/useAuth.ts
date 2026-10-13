'use client';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { AuthProfile, User, VendorProfile } from "@/types";

export function useAuth() {
  const { user, profile, setUser, setProfile, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await createClient().auth.getUser();

      if (error) {
        clearAuth();
        setIsLoading(false);
        return;
      }

      const sessionUser = data?.user;
      if (!sessionUser) {
        clearAuth();
        setIsLoading(false);
        return;
      }

      const { data: userData, error: userError } = await createClient()
        .from("users")
        .select("*")
        .eq("id", sessionUser.id)
        .single();

      if (userError || !userData) {
        clearAuth();
        setIsLoading(false);
        return;
      }

      setUser(userData);

      if (userData.role === "vendor") {
        const { data: vendorProfile, error: vendorError } = await createClient()
          .from("vendor_profiles")
          .select("*")
          .eq("user_id", sessionUser.id)
          .single();

        if (!vendorError && vendorProfile) {
          setProfile(vendorProfile as AuthProfile);
        } else {
          setProfile(userData as AuthProfile);
        }
      } else {
        setProfile(userData as AuthProfile);
      }

      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSession();

    const { data: authListener } = createClient().auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          loadSession();
        } else if (event === "SIGNED_OUT") {
          clearAuth();
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [clearAuth]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { data, error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      throw error;
    }

    await loadSession();
    return data;
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    phone: string,
    role: "buyer" | "vendor",
    vendorData?: {
      shopName: string;
      shopDescription?: string;
      location?: string;
    }
  ) => {
    setIsLoading(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      throw error;
    }

    const userId = data.user?.id;
    if (!userId) {
      setIsLoading(false);
      return data;
    }

    const { error: createUserError } = await createClient().from("users").insert({
      id: userId,
      email,
      full_name: name,
      phone,
      role,
    });

    if (createUserError) {
      setIsLoading(false);
      throw createUserError;
    }

    if (role === "vendor" && vendorData?.shopName) {
      const { error: profileError } = await createClient().from("vendor_profiles").insert({
        user_id: userId,
        shop_name: vendorData.shopName,
        shop_description: vendorData.shopDescription,
        location: vendorData.location,
      });

      if (profileError) {
        setIsLoading(false);
        throw profileError;
      }
    }

    await loadSession();
    setIsLoading(false);
    return data;
  };

  const signOut = async () => {
    setIsLoading(true);
    await createClient().auth.signOut();
    clearAuth();
    setIsLoading(false);
  };

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    const { data, error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: process.env.NEXTAUTH_URL ?? undefined,
    });
    setIsLoading(false);

    if (error) {
      throw error;
    }

    return data;
  };

  return {
    user,
    profile,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
