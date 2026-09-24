// Mete en el código los archivos que la app lee en tiempo de ejecución:
// las migraciones de /drizzle y los textos de /content. Hostinger despliega
// la salida del build, no el repositorio entero, así que en el servidor esas
// carpetas pueden no existir (o process.cwd() puede ser otro directorio).
// Con esto las migraciones y los textos viajan dentro del bundle.
//
// Corre solo antes de `npm run build` (prebuild). Plain Node, sin tsx: en el
// build de Hostinger no hace falta ninguna devDependency para esto.
// `--check` no escribe: falla si el archivo generado está desactualizado.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "src", "generated", "embedded.ts");

export function buildEmbedded() {
  const drizzleDir = path.join(root, "drizzle");
  const journal = JSON.parse(readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"));
  // Mismo formato que readMigrationFiles() de drizzle-orm (hash incluido).
  const migrations = journal.entries.map((e) => {
    const query = readFileSync(path.join(drizzleDir, `${e.tag}.sql`), "utf8");
    return {
      tag: e.tag,
      sql: query.split("--> statement-breakpoint"),
      bps: e.breakpoints,
      folderMillis: e.when,
      hash: createHash("sha256").update(query).digest("hex"),
    };
  });

  const content = {};
  for (const sub of ["seo", "guias"]) {
    const dir = path.join(root, "content", sub);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".md")).sort()) {
      content[`${sub}/${f}`] = readFileSync(path.join(dir, f), "utf8");
    }
  }

  return [
    "// GENERADO por scripts/embed-files.mjs (corre en prebuild). No editar a mano.",
    "// Fuente: drizzle/*.sql + drizzle/meta/_journal.json y content/{seo,guias}/*.md.",
    "",
    "export type EmbeddedMigration = { tag: string; sql: string[]; bps: boolean; folderMillis: number; hash: string };",
    "",
    `export const MIGRATIONS: EmbeddedMigration[] = ${JSON.stringify(migrations, null, 1)};`,
    "",
    "/** Clave: ruta relativa a content/ (p. ej. \"seo/en-cuotas.md\"). */",
    `export const CONTENT_FILES: Record<string, string> = ${JSON.stringify(content, null, 1)};`,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = buildEmbedded();
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {}
  if (process.argv.includes("--check")) {
    if (current !== next) {
      console.error("src/generated/embedded.ts está desactualizado: corré `node scripts/embed-files.mjs`.");
      process.exit(1);
    }
  } else if (current !== next) {
    writeFileSync(out, next);
    console.log("embed-files: src/generated/embedded.ts actualizado");
  }
}
