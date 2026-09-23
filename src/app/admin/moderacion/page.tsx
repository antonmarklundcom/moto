import Link from "next/link";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { DecisionPanel } from "@/components/admin/moderation/decision-panel";
import { moderationItem, pendingQueue } from "@/components/admin/moderation/queue";
import { REJECTION_CODES, REJECTION_LABEL, REJECTION_TEXT } from "@/components/admin/moderation/texts";
import { formatGuaranies, groupThousands } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";
import { paths } from "@/lib/seo/routes";

// Cola de moderación (ADMIN_SPEC.md §3): una publicación a la vez.
const section = adminSection("moderacion");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

const CHECKLIST = [
  "Es una moto (o vehículo de la categoría declarada)",
  "Al menos una foto real de la unidad, o foto de catálogo marcada como tal si es 0 km",
  "Fotos sin marca de agua de otro portal",
  "Precio de contado o esquema de financiación completo",
  "Marca y modelo mapeables al catálogo",
  "Ciudad y teléfono válidos",
  "Descripción sin datos de contacto embebidos",
  "Sin señales de vendedor en el exterior ni pedido de seña",
];

const STATUS_LABEL: Record<string, string> = {
  published: "publicada",
  pending_review: "en moderación",
  rejected: "rechazada",
  paused: "pausada",
  sold: "vendida",
  expired: "vencida",
  draft: "borrador",
};

function phoneText(e164: string): string {
  try {
    return formatPhoneDisplay(e164);
  } catch {
    return e164;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requirePageRole("/admin/moderacion", ...section.roles);
  const { id } = await searchParams;
  const queue = await pendingQueue();
  const requested = Number(id);
  const currentId = queue.some((q) => q.id === requested) ? requested : queue[0]?.id;
  const slaCount = queue.filter((q) => q.slaAlert).length;

  if (!currentId) {
    return (
      <main className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{section.label}</h1>
        <p>No hay publicaciones esperando moderación.</p>
      </main>
    );
  }
  const item = (await moderationItem(currentId))!;
  const l = item.listing;
  const s = item.signals;
  const pos = queue.findIndex((q) => q.id === currentId);
  const next = queue[(pos + 1) % queue.length];
  const nextHref = next && next.id !== currentId ? `/admin/moderacion?id=${next.id}` : "/admin/moderacion";
  const reasons = REJECTION_CODES.map((c) => ({ code: c, label: REJECTION_LABEL[c], text: REJECTION_TEXT[c] }));
  const price = l.hasFinancingOnly ? null : formatGuaranies(l.priceGs);
  const facts: Array<[string, string]> = [
    ["Vendedor", item.names.dealer ? `Comercio: ${item.names.dealer}${item.dealerAutoApprove ? " (auto-aprobación)" : ""}` : "Particular"],
    ["Marca / modelo", `${item.names.brand} ${item.names.model ?? "—"}${l.modelId === null ? " (texto libre)" : ""}`],
    ["Condición", l.condition === "new" ? "0 km" : "Usada"],
    ["Año", l.year ? String(l.year) : "—"],
    ["Kilometraje", l.mileageKm !== null ? `${groupThousands(l.mileageKm)} km` : "—"],
    ["Tipo / ciudad", `${item.names.category} · ${item.names.city}`],
    ["Precio", price ?? (l.installmentGs ? `Sólo financiado: ${l.installmentCount} cuotas de ${formatGuaranies(l.installmentGs)}` : "Sin precio")],
    ["Entrega / cuota", l.installmentGs ? `${formatGuaranies(l.downPaymentGs) ?? "sin entrega"} + ${l.installmentCount} × ${formatGuaranies(l.installmentGs)}` : "—"],
    ["Teléfono", `${phoneText(l.contactPhoneE164)}${l.contactWhatsapp ? " (WhatsApp)" : " (sólo llamadas)"}`],
    ["Papeles", l.documentationStatus ?? (l.condition === "new" ? "0 km" : "—")],
  ];
  const Related = ({ items }: { items: typeof s.samePhone }) => (
    <ul className="ml-4 list-disc text-sm">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/admin/moderacion?id=${r.id}`} className="underline">
            {r.title}
          </Link>{" "}
          ({STATUS_LABEL[r.status] ?? r.status}, {r.publicRef})
        </li>
      ))}
    </ul>
  );

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{section.label}</h1>
        <p>
          {queue.length} en cola · {pos + 1} de {queue.length}
          {slaCount ? <strong className="ml-2 text-red-800">{slaCount} con más de 20 h</strong> : null}
        </p>
      </div>
      <p className="text-sm">
        Atajos: <kbd>A</kbd> aprobar · <kbd>R</kbd> rechazar · <kbd>1</kbd>–<kbd>9</kbd> motivo · <kbd>S</kbd> saltar · <kbd>E</kbd> editar · <kbd>D</kbd> duplicados ·{" "}
        <kbd>←</kbd>/<kbd>→</kbd> fotos
      </p>
      {s.slaAlert ? (
        <p role="alert" className="rounded border border-red-800 bg-red-50 p-2 text-red-900">
          Lleva {s.hoursInQueue} h en cola (SLA: menos de 24 h).
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="fotos-titulo">
          <h2 id="fotos-titulo" className="sr-only">
            Fotos
          </h2>
          <ul id="fotos" className="flex snap-x gap-2 overflow-x-auto" tabIndex={0} aria-label={`${item.images.length} fotos`}>
            {item.images.map((img, i) => (
              <li key={img.id} className="relative w-full shrink-0 snap-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`Foto ${i + 1} de ${item.images.length}`} className="max-h-[70vh] w-full rounded bg-gray-100 object-contain" />
                {img.isCatalogPhoto ? <span className="absolute left-2 top-2 rounded bg-white px-2 py-1 text-xs font-medium">Foto de catálogo</span> : null}
              </li>
            ))}
          </ul>
          {item.images.length === 0 ? <p className="rounded bg-gray-100 p-8 text-center">Sin fotos</p> : null}
          <h2 className="mt-4 text-lg font-bold">{l.title}</h2>
          <p className="mt-1 whitespace-pre-line">{l.description ?? "Sin descripción."}</p>
        </section>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-700">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="senales" className="rounded border border-gray-400 p-3 text-sm">
            <h2 id="senales" className="font-bold">
              Señales {s.score ? `(${s.score})` : "(ninguna)"}
            </h2>
            <ul className="mt-1 flex flex-col gap-1">
              <li className={s.price.outlier ? "font-bold text-red-800" : ""}>{s.price.text}</li>
              <li className={s.phoneRejectedBefore ? "font-bold text-red-800" : ""}>
                Mismo teléfono en otras publicaciones: {s.samePhone.length}
                {s.phoneRejectedBefore ? " (alguna rechazada)" : ""}
                {s.samePhone.length ? <Related items={s.samePhone} /> : null}
              </li>
              <li className={s.sameIp24h > 3 ? "font-bold text-red-800" : ""}>Desde la misma IP en 24 h: {s.sameIp24h}</li>
              {s.fraudWords.length ? <li className="font-bold text-red-800">Palabras de riesgo: {s.fraudWords.join(", ")}</li> : null}
            </ul>
            <details id="duplicados" className="mt-2" open={s.duplicatePhotos.length + s.lookalikes.length > 0}>
              <summary className={`cursor-pointer ${focus}`}>
                Posibles duplicados <kbd>D</kbd>: {s.duplicatePhotos.length} por foto, {s.lookalikes.length} por modelo/año/precio
              </summary>
              {s.duplicatePhotos.length ? (
                <>
                  <p className="mt-1">Misma foto (sin contar fotos de catálogo):</p>
                  <Related items={s.duplicatePhotos} />
                </>
              ) : null}
              {s.lookalikes.length ? (
                <>
                  <p className="mt-1">Mismo modelo, año y precio:</p>
                  <Related items={s.lookalikes} />
                </>
              ) : null}
            </details>
          </section>

          <fieldset className="rounded border border-gray-400 p-3 text-sm">
            <legend className="px-1 font-bold">Checklist (T&amp;S §3)</legend>
            {CHECKLIST.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className={`h-5 w-5 ${focus}`} /> {c}
              </label>
            ))}
          </fieldset>

          <DecisionPanel
            key={l.id}
            listingId={l.id}
            reasons={reasons}
            modelOptions={item.modelOptions}
            suggestion={item.suggestion?.rawText ?? l.modelRaw}
            nextHref={nextHref}
            editHref={`/admin/publicaciones/${l.id}`}
          />
          {l.slug && l.status === "published" ? (
            <Link href={paths.listing(l)} className="underline">
              Ver ficha pública
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
