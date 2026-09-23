import type { Metadata } from "next";
import Link from "next/link";
import { homeData } from "@/components/financing-compare/model-data";
import { ListingCard } from "@/components/public/listing-card";
import { container, fieldClass, labelClass, primaryButton, secondaryButton, sectionTitle, surface } from "@/components/public/styles";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// Home (T-120, G-10): primero la cuota. Sin carrusel, sin contadores
// (PRODUCT_SPEC §3.1): sólo publicaciones reales y búsquedas que llevan a
// páginas con inventario.
export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Motos en venta en Paraguay, en cuotas y al contado",
    description:
      "Buscá motos nuevas y usadas en Paraguay por la cuota que podés pagar. Entrega y cuotas informadas por cada comercio, precios en guaraníes y WhatsApp directo.",
    canonical: paths.home,
  });
}

const field = fieldClass;
const label = labelClass;
/** Etiquetas sobre el fondo oscuro del bloque principal. */
const heroLabel = "flex flex-col gap-1 text-sm font-medium text-white";

export default async function HomePage() {
  const { recent, brands, cities } = await homeData();
  return (
    <>
      <section aria-labelledby="cuota" className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
        <div className={`${container} py-10 sm:py-14`}>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">Motos en Paraguay</p>
          <h1 id="cuota" className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            ¿Cuánto podés pagar por mes?
          </h1>
          <p className="mt-2 max-w-prose text-slate-200">
            Motos nuevas y usadas en Paraguay, con la entrega y la cuota que informa cada comercio. Poné tu cuota y te mostramos las que entran.
          </p>
          <form method="get" action={paths.motos} className="mt-6 grid max-w-3xl grid-cols-1 items-end gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 sm:grid-cols-3">
            <label className={heroLabel}>
              Cuota máxima por mes (Gs.)
              <input name="cuota_max" inputMode="numeric" placeholder="500.000" className={field} />
            </label>
            <label className={heroLabel}>
              Entrega máxima (Gs.)
              <input name="entrega_max" inputMode="numeric" placeholder="1.500.000" className={field} />
            </label>
            <button type="submit" className={primaryButton}>
              Ver motos en cuotas
            </button>
          </form>
          <p className="mt-4 text-sm text-slate-300">
            Las cuotas las informa cada comercio; nosotros no las calculamos ni aprobamos créditos.{" "}
            <Link href={paths.enCuotas} className="font-medium text-white underline decoration-white/50 underline-offset-2 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">
              Ver todas las motos en cuotas
            </Link>
          </p>
        </div>
      </section>

      <div className={container}>
        <section aria-labelledby="buscar" className={`${surface} mt-8 p-4 sm:p-6`}>
          <h2 id="buscar" className={sectionTitle}>
            O buscá por marca y ciudad
          </h2>
          <form method="get" action={paths.motos} className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
            {brands.length ? (
              <label className={label}>
                Marca
                <select name="marca" defaultValue="" className={field}>
                  <option value="">Todas</option>
                  {brands.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {cities.length ? (
              <label className={label}>
                Ciudad
                <select name="ciudad" defaultValue="" className={field}>
                  <option value="">Todo el país</option>
                  {cities.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={label}>
              Precio máximo (Gs.)
              <input name="precio_max" inputMode="numeric" placeholder="15.000.000" className={field} />
            </label>
            <button type="submit" className={secondaryButton}>
              Buscar
            </button>
          </form>
        </section>

        <section aria-labelledby="recientes" className="mt-10">
          <h2 id="recientes" className={sectionTitle}>
            Recién publicadas
          </h2>
          {recent.length ? (
            <>
              <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recent.map((l) => (
                  <li key={l.id} className="flex">
                    <ListingCard listing={l} headingLevel={3} />
                  </li>
                ))}
              </ul>
              <p className="mt-4">
                <Link href={paths.motos} className={secondaryButton}>
                  Ver todas las motos
                </Link>
              </p>
            </>
          ) : (
            <div className={`${surface} mt-3 p-4`}>
              <p>Todavía no hay motos publicadas. Estamos sumando comercios: si vendés motos, escribinos.</p>
              <p className="mt-3 flex flex-wrap gap-2">
                <Link href={paths.publish} className={primaryButton}>
                  Publicá tu moto gratis
                </Link>
                <a href={paths.whatsappGeneral("Hola, quiero publicar el stock de mi comercio")} rel="nofollow" className={secondaryButton}>
                  Escribir por WhatsApp
                </a>
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
