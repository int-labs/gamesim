/**
 * Console session: the stored staff token and who it belongs to.
 *
 * This replaces the hard-coded `DEV_ADMIN_TOKEN` that used to live in api.ts.
 * That token was compiled into the JS bundle, and the Dockerfile copies
 * `client/build` into `server/public` — so it shipped a full-admin credential
 * to every browser that loaded the console. Nothing here is a secret at rest
 * that the browser didn't already have to hold: the point is that the token is
 * now earned per person, expires, and can be revoked by deleting the account.
 */
import { api } from "@/api";

const TOKEN_KEY = "gamesim:console:token";

export interface StaffUser {
  _id: string;
  email: string;
  /** Optional display name; the console falls back to the email's local part. */
  name?: string | null;
  role: "admin" | "operator" | "client";
  /** Generated server-side — see server/src/services/avatars.ts. */
  avatar?: { url: string; style?: string; seed?: string } | null;
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  applyToken(token);
}

/** Keep axios's default header in step with storage. */
export function applyToken(token: string | null): void {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export async function login(email: string, password: string): Promise<StaffUser> {
  // Sent without the stale Authorization header a previous session may have
  // left on the axios instance — a 403'd token must not shadow a good login.
  const { data } = await api.post(
    "/users/login",
    { email, password },
    { headers: { Authorization: "" } }
  );
  setToken(data.token);
  return data.user as StaffUser;
}

/**
 * Who the stored token belongs to, or null when there isn't a usable session.
 *
 * `authenticate` on the server only checks the JWT signature, so a token for a
 * deleted account still passes it; `/users/me` does the database lookup, which
 * is what makes this a real check rather than a decode.
 */
export async function fetchMe(): Promise<StaffUser | null> {
  if (!getToken()) return null;
  try {
    const { data } = await api.get("/users/me");
    if (!data?.role || data.role === "team") return null;
    return data as StaffUser;
  } catch {
    return null;
  }
}

export function logout(): void {
  setToken(null);
}
