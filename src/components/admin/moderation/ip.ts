import "server-only";

import { env } from "@/lib/env";
import { hashWithSalt } from "@/lib/hash";
import { clientIp } from "@/lib/rate-limit";

/** Hash de la IP para activity_log (mismo HMAC que A1); null sin sal. */
export function requestIpHash(headers: Pick<Headers, "get">): string | null {
  const ip = clientIp(headers);
  try {
    return ip ? hashWithSalt(ip, env.ipHashSalt()) : null;
  } catch {
    return null;
  }
}
