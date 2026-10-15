import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

/**
 * Single sign-on across int-labs.com.
 *
 * A person signs in once — at any application on the domain — and that session
 * arrives here as an httpOnly cookie. The browser scopes cookies by domain and
 * has no idea that /journal and /et-prime are different servers behind the
 * router, so it sends this one to all of them without anything being arranged
 * on our side. This service only has to verify the signature; it does not need
 * to know which application issued it.
 *
 * The cookie is read first and `Authorization: Bearer` second, because the two
 * now carry different things. A person has the cookie. A passkey slot still
 * holds a bearer token in this application's own storage, the way it always
 * has — a passkey belongs to one simulation, and a cookie scoped to the parent
 * domain would follow it into the others.
 *
 * Kept as a local copy rather than imported: the platform package it mirrors is
 * a private workspace member of another repository and is not published. The
 * name of a cookie is a smaller thing to duplicate than a build dependency
 * between two repositories — but it does have to stay in step with
 * `packages/platform/src/utils/sessionCookie.ts` over there.
 */
const SESSION_COOKIE = "stratagem_session";

function readSessionToken(req: Request): string | undefined {
  const fromCookie = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[SESSION_COOKIE];

  if (typeof fromCookie === "string" && fromCookie.length > 0) {
    return fromCookie;
  }

  const header = req.headers.authorization;

  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const bearer = header.slice("Bearer ".length).trim();

    return bearer.length > 0 ? bearer : undefined;
  }

  return undefined;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = readSessionToken(req);

  if (!token) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    (req as any).user = decoded;
    next();
  } catch {
    res.status(403).json({ message: "Forbidden." });
  }
};