import { serializeJsonLd, type JsonLdDocument } from "@/lib/seo/jsonld";

/**
 * `<script type="application/ld+json">`. `serializeJsonLd` escapa el HTML y
 * lanza si aparece Review o AggregateRating (ADR-10): el render falla antes
 * de publicar datos fabricados.
 */
export function JsonLd({ data }: { data: JsonLdDocument | JsonLdDocument[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
