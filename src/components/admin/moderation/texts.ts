// Textos de moderación (CONTENT_STRATEGY.md §1.6, T&S §4). Puros.
// Fórmula del rechazo: qué pasó → cómo arreglarlo → invitación a reenviar.
// Nunca acusatorio; en `sospecha_fraude` nunca se dice qué señal se vio.

export const REJECTION_CODES = [
  "sin_fotos",
  "fotos_ajenas",
  "sin_precio",
  "datos_incompletos",
  "no_es_moto",
  "duplicada",
  "sospecha_fraude",
  "contacto_en_descripcion",
  "contenido_inapropiado",
  "precio_irreal",
  "documentacion",
  "otro",
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export const REJECTION_LABEL: Record<RejectionCode, string> = {
  sin_fotos: "Sin fotos o fotos ilegibles",
  fotos_ajenas: "Fotos de otro sitio o de internet",
  sin_precio: "Sin precio ni financiación",
  datos_incompletos: "Faltan datos obligatorios",
  no_es_moto: "No corresponde a la categoría",
  duplicada: "Ya publicada",
  sospecha_fraude: "Coincide con un patrón de fraude",
  contacto_en_descripcion: "Contacto dentro del texto",
  contenido_inapropiado: "Contenido inaceptable",
  precio_irreal: "Precio anzuelo evidente",
  documentacion: "Documentación irregular",
  otro: "Otro (nota obligatoria)",
};

/** Aviso al vendedor, pre-cargado y editable. Los tres primeros son los de §1.6, literales. */
export const REJECTION_TEXT: Record<RejectionCode, string> = {
  sin_fotos:
    "No pudimos publicar tu moto porque las fotos no se ven bien. Sacá 3 o 4 fotos con buena luz, de frente, de costado y del tablero, y volvé a enviarla. Cualquier cosa, escribinos.",
  fotos_ajenas:
    "Las fotos que subiste parecen tomadas de otro sitio. Necesitamos fotos de tu moto para publicarla. Subí las tuyas y la revisamos de nuevo.",
  sospecha_fraude:
    "No vamos a publicar esta moto porque no cumple con nuestras normas de seguridad. Si creés que es un error, escribinos y lo revisamos.",
  sin_precio:
    "No pudimos publicar tu moto porque no tiene precio. Poné el precio de contado, o la entrega y las cuotas si la vendés financiada, y volvé a enviarla.",
  datos_incompletos:
    "A tu publicación le faltan datos para poder publicarla. Revisá marca, modelo, año, kilómetros y ciudad, y volvé a enviarla. Cualquier cosa, escribinos.",
  no_es_moto:
    "Por ahora sólo publicamos motos y vehículos de las categorías del sitio. Si es una moto y nos equivocamos, escribinos y lo revisamos.",
  duplicada:
    "Esta moto ya está publicada en el sitio. Si es otra unidad, contanos en qué se diferencia y volvé a enviarla.",
  contacto_en_descripcion:
    "Sacá el teléfono, el email o los enlaces de la descripción: los compradores te escriben con el botón de WhatsApp. Corregilo y volvé a enviarla.",
  contenido_inapropiado:
    "No pudimos publicar tu moto porque el texto tiene contenido que no aceptamos. Escribí una descripción de la moto y volvé a enviarla.",
  precio_irreal:
    "El precio de tu publicación no parece real. Poné el precio al que la vendés de verdad y volvé a enviarla. Si el precio es correcto, escribinos.",
  documentacion:
    "Para publicar la moto necesitamos que la documentación permita venderla legalmente. Cuando tengas los papeles en regla, volvé a enviarla. Cualquier duda, escribinos.",
  otro: "",
};

export function isRejectionCode(value: unknown): value is RejectionCode {
  return typeof value === "string" && (REJECTION_CODES as readonly string[]).includes(value);
}

/** Enlace privado G-1. `/mi-aviso` no está en el contrato de rutas todavía (B4 lo publica): link-pass. */
export function manageLinkPath(token: string): string {
  return `/mi-aviso/${encodeURIComponent(token)}`;
}

/** Mensaje de WhatsApp al aprobar una publicación de particular (G-1), con el enlace privado. */
export function approvalMessage(input: { title: string; listingUrl: string; manageUrl: string }): string {
  return [
    `¡Hola! Tu moto ya está publicada en moto.com.py: ${input.title}`,
    input.listingUrl,
    "",
    "Guardá este enlace privado para marcarla como vendida, pausarla, renovarla o editarla. No lo compartas: quien lo tenga puede cambiar tu publicación.",
    input.manageUrl,
  ].join("\n");
}

/** Mensaje al aprobar una de comercio: sin enlace privado (el comercio lo gestiona con nosotros). */
export function dealerApprovalMessage(input: { title: string; listingUrl: string }): string {
  return `Hola, ya está publicada en moto.com.py: ${input.title}\n${input.listingUrl}`;
}

/** Mensaje al rechazar: el aviso editado por el moderador. */
export function rejectionMessage(input: { title: string; text: string }): string {
  return `Hola, te escribimos de moto.com.py por tu publicación «${input.title}».\n\n${input.text}`;
}

// Patrones 1 y 2 de T&S §2 (vendedor en el exterior, seña por adelantado): ordenan la cola, no rechazan.
const FRAUD_WORDS = [
  /\b(estoy|vivo|me encuentro) en (el )?(exterior|brasil|argentina|espa[nñ]a|usa|estados unidos)\b/i,
  /\bte la (env[ií]o|mando)\b/i,
  /(?<![a-zñ])se[nñ][aá](r|s)?(?![a-zñáéíóú])/i,
  /\breserv[aá] con\b/i,
  /\b(transfer(encia|[ií])|dep[oó]sito|giro) (por )?adelantad/i,
  /\bpag(o|[aá]) (por )?adelantad/i,
];

export function fraudKeywords(text: string | null): string[] {
  if (!text) return [];
  return FRAUD_WORDS.map((re) => re.exec(text)?.[0]).filter((m): m is string => Boolean(m));
}

/** Mediana de una lista de montos (sin tocar la lista). */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** T&S §3: precio > 35 % por debajo de la mediana del modelo, sólo con ≥ 5 unidades para calcularla. */
export const PRICE_OUTLIER_RATIO = 0.65;
export const MIN_MEDIAN_N = 5;

export function isPriceOutlier(price: number | null, med: number | null, n: number): boolean {
  return price !== null && med !== null && n >= MIN_MEDIAN_N && price < med * PRICE_OUTLIER_RATIO;
}

/** SLA de moderación: alerta a las 20 h en cola (ADMIN_SPEC §3). */
export const SLA_ALERT_HOURS = 20;
