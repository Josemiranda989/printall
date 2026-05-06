import { defineMiddleware } from "astro:middleware";
import {
  clearAdminCookie,
  getAdminClient,
  readAdminCookie,
  setAdminCookie,
  verifyAdminToken,
} from "./lib/admin-auth";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/logout"];

function unauthorized(context: Parameters<Parameters<typeof defineMiddleware>[0]>[0], pathname: string) {
  // API routes get JSON 401; HTML routes get a login redirect.
  if (pathname.startsWith("/admin/api/")) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return context.redirect(
    `/admin/login?redirect=${encodeURIComponent(pathname)}`,
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith("/admin")) return next();
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return next();

  const token = readAdminCookie(context.cookies);
  if (!token) return unauthorized(context, pathname);

  const auth = await verifyAdminToken(token);
  if (!auth) {
    clearAdminCookie(context.cookies);
    return unauthorized(context, pathname);
  }

  if (auth.token !== token) {
    setAdminCookie(context.cookies, auth.token);
  }

  context.locals.adminPB = getAdminClient(auth.token);
  context.locals.admin = auth.record;

  return next();
});
