import type { APIRoute } from "astro";
import { clearAdminCookie } from "../../lib/admin-auth";

export const POST: APIRoute = ({ cookies, redirect }) => {
  clearAdminCookie(cookies);
  return redirect("/admin/login");
};

export const GET: APIRoute = ({ redirect }) => redirect("/admin/login");
