// Semilla de marcas (ADR-11): sólo marcas con presencia confirmada en Paraguay
// vía una fuente real citable quedan is_active = true. Cualquier otra queda
// is_active = false con nota [VERIFICAR] hasta confirmarse — nunca se borra
// silenciosamente, para que quede registro de qué falta chequear.
//
// Fuentes usadas (agosto 2026):
// - Honda: hondamotos.com.py (sitio oficial de Honda Paraguay).
// - Yamaha: yamaha.com.py, operado por Chacomer S.A.E., distribuidor oficial.
// - Suzuki: abc.com.py "Suzuki Motos regresa a Paraguay con Chacomer" (2025-01-14).
// - Bajaj: hoy.com.py / lanacion.com.py, distribuidor exclusivo Asunción Motor
//   Sport S.A. (AMS), con sucursales en Concepción, Loma Plata, Ciudad del Este,
//   Filadelfia y Encarnación.
// - TVS: paraguay.tvsmotor.com (sitio oficial TVS Paraguay).
// - Kenton: kenton.com.py, chacomer.com.py/moto/kenton.html, tupi.com.py
//   (marca 991), digi.com.py (retailer paraguayo).
// - Zanella: sólo confirmada como marca regional (Argentina); no se encontró
//   una fuente específica de distribución en Paraguay. Queda inactiva.
//
// Re-verificación R0 (acceso 2026-09-22, ver docs/research/catalog.md):
// - Honda: hondamotos.com.py y www.honda.com.py siguen sin poder abrirse esta
//   sesión (bloqueo de la política de red del entorno, confirmado contra
//   /root/.ccr/README.md — no es un bloqueo del sitio esta vez). Se confirma
//   igual vía fuentes alternativas: DIESA S.A. es el distribuidor oficial de
//   Honda Motos en Paraguay (avisos "DIESA S.A." en clasipar.paraguay.com,
//   diesa.com.py/marcas/honda-motos/, La Nación 2016-03-03 "Honda Motos
//   Paraguay habilitó su nuevo e innovador Showroom").
// - Star: marca paraguaya de ALEX S.A. (75+ años en el mercado), confirmada en
//   star.com.py y ABC Color "STAR, la motocicleta que acompaña en todo lo que
//   uno se propone" (2025-07-10). Junto con Kenton, es una de las marcas de
//   mayor volumen del segmento de entrada en Paraguay — se activa.

export type BrandSeed = {
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  note?: string;
};

export const brandSeeds: BrandSeed[] = [
  { name: "Honda", slug: "honda", isActive: true, sortOrder: 10 },
  { name: "Yamaha", slug: "yamaha", isActive: true, sortOrder: 20 },
  { name: "Suzuki", slug: "suzuki", isActive: true, sortOrder: 30 },
  { name: "Bajaj", slug: "bajaj", isActive: true, sortOrder: 40 },
  { name: "TVS", slug: "tvs", isActive: true, sortOrder: 50 },
  { name: "Kenton", slug: "kenton", isActive: true, sortOrder: 60 },
  { name: "Star", slug: "star", isActive: true, sortOrder: 15 },
  {
    name: "Zanella",
    slug: "zanella",
    isActive: false,
    sortOrder: 900,
    note: "[VERIFICAR: confirmar distribuidor oficial o presencia comercial de Zanella en Paraguay antes de activar]",
  },
];
