import { defineMiddleware } from "astro:middleware";
import {
  clearAdminCookie,
  getAdminClient,
  readAdminCookie,
  setAdminCookie,
  verifyAdminToken,
} from "./lib/admin-auth";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/logout"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith("/admin")) return next();
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return next();

  const token = readAdminCookie(context.cookies);
  if (!token) {
    return context.redirect(
      `/admin/login?redirect=${encodeURIComponent(pathname)}`,
    );
  }

  const auth = await verifyAdminToken(token);
  if (!auth) {
    clearAdminCookie(context.cookies);
    return context.redirect(
      `/admin/login?redirect=${encodeURIComponent(pathname)}`,
    );
  }

  if (auth.token !== token) {
    setAdminCookie(context.cookies, auth.token);
  }

  context.locals.adminPB = getAdminClient(auth.token);
  context.locals.admin = auth.record;

  return next();
});
