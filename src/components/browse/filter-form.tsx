import { paths } from "@/lib/seo/routes";
import { fieldClass, labelClass as sharedLabel, focusRing, primaryButton, secondaryButton, surface } from "@/components/public/styles";
import type { ListingCondition, ParsedSearchParams } from "@/lib/listings/filters";
import type { Option } from "./data";

// Filtros de PRODUCT_SPEC.md §3.2 como formulario GET a /motos: funciona sin
// JS. /motos pasa las facetas que tienen página propia a la ruta limpia
// (`?marca=honda` → `/motos/honda`) y deja el resto en el query string.
// Entrega y cuota máximas van a la vista, no escondidas (diferencial). En
// móvil sólo lo principal ocupa la primera pantalla (E1): tipo, condición y
// precio pasan a "Más filtros", que se abre solo si alguno está aplicado.

const field = fieldClass;
const labelClass = sharedLabel;

const SORT_OPTIONS: ReadonlyArray<Option> = [
  { value: "recientes", label: "Más recientes" },
  { value: "precio_asc", label: "Menor precio" },
  { value: "precio_desc", label: "Mayor precio" },
  { value: "km_asc", label: "Menos kilómetros" },
  { value: "anio_desc", label: "Año más nuevo" },
];

function Select({ name, label, value, options, all }: { name: string; label: string; value?: string; options: readonly Option[]; all: string }) {
  return (
    <label className={labelClass}>
      {label}
      <select name={name} defaultValue={value ?? ""} className={field}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Amount({ name, label, value, placeholder }: { name: string; label: string; value?: number; placeholder: string }) {
  return (
    <label className={labelClass}>
      {label}
      <input name={name} inputMode="numeric" defaultValue={value ?? ""} placeholder={placeholder} className={field} />
    </label>
  );
}

export function FilterForm({
  facets,
  parsed,
  options,
}: {
  facets: { brand?: string; model?: string; category?: string; city?: string; condition?: ListingCondition };
  parsed: ParsedSearchParams;
  options: { brands: Option[]; models: Option[]; categories: Option[]; cities: Option[] };
}) {
  const f = parsed.filters;
  const cc = f.ccMin !== undefined || f.ccMax !== undefined ? (f.ccMin === f.ccMax ? String(f.ccMin) : `${f.ccMin ?? ""}-${f.ccMax ?? ""}`) : "";
  const moreOpen = Boolean(f.yearMin || f.kmMax || cc || f.q || f.priceMin || f.priceMax || facets.category || facets.condition);
  return (
    <form method="get" action={paths.motos} role="search" aria-label="Filtrar motos" className={`${surface} flex flex-col gap-3 p-4`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Amount name="cuota_max" label="Cuota máxima (Gs.)" value={f.installmentMax} placeholder="600.000" />
        <Amount name="entrega_max" label="Entrega máxima (Gs.)" value={f.downPaymentMax} placeholder="2.000.000" />
        <Select name="marca" label="Marca" value={facets.brand} options={options.brands} all="Todas" />
        {options.models.length ? <Select name="modelo" label="Modelo" value={facets.model} options={options.models} all="Todos" /> : null}
        <Select name="ciudad" label="Ciudad" value={facets.city} options={options.cities} all="Todo el país" />
      </div>
      <details open={moreOpen} className="rounded-lg border border-slate-200 px-3">
        <summary className={`min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-900 ${focusRing}`}>Más filtros</summary>
        <div className="grid grid-cols-2 gap-3 pb-3 md:grid-cols-4">
          <Select name="tipo" label="Tipo" value={facets.category} options={options.categories} all="Todos" />
          <Select
            name="condicion"
            label="Condición"
            value={facets.condition ? (facets.condition === "new" ? "nueva" : "usada") : undefined}
            options={[
              { value: "nueva", label: "0 km" },
              { value: "usada", label: "Usadas" },
            ]}
            all="Nuevas y usadas"
          />
          <Amount name="precio_max" label="Precio máximo (Gs.)" value={f.priceMax} placeholder="15.000.000" />
          <Amount name="precio_min" label="Precio mínimo (Gs.)" value={f.priceMin} placeholder="5.000.000" />
          <Amount name="anio_min" label="Año desde" value={f.yearMin} placeholder="2018" />
          <Amount name="km_max" label="Kilómetros hasta" value={f.kmMax} placeholder="30.000" />
          <label className={labelClass}>
            Cilindrada (cc)
            <input name="cilindrada" defaultValue={cc} placeholder="125-250" className={field} />
          </label>
          <label className={`${labelClass} col-span-2`}>
            Buscar por texto
            <input name="q" type="search" defaultValue={f.q ?? ""} placeholder="Ej.: XR 150 roja" className={field} />
          </label>
        </div>
      </details>
      <div className="flex flex-wrap items-end gap-3">
        <Select name="orden" label="Ordenar por" value={parsed.sort === "recientes" ? undefined : parsed.sort} options={SORT_OPTIONS.slice(1)} all="Más recientes" />
        <button type="submit" className={primaryButton}>
          Ver motos
        </button>
        <a href={paths.motos} className={secondaryButton}>
          Limpiar
        </a>
      </div>
    </form>
  );
}
