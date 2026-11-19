import { SignJWT, jwtVerify } from "jose";
import type { Rol } from "../db/schema.js";

const ISSUER = "nexusfisi-api";
const AUDIENCE = "nexusfisi-web";

export interface Claims {
  sub: string;
  rol: Rol;
  fac: number | null;
  tv: number;
}

export async function firmarToken(
  claims: Claims,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new SignJWT({ rol: claims.rol, fac: claims.fac, tv: claims.tv })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

export async function verificarToken(token: string, secret: string): Promise<Claims | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload["tv"] !== "number") return null;
    return {
      sub: payload.sub,
      rol: payload["rol"] as Rol,
      fac: (payload["fac"] as number | null) ?? null,
      tv: payload["tv"] as number,
    };
  } catch {
    return null;
  }
}
