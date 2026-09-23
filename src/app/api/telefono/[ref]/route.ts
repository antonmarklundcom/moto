// Revelar el teléfono de una publicación. La lógica: src/lib/leads/phone-reveal.ts.
import { handlePhoneReveal } from "@/lib/leads/phone-reveal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ ref: string }> }): Promise<Response> {
  const { ref } = await params;
  return handlePhoneReveal(ref, request);
}
