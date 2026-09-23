// Importación de stock de comercio desde la terminal (G-18). El mismo núcleo
// que /admin/importar (src/lib/import/).
//
//   npx tsx scripts/import-dealer-stock.ts <planilla.csv> [--comercio <slug>] [--fotos <carpeta|archivo.zip>] [--apply]
//
// Sin --apply es una vista previa: no escribe nada. Con --apply crea/actualiza
// las filas válidas (idempotente por comercio + referencia) y después carga
// las fotos cuyo nombre empieza con la referencia.
//
// Stock de demostración (sólo local, ADR-24):
//   npm run fixtures && npx tsx scripts/import-dealer-stock.ts docs/templates/demo/stock-demo.csv --apply
//
// tsx no carga .env solo (CLAUDE.md §2): dotenv va primero.
import "dotenv/config";

import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

// Los módulos del servidor importan `server-only`, que sólo se resuelve vacío
// con la condición `react-server` (la que usa Next). Se relanza con ella.
if (!process.execArgv.includes("--conditions=react-server")) {
  const run = spawnSync(
    process.execPath,
    [...process.execArgv, "--conditions=react-server", process.argv[1], ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  process.exit(run.status ?? 1);
}

const USAGE =
  "Uso: npx tsx scripts/import-dealer-stock.ts <planilla.csv> [--comercio <slug>] [--fotos <carpeta|archivo.zip>] [--apply]";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      comercio: { type: "string" },
      fotos: { type: "string" },
      apply: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  // Import dinámico: la base se abre recién con el entorno cargado.
  const { closeDb } = await import("../src/db");
  const { loadCatalog } = await import("../src/lib/import/catalog");
  const { applyImport, previewImport } = await import("../src/lib/import/apply");
  const { attachPhoto, matchPhoto, photoCandidates } = await import("../src/lib/import/photos");
  const { naturalCompare, PHOTO_EXTENSIONS } = await import("../src/lib/import/photo-names");
  const { isZip, readZip } = await import("../src/lib/import/zip");
  const { demoRefusal } = await import("../src/lib/import/demo");

  try {
    const { decodeCsvBytes } = await import("../src/lib/import/csv");
    const csvText = decodeCsvBytes(await readFile(positionals[0]));
    let dealerId: number | null = null;
    if (values.comercio) {
      const catalog = await loadCatalog();
      const key = values.comercio.toLowerCase();
      const dealer = catalog.dealers.find((d) => d.slug === key || d.name.toLowerCase() === key);
      if (!dealer) throw new Error(`No existe el comercio «${values.comercio}».`);
      dealerId = dealer.id;
    }

    const refusal = demoRefusal();
    console.log(
      refusal === null
        ? "Base local con ALLOW_DEV_FIXTURES=1: se aceptan filas de prueba (DEV-, comercios dev-)."
        : `Filas de prueba (DEV-, comercios dev-) rechazadas: ${refusal}`,
    );

    if (!values.apply) {
      const plan = await previewImport({ csvText, defaultDealerId: dealerId });
      for (const e of plan.fileErrors) console.log(`ERROR del archivo: ${e}`);
      for (const w of plan.fileWarnings) console.log(`Aviso: ${w}`);
      for (const item of plan.items) {
        const ref = item.row.externalRef ?? "(sin referencia)";
        if (item.kind === "reject") {
          console.log(`línea ${item.row.line} ${ref}: RECHAZADA — ${item.row.problems.map((p) => `[${p.code}] ${p.message}`).join(" ")}`);
        } else {
          const extra = item.kind === "update" ? ` (${Object.keys(item.changes).join(", ")})` : "";
          const warn = item.row.warnings.length ? ` — ${item.row.warnings.join(" ")}` : "";
          const label = { create: "se crea", update: "se actualiza", unchanged: "sin cambios" }[item.kind];
          console.log(`línea ${item.row.line} ${ref}: ${label}${extra}${warn}`);
        }
      }
      const c = plan.counts;
      console.log(`\nVista previa: ${c.create} nuevas, ${c.update} a actualizar, ${c.unchanged} sin cambios, ${c.reject} rechazadas.`);
      console.log("Nada se escribió. Para aplicar: agregá --apply.");
      if (plan.fileErrors.length || c.reject) process.exitCode = 2;
    } else {
      const result = await applyImport({ csvText, defaultDealerId: dealerId, source: { kind: "cli" } });
      if (!result.ok) {
        for (const e of result.plan.fileErrors) console.log(`ERROR del archivo: ${e}`);
        process.exitCode = 1;
        return;
      }
      for (const o of result.outcomes) {
        console.log(`línea ${o.line} ${o.externalRef ?? "(sin referencia)"}: ${o.action} — ${o.message}`);
      }
      const by = (a: string) => result.outcomes.filter((o) => o.action === a).length;
      console.log(
        `\nAplicado: ${by("created")} creadas, ${by("updated")} actualizadas, ${by("unchanged")} sin cambios, ${by("rejected")} rechazadas, ${by("failed")} con error. Publicadas ahora: ${result.published}. En moderación: ${result.pending}.`,
      );
      if (by("rejected") || by("failed")) process.exitCode = 2;
    }

    if (values.fotos) {
      const files: Array<{ name: string; read: () => Promise<Buffer> }> = [];
      const info = await stat(values.fotos);
      if (info.isDirectory()) {
        for (const name of await readdir(values.fotos)) {
          if (PHOTO_EXTENSIONS.test(name)) files.push({ name, read: () => readFile(join(values.fotos!, name)) });
        }
      } else {
        const buf = await readFile(values.fotos);
        if (!isZip(buf)) throw new Error("--fotos tiene que ser una carpeta o un .zip.");
        for (const e of readZip(buf)) if (PHOTO_EXTENSIONS.test(e.name)) files.push({ name: e.name, read: async () => e.data });
      }
      files.sort((a, b) => naturalCompare(a.name, b.name));
      const candidates = await photoCandidates(dealerId);
      let ok = 0;
      for (const f of files) {
        if (!values.apply) {
          const m = matchPhoto(f.name, candidates);
          console.log(`foto ${f.name}: ${"error" in m ? m.error : `→ ${m.listing.externalRef}`}`);
          continue;
        }
        const out = await attachPhoto({ fileName: f.name, data: await f.read(), candidates, source: { kind: "cli" } });
        if (out.ok) ok += 1;
        console.log(`foto ${out.file}: ${out.externalRef ?? "?"} — ${out.message}`);
      }
      console.log(values.apply ? `Fotos: ${ok} de ${files.length} cargadas.` : `Fotos: ${files.length} (vista previa, nada se cargó).`);
    }
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
