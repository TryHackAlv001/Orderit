import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isProtectedRoute, MARKETPLACE_ROUTE } from "@/constants";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const PUBLIC_ROUTES = ["/", "/marketplace", "/login", "/register"];

const VENDOR_PROTECTED_PREFIXES = [
  "/vendor/dashboard",
  "/vendor/products",
  "/vendor/orders",
  "/vendor/inventory",
  "/vendor/onboarding",
];

const BUYER_PROTECTED_PREFIXES = [
  "/buyer/dashboard",
  "/buyer/orders",
];

function preventProtectedPageCaching<T extends NextResponse>(response: T) {
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/auth/signout") {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    }
  );

  // Calling getSession ensures the server client reads and refreshes cookies as needed
  const { data } = await supabase.auth.getSession();
  const session = data?.session ?? null;
  const { pathname } = req.nextUrl;

  // Allow listed public routes, product pages and vendor storefronts
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/product") ||
    /^\/vendor\/[^/]+\/store/.test(pathname)
  ) {
    return res;
  }

  const isProtected = isProtectedRoute(pathname);
  if (isProtected) {
    preventProtectedPageCaching(res);
  }
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (isProtected && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return preventProtectedPageCaching(NextResponse.redirect(loginUrl));
  }

  if (session) {
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    const userRole = userData?.role;

    if (
      VENDOR_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
      userRole !== "vendor"
    ) {
      return preventProtectedPageCaching(
        NextResponse.redirect(new URL(MARKETPLACE_ROUTE, req.url)),
      );
    }

    if (
      BUYER_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
      userRole !== "buyer"
    ) {
      return preventProtectedPageCaching(
        NextResponse.redirect(new URL("/vendor/dashboard", req.url)),
      );
    }
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/main", req.url));
  }

  return res;
}
