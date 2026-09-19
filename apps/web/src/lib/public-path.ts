export function isAnonymousPublicPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/contact" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/join" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    return true;
  }
  return pathname.startsWith("/signup/") || pathname.startsWith("/auth/") || pathname.startsWith("/api/");
}

export function hideAppChrome(pathname: string, signedIn = false): boolean {
  if (pathname === "/privacy" || pathname === "/terms" || pathname === "/contact") {
    return true;
  }
  if (pathname === "/" && !signedIn) {
    return true;
  }
  if (pathname === "/login" || pathname === "/signup" || pathname === "/join" || pathname === "/onboarding") {
    return true;
  }
  if (pathname === "/forgot-password" || pathname === "/reset-password") {
    return true;
  }
  if (pathname.startsWith("/signup/") || pathname.startsWith("/auth/")) {
    return true;
  }
  return pathname.endsWith("/print");
}
