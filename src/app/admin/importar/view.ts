// Forma serializable del plan y del resultado, para el formulario (cliente).
// Sin imports de servidor: lo usan tanto las acciones como los componentes.

export type ViewRow = {
  line: number;
  ref: string;
  /** create | update | unchanged | reject | created | updated | rejected | failed */
  kind: string;
  detail: string;
};

export type ImportViewState =
  | { step: "idle"; error?: string }
  | {
      step: "preview";
      csvText: string;
      dealerId: string;
      hash: string;
      fileErrors: string[];
      fileWarnings: string[];
      counts: { create: number; update: number; unchanged: number; reject: number };
      rows: ViewRow[];
      /** La base cambió entre la vista previa y la confirmación. */
      stale?: boolean;
    }
  | {
      step: "done";
      rows: ViewRow[];
      summary: string;
    };

export const KIND_LABEL: Readonly<Record<string, string>> = {
  create: "Se crea",
  update: "Se actualiza",
  unchanged: "Sin cambios",
  reject: "Rechazada",
  created: "Creada",
  updated: "Actualizada",
  rejected: "Rechazada",
  failed: "Error",
};
