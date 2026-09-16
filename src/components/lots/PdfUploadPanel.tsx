"use client";

import { useState } from "react";
import type { ExtractionResult } from "@/lib/pdf/extract";

export default function PdfUploadPanel({ onParsed }: { onParsed: (result: ExtractionResult) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lots/parse-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de l'analyse du PDF.");
        return;
      }
      onParsed(data as ExtractionResult);
    } catch {
      setError("Échec de l'analyse du PDF. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="title-block p-4">
      <h2 className="font-heading text-lg mb-2">Importer un PDF « Calcul de Contenances »</h2>
      <p className="text-sm text-ink-muted mb-3">
        Le texte du PDF sera extrait automatiquement (OCR si le document est scanné) puis pré-rempli
        ci-dessous pour relecture — rien n&apos;est enregistré avant validation.
      </p>
      <label className="inline-block cursor-pointer border border-line px-4 py-2 text-sm hover:bg-copper-soft">
        {loading ? "Analyse en cours… (OCR : jusqu'à une minute pour un document scanné)" : "Choisir un fichier PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {fileName && <span className="ml-3 text-sm text-ink-muted">{fileName}</span>}
      {error && <p className="mt-2 text-sm text-ecart">{error}</p>}
    </div>
  );
}
