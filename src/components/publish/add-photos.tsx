"use client";

import { useState } from "react";
import { PhotoUploader, type UploadedPhoto } from "./photo-uploader";

/** Fotos nuevas para /mi-aviso: mismo cargador que /publicar; los ids viajan con el formulario de edición. */
export function AddPhotos() {
  const [draftToken, setDraftToken] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const ids = photos.filter((p) => p.status === "done" && p.id).map((p) => p.id);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-medium">Agregar fotos</legend>
      <input type="hidden" name="draftToken" value={draftToken} />
      <input type="hidden" name="fotos" value={ids.join(",")} />
      <PhotoUploader draftToken={draftToken} onDraftToken={setDraftToken} photos={photos} onPhotos={setPhotos} />
    </fieldset>
  );
}
