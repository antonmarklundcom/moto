export type PublishState = { errors: Record<string, string>; values: Record<string, string>; version: number; message: string | null };
export const initialPublishState: PublishState = { errors: {}, values: {}, version: 0, message: null };

/** Paso de cada campo, para volver al primero con error. */
export const FIELD_STEP: Record<string, number> = {
  fotos: 1,
  marca: 2,
  modelo: 2,
  modelo_texto: 2,
  categoria: 2,
  condicion: 2,
  anio: 2,
  km: 2,
  cc: 2,
  documentacion: 2,
  precio: 3,
  entrega: 3,
  cuota: 3,
  cuotas: 3,
  ciudad: 4,
  telefono: 4,
  nombre: 4,
  descripcion: 5,
};

export const DRAFT_STORAGE_KEY = "moto-publicar-v1";
