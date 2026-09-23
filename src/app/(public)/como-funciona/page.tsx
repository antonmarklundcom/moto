import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container, linkClass } from "@/components/public/styles";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// /como-funciona (PRODUCT_SPEC §3.7). Sólo lo que el sitio hace de verdad:
// cada afirmación corresponde a código que existe (publicar, moderación,
// enlace privado, WhatsApp rastreado, denuncias, formulario de financiación).
export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Cómo funciona",
    description:
      "Cómo buscar motos nuevas y usadas en Paraguay, escribir al vendedor por WhatsApp, publicar gratis sin registrarte y pedir que te orienten con la financiación.",
    canonical: paths.howItWorks,
  });
}

export default function ComoFuncionaPage() {
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Cómo funciona", href: paths.howItWorks }]} />
      <h1 className="mt-2 text-2xl font-bold">Cómo funciona</h1>
      <p className="mt-3 max-w-prose">
        moto.com.py junta en un solo lugar motos 0 km y usadas que publican comercios y particulares de Paraguay. No vendemos motos ni cobramos por la compra: te conectamos con quien la vende.
      </p>

      <h2 className="mt-6 text-xl font-bold">Si buscás una moto</h2>
      <ul className="mt-2 max-w-prose list-disc pl-6 [&_li]:mt-1">
        <li>
          Buscá por marca, tipo, ciudad o precio en{" "}
          <Link href={paths.motos} className={linkClass}>
            las motos publicadas
          </Link>
          . Los precios están en guaraníes y, si el comercio vende en cuotas, ves la entrega y las cuotas que informa el comercio.
        </li>
        <li>Con el botón «Escribir por WhatsApp» le escribís directo al vendedor. No hay chat interno ni intermediarios en el pago.</li>
        <li>Antes de pagar, vé la moto en persona, fijate que los papeles coincidan con el vendedor y no transfieras plata por adelantado.</li>
        <li>Si una publicación te parece sospechosa, usá «Denunciar esta publicación» en la ficha: la revisamos.</li>
      </ul>

      <h2 className="mt-6 text-xl font-bold">Si querés comprar en cuotas</h2>
      <p className="mt-2 max-w-prose">
        En{" "}
        <Link href={paths.financing} className={linkClass}>
          financiación
        </Link>{" "}
        dejás tu teléfono y lo que buscás, y te contactamos para orientarte y derivarte con el comercio o la financiera. moto.com.py no otorga créditos ni garantiza aprobación, y el formulario nunca te pide tu cédula ni datos de tu cuenta.
      </p>

      <h2 className="mt-6 text-xl font-bold">Si vendés tu moto</h2>
      <ul className="mt-2 max-w-prose list-disc pl-6 [&_li]:mt-1">
        <li>
          <Link href={paths.publish} className={linkClass}>
            Publicá tu moto gratis
          </Link>
          , sin registrarte: fotos, datos, precio y tu teléfono.
        </li>
        <li>Revisamos cada publicación de particulares antes de mostrarla. Si falta algo, te decimos qué corregir.</li>
        <li>Cuando se aprueba, te mandamos un enlace privado para marcarla como vendida, pausarla, renovarla o cambiar el precio. No lo compartas: quien lo tenga puede cambiar tu publicación.</li>
        <li>La publicación vence después de un tiempo y la podés renovar desde ese enlace.</li>
        <li>Tu número no queda escrito en la página a la vista de todos: lo ve quien toca «Escribir por WhatsApp» o «Ver teléfono».</li>
      </ul>

      <h2 className="mt-6 text-xl font-bold">Si tenés un comercio</h2>
      <p className="mt-2 max-w-prose">
        Los comercios tienen su página con todo su stock. Si querés sumar el tuyo, mirá{" "}
        <Link href={paths.dealers} className={linkClass}>
          comercios
        </Link>{" "}
        o{" "}
        <Link href={paths.contact} className={linkClass}>
          escribinos
        </Link>
        .
      </p>

      <p className="mt-6 max-w-prose">
        ¿Dudas con los papeles o la transferencia? En las{" "}
        <Link href={paths.guides} className={linkClass}>
          guías
        </Link>{" "}
        te contamos cómo es cada trámite.
      </p>
    </div>
  );
}
