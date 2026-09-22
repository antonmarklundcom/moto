// POST /api/cron/<job> (ADR-19). Lo llama el cron de hPanel con curl; ver
// docs/log/A1.md para las líneas exactas.
import { env } from "@/lib/env";
import { checkCronAuth } from "@/lib/cron/auth";
import { getCronJob } from "@/lib/cron/jobs";
import { runJob } from "@/lib/cron/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }): Promise<Response> {
  const auth = checkCronAuth(request.headers.get("authorization"), env.cronSecret());
  if (auth === "unconfigured") return json(503, { error: "cron_not_configured" });
  if (auth === "unauthorized") return json(401, { error: "unauthorized" });

  const { job } = await params;
  const fn = getCronJob(job);
  if (!fn) return json(404, { error: "unknown_job" });

  const result = await runJob(job, fn);
  if (result.status === "locked") return json(409, { job, status: "locked" });
  if (result.status === "failed") return json(500, { job, status: "failed", runId: result.runId });
  return json(200, { job, status: "succeeded", runId: result.runId, detail: result.detail });
}
