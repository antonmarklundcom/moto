import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, db } from "./index";
import { activityLog } from "./schema";

// F-1: MySQL escribe `DEFAULT CURRENT_TIMESTAMP` en el time_zone de la sesión.
// El MySQL local del hook corre a propósito en -03:00; si una conexión del
// pool no fija '+00:00', estas pruebas fallan.
describe("pool de MySQL (F-1)", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("cada conexión usa time_zone = '+00:00'", async () => {
    // Varias consultas en paralelo fuerzan conexiones nuevas del pool.
    const results = await Promise.all(
      Array.from({ length: 4 }, () => db.execute(sql`SELECT @@session.time_zone AS tz`)),
    );
    for (const [rows] of results as unknown as Array<[Array<{ tz: string }>]>) {
      expect(rows[0].tz).toBe("+00:00");
    }
  });

  it("created_at escrito por MySQL coincide con new Date() en UTC", async () => {
    const before = Date.now();
    const [inserted] = await db.insert(activityLog).values({
      entityType: "test",
      entityId: 1,
      action: "tz_check",
    });
    const id = inserted.insertId;
    try {
      const [row] = await db.select().from(activityLog).where(eq(activityLog.id, id));
      const drift = Math.abs(row.createdAt.getTime() - before);
      expect(drift).toBeLessThan(5_000);
    } finally {
      await db.delete(activityLog).where(eq(activityLog.id, id));
    }
  });
});
