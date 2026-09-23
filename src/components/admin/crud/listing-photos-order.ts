// Orden de las fotos de una publicación (puro: lo usan el admin y sus pruebas).
/** Nuevo orden de ids tras mover `imageId`. Puro. */
export function reorder(ids: readonly number[], imageId: number, action: "up" | "down" | "cover"): number[] {
  const at = ids.indexOf(imageId);
  if (at === -1) return [...ids];
  const out = [...ids];
  if (action === "cover") {
    out.splice(at, 1);
    out.unshift(imageId);
  } else {
    const to = action === "up" ? at - 1 : at + 1;
    if (to < 0 || to >= out.length) return out;
    [out[at], out[to]] = [out[to], out[at]];
  }
  return out;
}
