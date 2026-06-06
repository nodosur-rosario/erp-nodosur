import "server-only";

import type { User } from "@supabase/supabase-js";

export type UserSchema = User & {
  profile?: {
    name?: string;
    avatar_url?: string;
    role?: string;
  };
  role?: string;
};

import { getAccessToken, getRefreshToken } from "@/core/auth/auth-cookies";
import { createSupabaseServerClient } from "@/core/api/supabase";

type AuthViewer = {
  isAuthenticated: boolean;
  id: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: string | null;
};

const VISITOR_VIEWER: AuthViewer = {
  isAuthenticated: false,
  id: null,
  email: null,
  name: null,
  avatarUrl: null,
  role: null,
};

export type { AuthViewer };

function mapUserToViewer(user: UserSchema | null | undefined): AuthViewer {
  if (!user) {
    return VISITOR_VIEWER;
  }

  return {
    isAuthenticated: true,
    id: user.id,
    email: user.email,
    name: user.profile?.name?.trim() || null,
    avatarUrl: user.profile?.avatar_url?.trim() || null,
    role: (user as any).role || (user.profile as any)?.role || "pending",
  };
}

async function refreshAuthenticatedUser(refreshToken: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.refreshSession({ refreshToken });

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

export async function getCurrentUserDetails(): Promise<UserSchema | null> {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  if (accessToken) {
    const supabase = createSupabaseServerClient({ accessToken });
    const { data, error } = await supabase.auth.getCurrentUser();

    if (!error && data.user) {
      return data.user;
    }
  }

  if (refreshToken) {
    return refreshAuthenticatedUser(refreshToken);
  }

  return null;
}

export async function getCurrentViewer(): Promise<AuthViewer> {
  const user = await getCurrentUserDetails();
  return mapUserToViewer(user);
}
