"use client";

import { useEffect } from "react";
import { DRAFT_STORAGE_KEY } from "./state";

/** Después de enviar, el borrador local ya no sirve. */
export function ClearDraft() {
  useEffect(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* nada */
    }
  }, []);
  return null;
}
