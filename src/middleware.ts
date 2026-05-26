import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("supabase_access_token")?.value;
  const refreshToken = request.cookies.get("supabase_refresh_token")?.value;

  // If the access token is missing but the refresh token is present, refresh the session
  if (!accessToken && refreshToken) {
    try {
      const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token;

        if (newAccessToken && newRefreshToken) {
          // Construct response
          const requestHeaders = new Headers(request.headers);
          
          // Modify request cookies so that Server Components read the new token during this request
          request.cookies.set("supabase_access_token", newAccessToken);
          request.cookies.set("supabase_refresh_token", newRefreshToken);
          requestHeaders.set("cookie", request.cookies.toString());

          const response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          // Set response cookies to save the new tokens in the browser
          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: "/",
          };

          response.cookies.set("supabase_access_token", newAccessToken, {
            ...cookieOptions,
            maxAge: 60 * 15,
          });

          response.cookies.set("supabase_refresh_token", newRefreshToken, {
            ...cookieOptions,
            maxAge: 60 * 60 * 24 * 7,
          });

          // Client-accessible cookie for the browser client RLS compliance
          response.cookies.set("supabase_access_token_client", newAccessToken, {
            ...cookieOptions,
            httpOnly: false,
            maxAge: 60 * 15,
          });

          return response;
        }
      }
    } catch (error) {
      console.error("Middleware session refresh error:", error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/ (auth routes like callback, sign-in, etc. to avoid infinite loops)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|auth).*)",
  ],
};
