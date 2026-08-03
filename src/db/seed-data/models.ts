// Semilla de modelos (ADR-11). brandSlug enlaza contra brands.ts por slug.
// Sólo se marca is_active = true cuando una fuente citó el modelo en el
// contexto específico del mercado paraguayo. Lo demás queda is_active = false
// con nota [VERIFICAR] en introHtml, visible para quien cure el catálogo.
//
// Fuentes (agosto 2026):
// - Yamaha XTZ125, XTZ150, XTZ250, YBR125Z, Crypton: yamaha.com.py (páginas de
//   producto de Yamaha Motor Paraguay | Chacomer S.A.E.).
// - Bajaj Boxer 150, Rouser NS 200, Dominar 400: hoy.com.py, lanacion.com.py,
//   infonegocios.com.py (notas sobre el lanzamiento de Bajaj en Paraguay vía AMS).
// - Suzuki V-Strom 1050/800/650/250, DR 650, Gixxer 150: abc.com.py "Suzuki
//   Motos regresa a Paraguay con Chacomer".
// - TVS Raider 125: paraguay.tvsmotor.com/en/p/our-products/tvs-raider-py
//   (página de producto específica de TVS Paraguay).
// - Kenton Classic 125: digi.com.py, marketplace paraguayo con el modelo listado.
// - Honda CG 150 Titan, XR 150, Wave, CB 125: mencionados en resultados de
//   búsqueda genéricos (mercados regionales, no una página de hondamotos.com.py
//   confirmada — el sitio bloqueó el acceso directo). Quedan inactivos hasta
//   confirmar contra el catálogo vigente de hondamotos.com.py.

export type ModelSeed = {
  brandSlug: string;
  name: string;
  slug: string;
  engineCc?: number;
  isActive: boolean;
  note?: string;
};

export const modelSeeds: ModelSeed[] = [
  // Yamaha — confirmados en yamaha.com.py
  { brandSlug: "yamaha", name: "XTZ 125", slug: "xtz-125", engineCc: 125, isActive: true },
  { brandSlug: "yamaha", name: "XTZ 150", slug: "xtz-150", engineCc: 150, isActive: true },
  { brandSlug: "yamaha", name: "XTZ 250", slug: "xtz-250", engineCc: 250, isActive: true },
  { brandSlug: "yamaha", name: "YBR 125Z", slug: "ybr-125z", engineCc: 125, isActive: true },
  { brandSlug: "yamaha", name: "Crypton", slug: "crypton", isActive: true },

  // Bajaj — confirmados en prensa paraguaya sobre el lanzamiento de AMS
  { brandSlug: "bajaj", name: "Boxer 150", slug: "boxer-150", engineCc: 150, isActive: true },
  { brandSlug: "bajaj", name: "Rouser NS 200", slug: "rouser-ns-200", engineCc: 200, isActive: true },
  { brandSlug: "bajaj", name: "Dominar 400", slug: "dominar-400", engineCc: 400, isActive: true },

  // Suzuki — confirmados en abc.com.py sobre el regreso de Suzuki con Chacomer
  { brandSlug: "suzuki", name: "V-Strom 250", slug: "v-strom-250", engineCc: 250, isActive: true },
  { brandSlug: "suzuki", name: "V-Strom 650", slug: "v-strom-650", engineCc: 650, isActive: true },
  { brandSlug: "suzuki", name: "V-Strom 800", slug: "v-strom-800", engineCc: 800, isActive: true },
  { brandSlug: "suzuki", name: "V-Strom 1050", slug: "v-strom-1050", engineCc: 1050, isActive: true },
  { brandSlug: "suzuki", name: "DR 650", slug: "dr-650", engineCc: 650, isActive: true },
  { brandSlug: "suzuki", name: "Gixxer 150", slug: "gixxer-150", engineCc: 150, isActive: true },

  // TVS — confirmado en la página de producto de TVS Paraguay
  { brandSlug: "tvs", name: "Raider 125", slug: "raider-125", engineCc: 125, isActive: true },

  // Kenton — confirmado en un retailer paraguayo (digi.com.py)
  { brandSlug: "kenton", name: "Classic 125", slug: "classic-125", engineCc: 125, isActive: true },

  // Honda — sin confirmación directa contra hondamotos.com.py (403 al acceder)
  {
    brandSlug: "honda",
    name: "CG 150 Titan",
    slug: "cg-150-titan",
    engineCc: 150,
    isActive: false,
    note: "[VERIFICAR: confirmar contra el catálogo vigente de hondamotos.com.py]",
  },
  {
    brandSlug: "honda",
    name: "XR 150",
    slug: "xr-150",
    engineCc: 150,
    isActive: false,
    note: "[VERIFICAR: confirmar contra el catálogo vigente de hondamotos.com.py]",
  },
  {
    brandSlug: "honda",
    name: "Wave",
    slug: "wave",
    isActive: false,
    note: "[VERIFICAR: confirmar contra el catálogo vigente de hondamotos.com.py, incluida la cilindrada exacta vendida en Paraguay]",
  },
  {
    brandSlug: "honda",
    name: "CB 125",
    slug: "cb-125",
    engineCc: 125,
    isActive: false,
    note: "[VERIFICAR: confirmar contra el catálogo vigente de hondamotos.com.py]",
  },
];
