// GET /media/<ruta> — sirve las fotos del almacenamiento (ADR-16, G-22). Los
// archivos viven fuera de public/, así que next/image no los ve: el loader
// (src/lib/image-loader.ts) apunta acá a la variante justa. Los nombres llevan
// el hash del contenido, así que la caché es inmutable por un año.
import { resolveMediaPath } from "@/lib/images/media-path";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notFound(): Response {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await params;
  const target = resolveMediaPath(path);
  if (!target) return notFound();

  let data: Buffer | null;
  try {
    data = await getStorage().get(target.path);
  } catch {
    return notFound();
  }
  if (!data) return notFound();

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": target.contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Una imagen nunca ejecuta nada, aunque alguien la abra directo.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
