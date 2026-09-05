export { auth as middleware } from "./src/auth";

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
