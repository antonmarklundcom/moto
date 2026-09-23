import type { Metadata } from "next";
import Link from "next/link";
import { container, linkClass, primaryButton } from "@/components/public/styles";
import { paths } from "@/lib/seo/routes";

// /gracias (A4 THANKS_PATH): nunca se indexa ni se enlaza. Dice lo que pasa
// de verdad: la consulta quedó guardada y alguien la atiende por teléfono o
// WhatsApp. Sin plazo prometido hasta que el propietario lo fije (docs/log/B5.md).
export const metadata: Metadata = {
  title: "Recibimos tu consulta",
  robots: { index: false, follow: false },
};

const COPY: Record<string, { what: string; whatsapp: string }> = {
  financiacion: { what: "tu consulta de financiación", whatsapp: "Hola, dejé una consulta de financiación en moto.com.py" },
  seguro: { what: "tu consulta de seguro", whatsapp: "Hola, dejé una consulta de seguro en moto.com.py" },
  plan_comercio: { what: "tu consulta sobre publicar el stock de tu comercio", whatsapp: "Hola, dejé una consulta por mi comercio en moto.com.py" },
  publicidad: { what: "tu consulta sobre publicidad", whatsapp: "Hola, dejé una consulta sobre publicidad en moto.com.py" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const c = COPY[tipo ?? ""] ?? { what: "tu consulta", whatsapp: "Hola, dejé una consulta en moto.com.py" };
  return (
    <div className={container}>
      <h1 className="mt-6 text-2xl font-bold">Recibimos {c.what}</h1>
      <p className="mt-2 max-w-prose">
        Quedó guardada. Te vamos a contactar al número que dejaste, por WhatsApp o con una llamada. Si nos escribís antes, te respondemos por ahí.
      </p>
      <p className="mt-4">
        <a href={paths.whatsappGeneral(c.whatsapp)} rel="nofollow" className={primaryButton}>
          Escribir por WhatsApp
        </a>
      </p>
      <p className="mt-6">
        <Link href={paths.motos} className={linkClass}>
          Seguir viendo motos
        </Link>
      </p>
    </div>
  );
}
