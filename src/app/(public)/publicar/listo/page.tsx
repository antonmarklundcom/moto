import type { Metadata } from "next";
import Link from "next/link";
import { ClearDraft } from "@/components/publish/clear-draft";
import { container, linkClass, primaryButton } from "@/components/public/styles";
import { paths } from "@/lib/seo/routes";

// Confirmación de /publicar. `Disallow: /publicar/exito` en SEO §3.4; noindex igual.
export const metadata: Metadata = { title: "Recibimos tu publicación", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ fotos?: string }> }) {
  const { fotos } = await searchParams;
  return (
    <div className={container}>
      <ClearDraft />
      <h1 className="mt-6 text-2xl font-bold">Recibimos tu publicación</h1>
      <p className="mt-2 max-w-prose">
        La revisamos en menos de 24 h. Cuando esté publicada te escribimos por WhatsApp con el enlace privado para marcarla como vendida, pausarla o
        editarla. Guardalo: es tu única llave.
      </p>
      {fotos === "0" ? (
        <p className="mt-3 max-w-prose rounded border border-amber-700 bg-amber-50 p-3">
          Llegó sin fotos: así no la podemos publicar. Mandanos las fotos por WhatsApp y las agregamos.
        </p>
      ) : null}
      <p className="mt-4 flex flex-wrap gap-2">
        {fotos === "0" ? (
          <a href={paths.whatsappGeneral("Hola, acabo de publicar mi moto y te mando las fotos")} rel="nofollow" className={primaryButton}>
            Escribir por WhatsApp
          </a>
        ) : null}
        <Link href={paths.motos} className={linkClass}>
          Ver otras motos
        </Link>
      </p>
    </div>
  );
}
