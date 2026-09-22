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
//
// Re-verificación R0 (acceso 2026-09-22, fuentes completas y access dates en
// docs/research/catalog.md — hondamotos.com.py/honda.com.py siguen bloqueados
// para esta sesión, ver nota en brands.ts):
// - Honda XR 150L: avisos publicados por "DIESA S.A." (distribuidor oficial)
//   en clasipar.paraguay.com, ej. "MOTOCICLETA HONDA XR150L 0KM - DIESA S.A"
//   (#1153760) — descrita ahí como Enduro/Cross/Trial, monocilíndrica 4T
//   refrigerada por aire, 150 cc. Reemplaza la nota [VERIFICAR] del genérico
//   "XR 150": se confirma el nombre comercial exacto vendido en Paraguay.
// - Honda Wave 110S: mismo canal, avisos "DIESA S.A." listan "WAVE110S".
// - Honda CG 110, XR 190, XR 250 Tornado, CRF 250F: avisos "DIESA S.A." en
//   clasipar.paraguay.com (paquete de financiación "10% de entrega + 36 cuotas
//   sin interés" citado en los mismos avisos). No se confirmó un modelo
//   "CG 150 Titan" ni "CB 125" en estos avisos — quedan inactivos (ver abajo).
// - Honda Rebel 500, NX500, X-ADV 750: lanzamiento oficial de Diesa S.A. en
//   Paraguay, abc.com.py "Lanzan Honda Rebel 500, NX500 y X-ADV 750"
//   (2025-04-12) y lanacion.com.py "Diesa presentó las nuevas motocicletas
//   Rebel 500, NX500 y X-ADV 750" (2025-04-04).
// - Honda CB 500X: mencionado junto a CRF250F en los mismos avisos "DIESA
//   S.A." de clasipar.paraguay.com como parte del catálogo Honda Paraguay.
// - Kenton GL 150, GL 150 Pro, GTR 150, GTR 150 LTD, Blitz 110: páginas de
//   producto propias en kenton.com.py (kenton.com.py/moto/gl-150,
//   /gl-150-pro, /gtr-150, /gtr-150-ltd, /blitz-110-dlx, /blitz-110-se,
//   /blitz-110-automatic), con ficha técnica completa. Fuente de mayor
//   confianza que la ya usada para Classic 125 (sólo un retailer).
// - Star 150, SMX 150: páginas de producto propias en star.com.py
//   (star.com.py/producto/SK150-CG-CKD/motocicleta-star-150-150cc y
//   star.com.py/producto/SMX150-CKD/smx-150cc).
//
// Mapeo propuesto modelo → categoría (categoryId no lo asigna este seed —
// scripts/ no es Owns de R0): ver la tabla en docs/research/catalog.md.

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

  // Kenton — Classic 125 confirmado en un retailer paraguayo (digi.com.py);
  // el resto (R0) confirmado directo en páginas de producto de kenton.com.py.
  { brandSlug: "kenton", name: "Classic 125", slug: "classic-125", engineCc: 125, isActive: true },
  { brandSlug: "kenton", name: "GL 150", slug: "gl-150", engineCc: 150, isActive: true },
  { brandSlug: "kenton", name: "GL 150 Pro", slug: "gl-150-pro", engineCc: 150, isActive: true },
  { brandSlug: "kenton", name: "GTR 150", slug: "gtr-150", engineCc: 150, isActive: true },
  { brandSlug: "kenton", name: "GTR 150 LTD", slug: "gtr-150-ltd", engineCc: 150, isActive: true },
  { brandSlug: "kenton", name: "Blitz 110", slug: "blitz-110", engineCc: 110, isActive: true },

  // Star (R0) — confirmado en páginas de producto propias de star.com.py
  { brandSlug: "star", name: "Star 150", slug: "star-150", engineCc: 150, isActive: true },
  { brandSlug: "star", name: "SMX 150", slug: "smx-150", engineCc: 150, isActive: true },

  // Honda — re-verificado en R0 vía avisos "DIESA S.A." (distribuidor
  // oficial) en clasipar.paraguay.com y prensa paraguaya. hondamotos.com.py
  // y honda.com.py siguen bloqueados para esta sesión (ver nota arriba).
  {
    brandSlug: "honda",
    name: "XR 150L",
    slug: "xr-150",
    engineCc: 150,
    isActive: true,
  },
  {
    brandSlug: "honda",
    name: "Wave 110S",
    slug: "wave",
    engineCc: 110,
    isActive: true,
  },
  { brandSlug: "honda", name: "CG 110", slug: "cg-110", engineCc: 110, isActive: true },
  { brandSlug: "honda", name: "XR 190", slug: "xr-190", engineCc: 190, isActive: true },
  { brandSlug: "honda", name: "XR 250 Tornado", slug: "xr-250-tornado", engineCc: 250, isActive: true },
  { brandSlug: "honda", name: "CRF 250F", slug: "crf-250f", engineCc: 250, isActive: true },
  { brandSlug: "honda", name: "CB 500X", slug: "cb-500x", engineCc: 500, isActive: true },
  {
    brandSlug: "honda",
    name: "Rebel 500",
    slug: "rebel-500",
    engineCc: 500,
    isActive: true,
  },
  { brandSlug: "honda", name: "NX500", slug: "nx500", engineCc: 500, isActive: true },
  { brandSlug: "honda", name: "X-ADV 750", slug: "x-adv-750", engineCc: 750, isActive: true },
  {
    brandSlug: "honda",
    name: "CG 150 Titan",
    slug: "cg-150-titan",
    engineCc: 150,
    isActive: false,
    note: "[VERIFICAR: no aparece en los avisos \"DIESA S.A.\" relevados en R0 (que sí confirman CG 110); la nomenclatura \"Titan\" es de Argentina/Brasil — confirmar si DIESA vende alguna variante \"Titan\" en Paraguay o si el nombre correcto es simplemente CG 110/CG 125]",
  },
  {
    brandSlug: "honda",
    name: "CB 125",
    slug: "cb-125",
    engineCc: 125,
    isActive: false,
    note: "[VERIFICAR: no aparece en los avisos \"DIESA S.A.\" relevados en R0 (que sí confirman CB 500X); confirmar si Honda Paraguay vende un CB de cilindrada de entrada distinto de CB 500X]",
  },
];
