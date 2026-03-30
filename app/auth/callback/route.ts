import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sanitizeNextPath } from "@/app/lib/authReturn";
import { getSupabaseEnv } from "@/app/lib/supabase/env";
import { isNewOAuthUser } from "@/app/lib/auth/isNewOAuthUser";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", origin),
    );
  }

  const { hasSupabaseEnv, supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  if (!hasSupabaseEnv) {
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // Server Component / edge limitations
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextFromQuery = sanitizeNextPath(url.searchParams.get("next"));
  const fallback = nextFromQuery ?? "/dashboard";

  const destination =
    user && isNewOAuthUser(user) ? "/onboarding" : fallback;

  return NextResponse.redirect(new URL(destination, origin));
}
