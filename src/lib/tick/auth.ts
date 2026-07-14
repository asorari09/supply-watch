import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/config/env";

const tokenDigest = (token: string): Buffer =>
  createHash("sha256").update(token).digest();

export function verifyTickAuth(request: Request): boolean {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer ([^\s]+)$/)?.[1];

    if (token === undefined) {
      return false;
    }

    // SHA-256 creates equal-length buffers even when the supplied token is short.
    return timingSafeEqual(tokenDigest(token), tokenDigest(env.TICK_SECRET));
  } catch {
    return false;
  }
}
