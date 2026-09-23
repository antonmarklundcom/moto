// Se ejecuta una vez al arrancar el servidor (Next.js instrumentation). Sólo
// en el runtime de Node (el `if` literal deja el código fuera del bundle edge)
// y nunca durante `next build`.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const { boot } = await import("./lib/boot/boot");
    await boot();
  }
}
