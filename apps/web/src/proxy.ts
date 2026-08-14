import { NextResponse } from "next/server";

import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/icon" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/gateway");

  if (isPublic) {
    return NextResponse.next();
  }

  const isMember = req.auth?.member === true;

  if (!isMember) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
