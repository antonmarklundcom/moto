// `npm run check:bundle`: falla si el bundle de cliente (.next/static) contiene
// VENDERCRM_API_KEY (el nombre) o su valor actual. Corre al final de
// `npm run verify`, después de `next build` (A4, TEST_PLAN.md §9).
// tsx no carga .env solo (CLAUDE.md §2): se carga acá.
import "dotenv/config";
import { existsSync } from "node:fs";
import { scanForSecrets } from "../src/lib/crm/bundle-scan";

const dir = ".next/static";
if (!existsSync(dir)) {
  console.error("check:bundle: no existe .next/static; correr `npm run build` antes.");
  process.exit(1);
}
const needles = ["VENDERCRM_API_KEY", process.env.VENDERCRM_API_KEY, process.env.SESSION_SECRET, process.env.CRON_SECRET, process.env.IP_HASH_SALT];
const hits = scanForSecrets(dir, needles);
if (hits.length > 0) {
  for (const hit of hits) {
    const label = hit.needle === "VENDERCRM_API_KEY" ? hit.needle : "(valor de un secreto del entorno)";
    console.error(`check:bundle: ${label} aparece en ${hit.file}`);
  }
  process.exit(1);
}
console.info(`check:bundle: ok, ${dir} sin secretos (${needles.filter((n) => n && n.length >= 8).length} agujas).`);
