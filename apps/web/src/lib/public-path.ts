export function isAnonymousPublicPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/contact" ||
    pathname === "/legal" ||
    pathname === "/sample" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/join" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sw.js"
  ) {
    return true;
  }
  return pathname.startsWith("/signup/") || pathname.startsWith("/auth/") || pathname.startsWith("/api/");
}

export function hideAppChrome(pathname: string, signedIn = false): boolean {
  if (pathname === "/privacy" || pathname === "/terms" || pathname === "/contact" || pathname === "/legal" || pathname === "/sample") {
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
  // 印刷用の画面（日報の印刷・写真の印刷）はヘッダーやナビを出さない
  return pathname.endsWith("/print") || /\/photos\/pdf$/.test(pathname);
}
