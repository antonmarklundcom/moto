"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { manageAction, manageEdit } from "@/components/publish/manage";
import { env } from "@/lib/env";
import { hashWithSalt } from "@/lib/hash";
import type { TransitionAction } from "@/lib/listings/state";
import { clientIp } from "@/lib/rate-limit";

async function ipHash(): Promise<string | null> {
  const ip = clientIp(await headers());
  try {
    return ip ? hashWithSalt(ip, env.ipHashSalt()) : null;
  } catch {
    return null;
  }
}

const back = (token: string, r: { ok: boolean; message?: string; error?: string }) =>
  redirect(`/mi-aviso/${encodeURIComponent(token)}?${r.ok ? `ok=${encodeURIComponent(r.message ?? "")}` : `error=${encodeURIComponent(r.error ?? "")}`}`);

export async function manageStateAction(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const r = await manageAction(token, String(form.get("accion")) as TransitionAction, await ipHash());
  back(token, r);
}

export async function manageEditAction(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const r = await manageEdit(
    token,
    {
      precio: String(form.get("precio") ?? ""),
      entrega: String(form.get("entrega") ?? ""),
      cuota: String(form.get("cuota") ?? ""),
      cuotas: String(form.get("cuotas") ?? ""),
      descripcion: String(form.get("descripcion") ?? ""),
      removeImageIds: form.getAll("quitar").map(Number),
      draftToken: String(form.get("draftToken") ?? "") || null,
      photoIds: String(form.get("fotos") ?? "")
        .split(",")
        .map(Number)
        .filter((x) => Number.isSafeInteger(x) && x > 0),
    },
    await ipHash(),
  );
  back(token, r);
}
