import type { FieldSpec } from "@/components/admin/crud/crud-form";

export function dealerFields(opts: { cities: Array<{ id: number; name: string }>; slugLocked: boolean }): FieldSpec[] {
  return [
    { name: "name", label: "Nombre", type: "text", required: true },
    {
      name: "slug",
      label: "Slug (URL de su página)",
      type: "text",
      disabled: opts.slugLocked,
      hint: opts.slugLocked ? "Bloqueado: el comercio ya tuvo publicaciones publicadas y su URL no cambia (SEO §1)." : "Vacío = se arma con el nombre.",
    },
    { name: "cityId", label: "Ciudad", type: "select", options: opts.cities.map((c) => ({ value: String(c.id), label: c.name })), required: true },
    { name: "address", label: "Dirección", type: "text" },
    { name: "phone", label: "Teléfono (WhatsApp si es celular)", type: "text", required: true },
    { name: "email", label: "Correo", type: "text" },
    { name: "websiteUrl", label: "Sitio web", type: "text" },
    { name: "description", label: "Descripción (se muestra en su página)", type: "textarea" },
    {
      name: "status",
      label: "Estado",
      type: "select",
      options: [
        { value: "prospect", label: "Prospecto (en conversación)" },
        { value: "active", label: "Activo" },
        { value: "paused", label: "Pausado" },
        { value: "archived", label: "Archivado" },
      ],
      hint: "Activo exige el bloque de autorización.",
    },
    { name: "authorizationNote", label: "Autorización: texto exacto aceptado", type: "textarea", hint: "El mensaje de DATA_SEEDING §5 tal como lo aceptó el comercio. Sin esto no se publica su stock (ADR-12)." },
    { name: "authorizationDate", label: "Autorización: fecha", type: "date" },
    { name: "authorizationChannel", label: "Autorización: medio (whatsapp, correo…)", type: "text" },
    { name: "freeUntil", label: "Gratis hasta", type: "date", hint: "Alerta a los 60 días de vencer." },
    { name: "listingTtlDays", label: "Vencimiento de sus publicaciones (días)", type: "number", hint: "Comercios nuevos: 30. Vacío = 60." },
    { name: "isVerified", label: "Comercio verificado (existencia y contacto comprobados, T&S §6)", type: "checkbox" },
    { name: "autoApprove", label: "Auto-aprobación de su stock", type: "checkbox" },
  ];
}
