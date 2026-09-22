// Límite por IP de POST /api/uploads (helper de A1). Módulo aparte porque un
// route handler de Next no puede exportar nada fuera de sus métodos.
import { RateLimiter } from "@/lib/rate-limit";

/** 40 fotos cada 10 minutos por IP: 20 de un aviso más reintentos. */
export const uploadLimiter = new RateLimiter(40, 10 * 60 * 1000);
