import { classifyMotosPath } from "@/lib/seo/routes";
import type { BrowseKind } from "./copy";
import type { BrowseRoute } from "./data";

export type { BrowseRoute };

/**
 * Segmentos de la URL → ruta de B1, validados con el contrato de A2
 * (`classifyMotosPath`: slugs reservados, mal formados o combinaciones de
 * §2.3 → `null` → 404). `expected` evita que una página atienda otro tipo.
 */
export function browseRouteFrom(segments: readonly string[], expected: BrowseKind): BrowseRoute | null {
  const route = classifyMotosPath(segments);
  if (!route || route.kind !== expected) return null;
  return route as BrowseRoute;
}
