"use client";

import { useState } from "react";
import { focusRing, primaryButton, secondaryButton } from "@/components/public/styles";

/**
 * "Ver teléfono" / "Llamar" (PRODUCT_SPEC.md §2.1): el número nunca está en
 * el HTML inicial; se pide a /api/telefono/<ref> (A4), que registra
 * `phone_reveal`. Sin JS el botón no hace nada visible: la ficha avisa que
 * hace falta JavaScript para ver el número.
 */
export function PhoneReveal({ publicRef, primary, label }: { publicRef: string; primary: boolean; label: string }) {
  const [phone, setPhone] = useState<{ telefono: string; href: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/telefono/${publicRef.toLowerCase()}`, { method: "POST" });
      const data = (await res.json()) as { telefono?: string; href?: string; error?: string };
      if (res.ok && data.telefono && data.href) setPhone({ telefono: data.telefono, href: data.href });
      else setError(data.error ?? "No pudimos mostrar el teléfono.");
    } catch {
      setError("Se cortó la conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (phone) {
    return (
      <a href={phone.href} className={`${primary ? primaryButton : secondaryButton} w-full`}>
        Llamar al {phone.telefono}
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={reveal} disabled={busy} className={`${primary ? primaryButton : secondaryButton} w-full disabled:opacity-70`}>
        {busy ? "Buscando…" : label}
      </button>
      <noscript>
        <p className="text-sm text-neutral-700">Para ver el teléfono hace falta activar JavaScript.</p>
      </noscript>
      {error ? (
        <p role="alert" className={`text-sm text-red-800 ${focusRing}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
