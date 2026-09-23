import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/public/json-ld";
import { container, linkClass, primaryButton, secondaryButton } from "@/components/public/styles";
import { env } from "@/lib/env";
import { articleJsonLd } from "@/lib/seo/jsonld";
import { contentPageMetadata } from "@/lib/seo/meta";
import { absoluteUrl, paths } from "@/lib/seo/routes";
import { longDatePy, publishedGuide, publishedGuideSlugs } from "../data";
import { unlinkUnpublishedGuides } from "../links";

// /guias/:slug (PRODUCT_SPEC §3.6): artículo, migas, enlaces a listados y CTA.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function validSlug(slug: string): boolean {
  try {
    paths.guide(slug);
    return true;
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = validSlug(slug) ? await publishedGuide(slug) : null;
  if (!post) return {};
  return {
    ...contentPageMetadata({
      title: post.metaTitle ?? post.title,
      description: post.metaDescription ?? post.excerpt ?? post.title,
      canonical: paths.guide(post.slug),
      ogType: "article",
    }),
  };
}

// Tipografía mínima del cuerpo (sin librería: ADR-15).
const body =
  "mt-4 max-w-prose [&_a]:text-blue-800 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6";

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!validSlug(slug)) notFound();
  const post = await publishedGuide(slug);
  if (!post || !post.publishedAt) notFound();
  const bodyHtml = unlinkUnpublishedGuides(post.bodyHtml ?? "", await publishedGuideSlugs());
  const siteUrl = env.siteUrl();
  const url = absoluteUrl(paths.guide(post.slug), siteUrl);
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Guías", href: paths.guides }, { name: post.title, href: paths.guide(post.slug) }]} />
      <article className="mt-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{post.title}</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Publicada el <time dateTime={post.publishedAt.toISOString()}>{longDatePy(post.publishedAt)}</time> · Actualizada el{" "}
          <time dateTime={post.updatedAt.toISOString()}>{longDatePy(post.updatedAt)}</time>
        </p>
        {/* body_html se limpió al guardar (admin/contenido, allowlist) y lo revisó una persona (reviewed_by). */}
        <div className={body} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </article>
      <aside aria-label="Seguí buscando" className="mt-8 flex max-w-prose flex-wrap gap-2 border-t pt-4">
        <Link href={paths.motos} className={primaryButton}>
          Ver motos publicadas
        </Link>
        <Link href={paths.publish} className={secondaryButton}>
          Publicá tu moto gratis
        </Link>
        <Link href={paths.guides} className={`${linkClass} inline-flex min-h-11 items-center`}>
          Más guías
        </Link>
      </aside>
      <JsonLd
        data={articleJsonLd({
          url,
          headline: post.title,
          description: post.metaDescription ?? post.excerpt,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          siteUrl,
        })}
      />
    </div>
  );
}
