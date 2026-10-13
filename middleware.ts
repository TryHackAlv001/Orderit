import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

const PROTECTED_ROUTE_PREFIXES = [
  ...VENDOR_PROTECTED_PREFIXES,
  ...BUYER_PROTECTED_PREFIXES,
  "/settings",
  "/checkout",
  "/messages",
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          res.cookies.set(name, value, options);
        },
        remove: (name: string, options: any) => {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
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

  const isProtected = PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (isProtected && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
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
      return NextResponse.redirect(new URL("/marketplace", req.url));
    }

    if (
      BUYER_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
      userRole !== "buyer"
    ) {
      return NextResponse.redirect(new URL("/vendor/dashboard", req.url));
    }
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/main", req.url));
  }

  return res;
}
