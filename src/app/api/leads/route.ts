// Formularios de lead (financiación, seguro, plan de comercio, publicidad).
// La lógica: src/lib/leads/handler.ts. El envío al CRM corre con after(),
// después de responder: el visitante nunca espera al CRM.
import { after } from "next/server";
import { handleLeadPost } from "@/lib/leads/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleLeadPost(request, (task) => after(task));
}
