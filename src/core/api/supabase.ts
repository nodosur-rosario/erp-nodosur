import { createClient } from "@supabase/supabase-js";

export interface SupabaseEmulatedClient {
  database: {
    from: (table: string) => any;
    rpc: (fn: string, args?: any, options?: any) => any;
  };
  auth: {
    signUp: (params: { email: string; password?: string; name?: string }) => Promise<{
      data: {
        user: any;
        requireEmailVerification: boolean;
        accessToken?: string;
        refreshToken?: string;
      } | null;
      error: any;
    }>;
    signInWithPassword: (params: { email: string; password?: string }) => Promise<{
      data: {
        accessToken?: string;
        refreshToken?: string;
      } | null;
      error: any;
    }>;
    signOut: () => Promise<{ error: any }>;
    signInWithOAuth: (params: {
      provider: string;
      redirectTo?: string;
      skipBrowserRedirect?: boolean;
    }) => Promise<{
      data: {
        url?: string;
        provider?: string;
        codeVerifier?: string;
      };
      error: any;
    }>;
    exchangeOAuthCode: (code: string, codeVerifier?: string) => Promise<{
      data: {
        accessToken: string | null;
        refreshToken: string | null;
      } | null;
      error: any;
    }>;
    verifyEmail: (params: { email: string; otp: string }) => Promise<{
      data: {
        accessToken: string | null;
        refreshToken: string | null;
      } | null;
      error: any;
    }>;
    resendVerificationEmail: (params: { email: string }) => Promise<{
      data: {
        success: boolean;
        message: string;
      } | null;
      error: any;
    }>;
    sendResetPasswordEmail: (params: { email: string }) => Promise<{
      data: {
        success: boolean;
        message: string;
      } | null;
      error: any;
    }>;
    exchangeResetPasswordToken: (params: { email: string; code: string }) => Promise<{
      data: {
        token: string | null;
      } | null;
      error: any;
    }>;
    resetPassword: (params: { newPassword: string; otp: string }) => Promise<{
      data: any;
      error: any;
    }>;
    refreshSession: (params: { refreshToken: string }) => Promise<{
      data: {
        user: any;
        accessToken?: string;
        refreshToken?: string;
      } | null;
      error: any;
    }>;
    getCurrentUser: () => Promise<{
      data: {
        user: any;
      };
      error: any;
    }>;
    setProfile: (profile: any) => Promise<{ data: any; error: any }>;
    getProfile: (id: string) => Promise<{ data: any; error: any }>;
  };
  raw?: any;
}

let serverClient: SupabaseEmulatedClient | null = null;
let serverClientConfig: { supabaseUrl: string; supabaseKey: string } | null = null;

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase / InsForge configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { supabaseUrl, supabaseKey };
}

// Envuelve el cliente de Supabase para emular la interfaz del SDK de InsForge/Supabase
function wrapSupabaseClient(supabase: any): SupabaseEmulatedClient {
  return {
    database: {
      from: (table: string) => supabase.from(table),
      rpc: (fn: string, args?: any, options?: any) => supabase.rpc(fn, args, options),
    },
    raw: supabase,
    auth: {
      signUp: async (params) => {
        const { data, error } = await supabase.auth.signUp({
          email: params.email,
          password: params.password,
          options: {
            data: {
              name: params.name,
            },
          },
        });
        
        return {
          data: data ? {
            user: data.user,
            requireEmailVerification: !data.session,
            accessToken: data.session?.access_token,
            refreshToken: data.session?.refresh_token,
          } : null,
          error,
        };
      },
      signInWithPassword: async (params) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: params.email,
          password: params.password || "",
        });
        
        return {
          data: data?.session ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          } : null,
          error,
        };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        return { error };
      },
      signInWithOAuth: async (params) => {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: params.provider as any,
          options: {
            redirectTo: params.redirectTo,
            skipBrowserRedirect: params.skipBrowserRedirect,
          },
        });
        
        return {
          data: {
            url: data?.url || undefined,
            provider: params.provider,
            codeVerifier: undefined,
          },
          error,
        };
      },
      exchangeOAuthCode: async (code, codeVerifier) => {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        return {
          data: data?.session ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          } : null,
          error,
        };
      },
      verifyEmail: async (params) => {
        const { data, error } = await supabase.auth.verifyOtp({
          email: params.email,
          token: params.otp,
          type: "signup",
        });
        
        return {
          data: data?.session ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          } : null,
          error,
        };
      },
      resendVerificationEmail: async (params) => {
        const { data, error } = await supabase.auth.resend({
          type: "signup",
          email: params.email,
        });
        
        return {
          data: {
            success: !error,
            message: error ? error.message : "Verification email resent successfully.",
          },
          error,
        };
      },
      sendResetPasswordEmail: async (params) => {
        const { data, error } = await supabase.auth.resetPasswordForEmail(params.email);
        
        return {
          data: {
            success: !error,
            message: error ? error.message : "Password reset email sent successfully.",
          },
          error,
        };
      },
      exchangeResetPasswordToken: async (params) => {
        const { data, error } = await supabase.auth.verifyOtp({
          email: params.email,
          token: params.code,
          type: "recovery",
        });
        
        return {
          data: {
            token: data?.session?.access_token || null,
          },
          error,
        };
      },
      resetPassword: async (params) => {
        if (params.otp) {
          await supabase.auth.setSession({
            access_token: params.otp,
            refresh_token: "",
          });
        }
        
        const { data, error } = await supabase.auth.updateUser({
          password: params.newPassword,
        });
        
        return { data, error };
      },
      refreshSession: async (params) => {
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: params.refreshToken,
        });
        
        if (error || !data?.user) {
          return { data: null, error };
        }

        const { data: dbUser } = await supabase
          .from("users")
          .select("role, profile, metadata")
          .eq("id", data.user.id)
          .maybeSingle();

        const enrichedUser = {
          ...data.user,
          role: dbUser?.role || "pending",
          profile: dbUser?.profile || {},
          metadata: dbUser?.metadata || {},
        };

        return {
          data: {
            user: enrichedUser,
            accessToken: data.session?.access_token,
            refreshToken: data.session?.refresh_token,
          },
          error,
        };
      },
      getCurrentUser: async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          return { data: { user: null }, error };
        }

        const { data: dbUser } = await supabase
          .from("users")
          .select("role, profile, metadata")
          .eq("id", user.id)
          .maybeSingle();

        const enrichedUser = {
          ...user,
          role: dbUser?.role || "pending",
          profile: dbUser?.profile || {},
          metadata: dbUser?.metadata || {},
        };

        return { data: { user: enrichedUser }, error: null };
      },
      setProfile: async (profile: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: new Error("User not found") };
        const { data, error } = await supabase
          .from("users")
          .upsert([{ id: user.id, ...profile }])
          .select()
          .single();
        return { data, error };
      },
      getProfile: async (id: string) => {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        return { data, error };
      },
    },
  };
}

export function createSupabaseServerClient(options?: { accessToken?: string }): SupabaseEmulatedClient {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  const globalHeaders = options?.accessToken
    ? { Authorization: `Bearer ${options.accessToken}` }
    : undefined;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: globalHeaders,
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);

        if (typeof window === "undefined") {
          try {
            const { cookies } = require("next/headers");
            const cookieStore = await cookies();
            const token = cookieStore.get("supabase_access_token")?.value;
            
            const authHeader = headers.get("Authorization");
            const isAnonToken = !authHeader || authHeader === `Bearer ${supabaseKey}`;

            if (token && isAnonToken) {
              headers.set("Authorization", `Bearer ${token}`);
            }
          } catch (e) {
            // Ignore errors if executed outside Next.js request context (e.g. tests)
          }
        }

        return fetch(input, {
          ...init,
          headers,
        });
      },
    },
  });

  return wrapSupabaseClient(supabase);
}

export function getSupabaseServerClient(): SupabaseEmulatedClient {
  const config = getSupabaseConfig();

  if (
    !serverClient ||
    !serverClientConfig ||
    serverClientConfig.supabaseUrl !== config.supabaseUrl ||
    serverClientConfig.supabaseKey !== config.supabaseKey
  ) {
    serverClient = createSupabaseServerClient();
    serverClientConfig = config;
  }

  return serverClient;
}

let browserClient: SupabaseEmulatedClient | null = null;

export function getSupabaseClient(): SupabaseEmulatedClient {
  if (typeof window === "undefined") {
    return getSupabaseServerClient();
  }
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: async (input, init) => {
          const headers = new Headers(init?.headers);

          const tokenMatch = document.cookie.match(/(^|;)\s*supabase_access_token_client\s*=\s*([^;]+)/);
          const token = tokenMatch ? decodeURIComponent(tokenMatch[2]) : null;

          const authHeader = headers.get("Authorization");
          const isAnonToken = !authHeader || authHeader === `Bearer ${supabaseKey}`;

          if (token && isAnonToken) {
            headers.set("Authorization", `Bearer ${token}`);
          }

          return fetch(input, {
            ...init,
            headers,
          });
        },
      },
    });
    browserClient = wrapSupabaseClient(supabase);
  }
  return browserClient;
}
