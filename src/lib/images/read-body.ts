// Lee el cuerpo de un request con un tope de bytes, sin cargar más que eso en
// memoria: `request.formData()` leería cualquier tamaño antes de poder mirarlo.

export class BodyTooLargeError extends Error {}

export async function readBodyCapped(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
