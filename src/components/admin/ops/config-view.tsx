// Vista de configuración (G-13, ADR-22): sólo lectura. Pura: recibe la foto
// ya armada, para poder probar que nunca muestra un secreto.
import { formatPhoneDisplay } from "@/lib/phone";
import { THRESHOLDS } from "@/lib/seo/indexability";
import type { SiteIndexingMode } from "@/lib/env";

export type ConfigSnapshot = {
  mode: SiteIndexingMode;
  rawSiteNoindex: string | null;
  liveListings: number;
  activeDealers: number;
  whatsappSiteNumber: string | null;
  crmUrlSet: boolean;
  crmKeySet: boolean;
  cronSecretSet: boolean;
  sessionSecretSet: boolean;
  ipSaltSet: boolean;
};

const MODE_TEXT: Record<SiteIndexingMode, { value: string; text: string }> = {
  none: { value: "true", text: "Todo el sitio está en noindex (arranque)." },
  content: { value: "content", text: "Guías y páginas fijas indexables; inventario en noindex." },
  rules: { value: "false", text: "Rigen las reglas de umbral por página (SEO §2.1)." },
};

const TYPE_LABEL: Record<string, string> = {
  brand: "Marca",
  model: "Marca + modelo",
  category: "Categoría",
  city: "Ciudad",
  brand_city: "Marca × ciudad",
  category_city: "Categoría × ciudad",
  condition: "Nuevas / usadas",
  en_cuotas: "En cuotas",
};

function phone(v: string | null): string {
  if (!v) return "Sin cargar";
  try {
    return formatPhoneDisplay(v);
  } catch {
    return "Cargado, pero no es un número paraguayo válido";
  }
}

const yesNo = (b: boolean) => (b ? "Cargada" : "Falta");

export function ConfigView({ c }: { c: ConfigSnapshot }) {
  const mode = MODE_TEXT[c.mode];
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="indexacion" className="rounded border border-gray-400 p-3">
        <h2 id="indexacion" className="text-lg font-bold">
          Indexación (SITE_NOINDEX)
        </h2>
        <p className="mt-1">
          Valor actual: <strong>{mode.value}</strong>
          {c.rawSiteNoindex !== null && c.rawSiteNoindex.trim().toLowerCase() !== mode.value ? " (el valor cargado no es válido: se toma como «true»)" : ""}. {mode.text}
        </p>
        <p className="mt-1">
          Hoy: <strong>{c.liveListings}</strong> publicaciones vivas y <strong>{c.activeDealers}</strong> comercios activos. El criterio para abrir es ≥ 150
          publicaciones de ≥ 5 comercios y los textos legales aprobados (DATA_SEEDING §3).
        </p>
        <h3 className="mt-3 font-semibold">Cómo cambiarlo</h3>
        <ol className="ml-5 list-decimal">
          <li>hPanel → Sitios web → moto.com.py → Node.js → Variables de entorno.</li>
          <li>
            Cambiar <code>SITE_NOINDEX</code> a <code>content</code> o <code>false</code> (sólo el propietario, con el criterio cumplido).
          </li>
          <li>Guardar y reiniciar la aplicación. Las cabeceras y lo prerenderizado se recalculan con un nuevo build (ADR-26).</li>
          <li>Anotar la fecha y el motivo del cambio.</li>
        </ol>
      </section>

      <section aria-labelledby="umbrales" className="rounded border border-gray-400 p-3">
        <h2 id="umbrales" className="text-lg font-bold">
          Umbrales de indexación (lectura)
        </h2>
        <table className="mt-2 text-sm">
          <caption className="sr-only">Umbrales</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="pr-4">Página</th>
              <th scope="col" className="pr-4">Publicaciones vivas</th>
              <th scope="col">Palabras propias</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(THRESHOLDS).map(([k, t]) => (
              <tr key={k}>
                <td className="pr-4">{TYPE_LABEL[k] ?? k}</td>
                <td className="pr-4">{t.minLive}</td>
                <td>{t.minWords}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-sm">Cambiarlos es una decisión de SEO: se escala (PLAN §4.3).</p>
      </section>

      <section aria-labelledby="otros" className="rounded border border-gray-400 p-3">
        <h2 id="otros" className="text-lg font-bold">
          Otros valores
        </h2>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt>WhatsApp del sitio (WHATSAPP_SITE_NUMBER)</dt>
          <dd>{phone(c.whatsappSiteNumber)}</dd>
          <dt>Vencimiento por defecto</dt>
          <dd>60 días (por comercio: «Vencimiento de sus publicaciones» en su ficha)</dd>
          <dt>VenderCRM: URL</dt>
          <dd>{yesNo(c.crmUrlSet)}</dd>
          <dt>VenderCRM: API key</dt>
          <dd>{yesNo(c.crmKeySet)} (el valor nunca se muestra)</dd>
          <dt>CRON_SECRET</dt>
          <dd>{yesNo(c.cronSecretSet)}</dd>
          <dt>SESSION_SECRET</dt>
          <dd>{yesNo(c.sessionSecretSet)}</dd>
          <dt>IP_HASH_SALT</dt>
          <dd>{yesNo(c.ipSaltSet)}</dd>
          <dt>Textos legales</dt>
          <dd>No se editan desde el admin: son archivos revisados por el abogado (LEGAL §10).</dd>
        </dl>
      </section>
    </div>
  );
}
