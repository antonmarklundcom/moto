// VenderCRM falso (A4) para correr tests/e2e/financing.spec.ts de punta a punta:
//   npx tsx tests/e2e/support/mock-crm.ts   → imprime la URL y queda escuchando
// Después: VENDERCRM_URL=<url> VENDERCRM_API_KEY=clave-e2e npx next start -p 3100
import { startMockVenderCrm } from "../../../src/lib/crm/testing/mock-vendercrm";

startMockVenderCrm("clave-e2e").then((mock) => {
  console.log(mock.url);
  setInterval(() => {}, 1 << 30);
});
