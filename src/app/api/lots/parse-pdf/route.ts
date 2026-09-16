import { NextRequest, NextResponse } from "next/server";
import { extractCalculDeContenances } from "@/lib/pdf/extract";

export const maxDuration = 120; // OCR at 300 DPI is slow — give it room

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier PDF fourni." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Le fichier doit être un PDF." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await extractCalculDeContenances(buffer);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PDF parse failed", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json(
      { error: `Échec de l'analyse du PDF (${message}). Vous pouvez saisir les bornes manuellement.` },
      { status: 422 },
    );
  }
}
