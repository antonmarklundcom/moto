"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createFromPublish, publishCatalog } from "@/components/publish/submit";
import type { PublishState } from "@/components/publish/state";
import { validatePublish } from "@/components/publish/validate";
import { env } from "@/lib/env";
import { hashWithSalt } from "@/lib/hash";
import { clientIp } from "@/lib/rate-limit";

// Envío final de /publicar: funciona sin JS (server action con mejora progresiva).
export async function publishAction(prev: PublishState, form: FormData): Promise<PublishState> {
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) raw[k] = v;
  const version = prev.version + 1;
  // Honeypot: como si hubiera salido bien, sin guardar nada.
  if ((raw.website ?? "").trim() !== "") redirect("/publicar/listo");

  const catalog = await publishCatalog();
  const result = validatePublish(raw, catalog);
  if (!result.ok) return { errors: result.errors, values: raw, version, message: "Revisá los campos marcados." };

  const h = await headers();
  const ip = clientIp(h);
  let ipHash: string | null = null;
  try {
    ipHash = ip ? hashWithSalt(ip, env.ipHashSalt()) : null;
  } catch {
    ipHash = null;
  }
  const photoIds = (raw.fotos ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .slice(0, 20);
  const created = await createFromPublish({ values: result.values, draftToken: raw.draftToken || null, photoIds, ip, ipHash });
  if (!created.ok) {
    return { errors: {}, values: raw, version, message: "Ya se publicaron 3 motos desde tu conexión en las últimas 24 horas. Probá mañana o escribinos por WhatsApp." };
  }
  redirect(`/publicar/listo${created.photos === 0 ? "?fotos=0" : ""}`);
}
