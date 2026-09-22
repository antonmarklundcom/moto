import Link from "next/link";
import { paths } from "@/lib/seo/routes";
import { primaryButton, secondaryButton } from "./styles";

/**
 * Estado vacío honesto (PRODUCT_SPEC.md §4, ADR-21): dice la verdad y ofrece
 * algo útil. Nunca resultados de relleno. El CTA principal va por
 * /ir/wa/general con lo que busca el visitante precargado.
 */
export function EmptyState({
  title = "Todavía no tenemos motos que coincidan.",
  searchText,
  children,
  showPublish = true,
  headingLevel = 2,
}: {
  title?: string;
  /** Lo que buscó (p. ej. "Honda CG 150 en Luque"), para precargar el mensaje de WhatsApp. */
  searchText?: string;
  /** Contexto extra: filtros aplicados, búsquedas cercanas con resultados reales. */
  children?: React.ReactNode;
  showPublish?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const message = searchText ? `Hola, busco una moto: ${searchText}` : undefined;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-4" aria-live="polite">
      <Heading className="text-lg font-semibold text-neutral-900">{title}</Heading>
      {children}
      <div className="flex flex-wrap gap-2">
        <a href={paths.whatsappGeneral(message)} rel="nofollow" className={primaryButton}>
          Escribinos qué moto buscás
        </a>
        {showPublish ? (
          <Link href={paths.publish} className={secondaryButton}>
            Publicá tu moto
          </Link>
        ) : null}
      </div>
    </section>
  );
}
