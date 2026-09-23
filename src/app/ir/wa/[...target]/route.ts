// Redirección rastreada a WhatsApp (ADR-07). La lógica: src/lib/leads/redirect.ts.
import { handleWhatsAppRedirect } from "@/lib/leads/redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ target: string[] }> }): Promise<Response> {
  const { target } = await params;
  return handleWhatsAppRedirect(target, request);
}
