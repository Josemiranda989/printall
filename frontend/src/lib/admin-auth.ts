import PocketBase, { type RecordModel } from "pocketbase";
import type { AstroCookies, AstroCookieSetOptions } from "astro";

const PB_URL =
  import.meta.env.POCKETBASE_URL ||
  import.meta.env.PUBLIC_POCKETBASE_URL ||
  "http://localhost:8090";

export const ADMIN_COOKIE = "pb_admin_token";

const COOKIE_OPTIONS: AstroCookieSetOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: import.meta.env.PROD,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export type AdminAuth = {
  token: string;
  record: RecordModel;
};

function newClient(): PocketBase {
  return new PocketBase(PB_URL);
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<AdminAuth | null> {
  const pb = newClient();
  try {
    const auth = await pb
      .collection("_superusers")
      .authWithPassword(email, password);
    return { token: pb.authStore.token, record: auth.record };
  } catch {
    return null;
  }
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminAuth | null> {
  if (!token) return null;
  const pb = newClient();
  pb.authStore.save(token, null);
  try {
    const auth = await pb.collection("_superusers").authRefresh();
    return { token: pb.authStore.token, record: auth.record };
  } catch {
    return null;
  }
}

export function getAdminClient(token: string): PocketBase {
  const pb = newClient();
  pb.authStore.save(token, null);
  return pb;
}

export function setAdminCookie(cookies: AstroCookies, token: string): void {
  cookies.set(ADMIN_COOKIE, token, COOKIE_OPTIONS);
}

export function clearAdminCookie(cookies: AstroCookies): void {
  cookies.delete(ADMIN_COOKIE, { path: "/" });
}

export function readAdminCookie(cookies: AstroCookies): string | undefined {
  return cookies.get(ADMIN_COOKIE)?.value;
}
